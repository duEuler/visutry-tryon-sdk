export interface ViewportDefinition { label: string; body: string; }
export function renderViewportGrid(viewports: ViewportDefinition[]): string {
  return `<div class="viewport-grid">${viewports.map((viewport) => `<div class="mini"><strong>${viewport.label}</strong>${viewport.body}</div>`).join("")}</div>`;
}

type Point3 = { x: number; y: number; z?: number };
type ViewportSnapshot = {
  mode?: string;
  face?: unknown;
  pose?: { yaw?: number; pitch?: number; roll?: number } | null;
  reconstruction?: { landmarks: Array<{ index: number; x: number; y: number; z: number; source: "observed" | "estimated" }>; completed: boolean; coverage: number; capturedFrames: number } | null;
};

const asPoint = (value: unknown): Point3 | null => {
  if (!value || typeof value !== "object") return null;
  const point = value as { x?: unknown; y?: unknown; z?: unknown };
  if (typeof point.x !== "number" || typeof point.y !== "number") return null;
  return { x: point.x, y: point.y, z: typeof point.z === "number" ? point.z : 0 };
};

function project(point: Point3, view: string, yaw: number, pitch: number, roll: number): { x: number; y: number } {
  const cx = point.x - 0.5;
  const cy = point.y - 0.5;
  const cz = point.z ?? 0;
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  const rollRad = (roll * Math.PI) / 180;
  const xYaw = cx * Math.cos(yawRad) - cz * Math.sin(yawRad);
  const zYaw = cx * Math.sin(yawRad) + cz * Math.cos(yawRad);
  const yPitch = cy * Math.cos(pitchRad) - zYaw * Math.sin(pitchRad);
  const zPitch = cy * Math.sin(pitchRad) + zYaw * Math.cos(pitchRad);
  const xRoll = xYaw * Math.cos(rollRad) - yPitch * Math.sin(rollRad);
  const yRoll = xYaw * Math.sin(rollRad) + yPitch * Math.cos(rollRad);
  if (view === "TOP") return { x: 0.5 + xRoll, y: 0.5 + zPitch * 1.6 };
  if (view === "LEFT") return { x: 0.5 + zPitch * 1.7, y: 0.5 + yRoll };
  if (view === "RIGHT") return { x: 0.5 - zPitch * 1.7, y: 0.5 + yRoll };
  return { x: 0.5 + xRoll, y: 0.5 + yRoll };
}

