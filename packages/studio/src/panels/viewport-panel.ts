export interface ViewportDefinition { label: string; body: string; }
export function renderViewportGrid(viewports: ViewportDefinition[]): string {
  return `<div class="viewport-grid">${viewports.map((viewport) => `<div class="mini"><strong>${viewport.label}</strong>${viewport.body}</div>`).join("")}</div>`;
}

type Point3 = { x: number; y: number; z?: number };
type ViewportSnapshot = { mode?: string; face?: unknown; pose?: { yaw?: number; pitch?: number; roll?: number } | null };

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
  const face = snapshot.face as { landmarks?: { raw?: unknown[] } } | undefined;
  const raw = face?.landmarks?.raw ?? [];
  const points = raw.map(asPoint).filter((point): point is Point3 => point !== null);
  if (snapshot.mode !== "connected" || points.length < 3) return;
  const view = canvas.dataset.viewport ?? "FRONT";
  const pose = snapshot.pose ?? {};
  const projected = points.map((point) => project(point, view, pose.yaw ?? 0, pose.pitch ?? 0, pose.roll ?? 0));
  context.fillStyle = "rgba(52, 198, 240, .85)";
  projected.forEach((point, index) => {
    if (index % 2) return;
    context.beginPath();
    context.arc(point.x * width, point.y * height, 1.15, 0, Math.PI * 2);
    context.fill();
  });
  context.strokeStyle = "rgba(52, 198, 240, .32)";
  context.lineWidth = 0.7;
  for (let index = 1; index < projected.length; index += 2) {
    const previous = projected[index - 1];
    const point = projected[index];
    context.beginPath();
    context.moveTo(previous.x * width, previous.y * height);
    context.lineTo(point.x * width, point.y * height);
    context.stroke();
  }
  const eyeLeft = projected[Math.min(33, projected.length - 1)];
  const eyeRight = projected[Math.min(263, projected.length - 1)];
  if (!eyeLeft || !eyeRight) return;
  const eyeDistance = Math.max(8, Math.abs(eyeRight.x - eyeLeft.x) * width);
  const eyeY = ((eyeLeft.y + eyeRight.y) / 2) * height;
  const centerX = ((eyeLeft.x + eyeRight.x) / 2) * width;
  const lensWidth = eyeDistance * 0.8;
  const lensHeight = Math.max(8, lensWidth * 0.58);
  context.strokeStyle = "#f1b54a";
  context.lineWidth = 1.5;
  [centerX - eyeDistance / 2, centerX + eyeDistance / 2].forEach((lensX) => {
    context.beginPath();
    context.ellipse(lensX, eyeY, lensWidth / 2, lensHeight / 2, 0, 0, Math.PI * 2);
    context.stroke();
  });
  context.beginPath();
  context.moveTo(centerX - eyeDistance / 2 + lensWidth / 2, eyeY);
  context.lineTo(centerX + eyeDistance / 2 - lensWidth / 2, eyeY);
  context.stroke();
}

/** Updates all four lightweight face projections from the latest audit snapshot. */
export function updateViewportGrid(element: HTMLElement, snapshot: ViewportSnapshot): void {
  element.querySelectorAll<HTMLCanvasElement>("canvas.viewport-canvas").forEach((canvas) => drawViewport(canvas, snapshot));
}