function drawViewport(canvas: HTMLCanvasElement, snapshot: ViewportSnapshot): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = Math.max(1, canvas.clientWidth || 160);
  const height = Math.max(1, canvas.clientHeight || 120);
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  const reconstruction = snapshot.reconstruction?.completed ? snapshot.reconstruction : null;
  const face = snapshot.face as { landmarks?: { raw?: unknown[] } } | undefined;
  const raw = face?.landmarks?.raw ?? [];
  const points = reconstruction
    ? reconstruction.landmarks.map((point) => ({ ...point, source: point.source }))
    : raw.map(asPoint).filter((point): point is Point3 => point !== null).map((point, index) => ({ ...point, index, source: "observed" as const }));
  if (snapshot.mode !== "connected" || points.length < 3) return;
  const view = canvas.dataset.viewport ?? "FRONT";
  const pose = snapshot.pose ?? {};
  const projected = points.map((point) => project(point, view, pose.yaw ?? 0, pose.pitch ?? 0, pose.roll ?? 0));
  const bounds = projected.reduce((value, point) => ({
    minX: Math.min(value.minX, point.x), maxX: Math.max(value.maxX, point.x),
    minY: Math.min(value.minY, point.y), maxY: Math.max(value.maxY, point.y),
  }), { minX: 1, maxX: 0, minY: 1, maxY: 0 });
  const boundsCenterX = (bounds.minX + bounds.maxX) / 2;
  const boundsCenterY = (bounds.minY + bounds.maxY) / 2;
  const scale = Math.min(0.82 / Math.max(bounds.maxX - bounds.minX, 0.05), 0.82 / Math.max(bounds.maxY - bounds.minY, 0.05));
  const fitted = projected.map((point) => ({ x: 0.5 + (point.x - boundsCenterX) * scale, y: 0.5 + (point.y - boundsCenterY) * scale }));
  fitted.forEach((point, index) => {
    if (index % 2) return;
    const source = points[index]?.source ?? "observed";
    context.fillStyle = source === "estimated" ? "rgba(238, 116, 196, .88)" : "rgba(52, 198, 240, .9)";
    context.beginPath();
    context.arc(point.x * width, point.y * height, source === "estimated" ? 1.3 : 1.15, 0, Math.PI * 2);
    context.fill();
  });
  context.strokeStyle = "rgba(52, 198, 240, .32)";
  context.lineWidth = 0.7;
  const meshLinks: Array<[number, number]> = [];
  for (let index = 1; index < fitted.length; index += 1) meshLinks.push([index - 1, index]);
  for (let index = 17; index < fitted.length; index += 1) meshLinks.push([index - 17, index]);
  meshLinks.forEach(([from, to]) => {
    const previous = fitted[from];
    const point = fitted[to];
    if (!previous || !point) return;
    context.beginPath();
    context.moveTo(previous.x * width, previous.y * height);
    context.lineTo(point.x * width, point.y * height);
    context.strokeStyle = points[to]?.source === "estimated" || points[from]?.source === "estimated"
      ? "rgba(238, 116, 196, .36)"
      : "rgba(52, 198, 240, .32)";
    context.stroke();
  });
  if (reconstruction) {
    context.strokeStyle = "rgba(238, 116, 196, .72)";
    context.lineWidth = 1;
    const neckY = height * 0.77;
    context.beginPath();
    context.moveTo(width * 0.39, height * 0.64);
    context.quadraticCurveTo(width * 0.42, neckY, width * 0.34, height * 0.9);
    context.moveTo(width * 0.61, height * 0.64);
    context.quadraticCurveTo(width * 0.58, neckY, width * 0.66, height * 0.9);
    context.moveTo(width * 0.34, height * 0.9);
    context.quadraticCurveTo(width * 0.5, height * 0.82, width * 0.66, height * 0.9);
    context.stroke();
  }
  const eyeLeft = fitted[Math.min(33, fitted.length - 1)];
  const eyeRight = fitted[Math.min(263, fitted.length - 1)];
  if (!eyeLeft || !eyeRight) return;
  const eyeDistance = Math.max(8, Math.abs(eyeRight.x - eyeLeft.x) * width);
  const eyeY = ((eyeLeft.y + eyeRight.y) / 2) * height;
  const glassesCenterX = ((eyeLeft.x + eyeRight.x) / 2) * width;
  const lensWidth = eyeDistance * 0.8;
  const lensHeight = Math.max(8, lensWidth * 0.58);
  context.strokeStyle = "#f1b54a";
  context.lineWidth = 1.5;
  [glassesCenterX - eyeDistance / 2, glassesCenterX + eyeDistance / 2].forEach((lensX) => {
    context.beginPath();
    context.ellipse(lensX, eyeY, lensWidth / 2, lensHeight / 2, 0, 0, Math.PI * 2);
    context.stroke();
  });
  context.beginPath();
  context.moveTo(glassesCenterX - eyeDistance / 2 + lensWidth / 2, eyeY);
  context.lineTo(glassesCenterX + eyeDistance / 2 - lensWidth / 2, eyeY);
  context.stroke();
}

/** Updates all four lightweight face projections from the latest audit snapshot. */
export function updateViewportGrid(element: HTMLElement, snapshot: ViewportSnapshot): void {
  element.querySelectorAll<HTMLCanvasElement>("canvas.viewport-canvas").forEach((canvas) => drawViewport(canvas, snapshot));
  const status = element.querySelector<HTMLElement>("[data-reconstruction-status]");
  if (status) {
    const reconstruction = snapshot.reconstruction;
    status.textContent = reconstruction?.completed
      ? `Reconstrução fixa · ${Math.round(reconstruction.coverage * 100)}% cobertura · ${reconstruction.capturedFrames} leituras`
      : "Ao vivo · inicie uma reconstrução para congelar";
  }
}
