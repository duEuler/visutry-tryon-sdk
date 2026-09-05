import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

export interface ViewportDefinition { label: string; body: string; }
export function renderViewportGrid(viewports: ViewportDefinition[]): string {
  return `<div class="viewport-grid">${viewports.map((viewport) => `<div class="mini"><strong>${viewport.label}</strong>${viewport.body}</div>`).join("")}</div>`;
}

type Point3 = { x: number; y: number; z?: number };
type ViewportSnapshot = {
  mode?: string;
  face?: unknown;
  pose?: {
    yaw?: number; pitch?: number; roll?: number;
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
    visible?: boolean;
  } | null;
  glb?: unknown;
  reconstruction?: { landmarks: Array<{ index: number; x: number; y: number; z: number; source: "observed" | "estimated" }>; connections?: Array<[number, number]>; completed: boolean; coverage: number; capturedFrames: number } | null;
};

const staticViewportSnapshots = new WeakMap<HTMLElement, Pick<ViewportSnapshot, "face" | "pose">>();
const viewportScenes = new WeakMap<HTMLCanvasElement, ViewportScene>();

class ViewportScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  private readonly world = new THREE.Group();
  private readonly face = new THREE.Group();
  private readonly glasses = new THREE.Group();
  private readonly loader = new GLTFLoader();
  private loadedGlb = "";
  private loadingGlb = false;
  private glbRoot: THREE.Object3D | null = null;
  private glbModelScale = 1;
  private glbOrigin: { x: number; y: number; z: number } | null = null;
  private glbFrameWidthMm = 150;
  private lastRaw: unknown[] | null = null;
  private canonicalIndex: number[] | null = null;
  private usingCanonical = false;
  private faceCenter = new THREE.Vector3();
  private faceFitScale = 1;
  private eyeCenter = new THREE.Vector3();
  private eyeDistance = 0;
  private cameraTarget = new THREE.Vector3();
  private lastPose: NonNullable<ViewportSnapshot["pose"]> = { yaw: 0, pitch: 0, roll: 0 };

  private static canonicalIndexPromise: Promise<number[] | null> | null = null;

  private static loadCanonicalIndex(): Promise<number[] | null> {
    if (!ViewportScene.canonicalIndexPromise) {
      ViewportScene.canonicalIndexPromise = new Promise((resolve) => {
        new OBJLoader().load("/models/references/mediapipe/canonical_face_model.obj", (object) => {
          const mesh = object.children.find((child): child is THREE.Mesh => child instanceof THREE.Mesh);
          const index = mesh?.geometry.getIndex();
          resolve(index ? Array.from(index.array as ArrayLike<number>) : null);
        }, undefined, () => resolve(null));
      });
    }
    return ViewportScene.canonicalIndexPromise;
  }

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.background = new THREE.Color("#091321");
    this.scene.add(this.world);
    this.world.add(this.face, this.glasses);
    this.glasses.visible = false;
    ViewportScene.loadCanonicalIndex().then((index) => {
      this.canonicalIndex = index;
      if (this.lastRaw && this.canonicalIndex) {
        this.rebuildFace(this.lastRaw, []);
        this.usingCanonical = true;
        this.renderer.render(this.scene, this.camera);
      }
    });
  }

  render(snapshot: ViewportSnapshot): void {
    const face = snapshot.face as { landmarks?: { raw?: unknown[]; connections?: { tesselation?: Array<{ start: number; end: number }> } }; pose?: { matrix?: number[] } } | undefined;
    const raw = face?.landmarks?.raw ?? [];
    if (snapshot.mode !== "connected" || raw.length < 3) return;
    const width = Math.max(1, this.canvas.clientWidth || 160);
    const height = Math.max(1, this.canvas.clientHeight || 120);
    this.renderer.setSize(width, height, false);
    const view = this.canvas.dataset.viewport ?? "FRONT";
    this.lastPose = {
      yaw: snapshot.pose?.yaw ?? 0,
      pitch: snapshot.pose?.pitch ?? 0,
      roll: snapshot.pose?.roll ?? 0,
      position: snapshot.pose?.position,
      rotation: snapshot.pose?.rotation,
      scale: snapshot.pose?.scale,
      visible: snapshot.pose?.visible,
    };
    if (this.lastRaw !== raw || (this.canonicalIndex !== null && !this.usingCanonical)) {
      this.rebuildFace(raw, face?.landmarks?.connections?.tesselation ?? []);
      this.lastRaw = raw;
    }
    // The camera basis follows the tracked head pose, while each viewport
    // keeps its own fixed axis (front/top/left/right) around the same eye
    // anchor. This makes FRONT face the eyes instead of the page's global Z.
    this.applyView(view);
    this.applyGlassesPose();
    this.loadGlb(snapshot.glb);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.face.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
      else if (mesh.material) mesh.material.dispose();
    });
    this.glasses.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
      else if (mesh.material) mesh.material.dispose();
    });
    this.renderer.dispose();
  }

  private applyGlassesPose(): void {
    if (!this.loadedGlb) return;
    // This is the same pose contract consumed by the Live 3D renderer. The
    // viewport's `world` group applies only a visual fit transform, so the
    // relative GLB-to-face position remains the solver's exact result.
    const pose = this.lastPose;
    const position = pose.position;
    this.glasses.matrixAutoUpdate = true;
    this.glasses.position.set(position?.x ?? this.eyeCenter.x, position?.y ?? this.eyeCenter.y, position?.z ?? this.eyeCenter.z);
    if (pose.rotation) this.glasses.rotation.set(pose.rotation.x, pose.rotation.y, pose.rotation.z);
    else this.glasses.rotation.set(
      THREE.MathUtils.degToRad(pose.pitch ?? 0),
      THREE.MathUtils.degToRad(pose.yaw ?? 0),
      THREE.MathUtils.degToRad(pose.roll ?? 0),
    );
    // Fit the normalized GLB to the measured eye span in the same render
    // world as the face. This keeps the static audit view at Live's visual
    // width even when a legacy/default pose scale is present in the SDK.
    const scale = this.eyeDistance > 1e-6
      ? (() => {
          const physicalWidth = this.glbFrameWidthMm / 200;
          const fitted = this.eyeDistance / Math.max(physicalWidth, 1e-6);
          return { x: fitted, y: fitted, z: fitted };
        })()
      : (pose.scale ?? { x: 1, y: 1, z: 1 });
    // Viewports are physical-space projections, not the mirrored video
    // surface. Keep the GLB's handedness so temples extend behind the head
    // in LEFT/RIGHT and remain consistent with the Live anchor.
    this.glasses.scale.set(scale.x, scale.y, scale.z);
    if (this.glbRoot && this.glbOrigin) {
      const factor = this.glbModelScale * scale.x;
      this.glbRoot.position.set(
        -this.glbOrigin.x * factor,
        -this.glbOrigin.y * factor,
        -this.glbOrigin.z * factor,
      );
    }
    this.glasses.visible = pose.visible !== false;
  }

  private rebuildFace(raw: unknown[], links: Array<{ start: number; end: number }>): void {
    this.face.clear();
    const points = raw.map(asPoint);
    const valid = points.filter((point): point is Point3 => point !== null);
    if (!valid.length) return;
    const frameAspect = 4 / 3;
    const toRenderWorld = (point: Point3): THREE.Vector3 => new THREE.Vector3(
      (point.x - 0.5) * frameAspect,
      0.5 - point.y,
      point.z ?? 0,
    );
    const renderPoints = valid.map(toRenderWorld);
    const worldMinX = Math.min(...renderPoints.map((point) => point.x));
    const worldMaxX = Math.max(...renderPoints.map((point) => point.x));
    const worldMinY = Math.min(...renderPoints.map((point) => point.y));
    const worldMaxY = Math.max(...renderPoints.map((point) => point.y));
    const worldCenter = new THREE.Vector3(
      (worldMinX + worldMaxX) / 2,
      (worldMinY + worldMaxY) / 2,
      renderPoints.reduce((sum, point) => sum + point.z, 0) / renderPoints.length,
    );
    this.faceFitScale = 1.55 / Math.max(worldMaxX - worldMinX, worldMaxY - worldMinY, 0.05);
    this.faceCenter.copy(worldCenter);
    this.world.scale.setScalar(this.faceFitScale);
    this.world.position.set(-worldCenter.x * this.faceFitScale, -worldCenter.y * this.faceFitScale, -worldCenter.z * this.faceFitScale);
    const toWorld = (point: Point3 | null): [number, number, number] => point
      ? [((point.x - 0.5) * frameAspect), 0.5 - point.y, point.z ?? 0]
      : [0, 0, 0];
    const positions = points.flatMap(toWorld);
    const leftEye = points[33];
    const rightEye = points[263];
    if (leftEye && rightEye) {
      const leftWorld = new THREE.Vector3(...toWorld(leftEye));
      const rightWorld = new THREE.Vector3(...toWorld(rightEye));
      this.eyeDistance = leftWorld.distanceTo(rightWorld);
      this.eyeCenter.set(...toWorld({
        x: (leftEye.x + rightEye.x) / 2,
        y: (leftEye.y + rightEye.y) / 2,
        z: ((leftEye.z ?? 0) + (rightEye.z ?? 0)) / 2,
      }));
    }
    this.cameraTarget.copy(this.eyeCenter).multiplyScalar(this.faceFitScale).add(this.world.position);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const triangles: number[] = this.canonicalIndex?.length ? this.canonicalIndex.filter((index) => index < raw.length) : [];
    const adjacency = new Map<number, Set<number>>();
    links.forEach(({ start, end }) => {
      if (!adjacency.has(start)) adjacency.set(start, new Set());
      if (!adjacency.has(end)) adjacency.set(end, new Set());
      adjacency.get(start)!.add(end); adjacency.get(end)!.add(start);
    });
    if (!triangles.length) links.forEach(({ start, end }) => {
      const common = [...(adjacency.get(start) ?? [])].filter((candidate) => candidate > end && (adjacency.get(end)?.has(candidate) ?? false));
      common.forEach((candidate) => triangles.push(start, end, candidate));
    });
    if (triangles.length) geometry.setIndex(triangles);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: "#34c6f0", wireframe: true, transparent: true, opacity: 0.92 }));
    this.face.add(mesh);
    this.usingCanonical = Boolean(this.canonicalIndex?.length);
  }

  private applyView(view: string): void {
    const poseRotation = this.lastPose.rotation ?? new THREE.Euler(
      THREE.MathUtils.degToRad(this.lastPose.pitch ?? 0),
      THREE.MathUtils.degToRad(this.lastPose.yaw ?? 0),
      THREE.MathUtils.degToRad(this.lastPose.roll ?? 0),
    );
    const orientation = poseRotation instanceof THREE.Euler
      ? new THREE.Quaternion().setFromEuler(poseRotation)
      : new THREE.Quaternion().setFromEuler(new THREE.Euler(poseRotation.x, poseRotation.y, poseRotation.z));
    // Landmarks are expressed from the camera toward the face; to place the
    // viewport camera in the face's local frame we use the inverse rotation.
    orientation.conjugate();
    const offset = view === "TOP"
      ? new THREE.Vector3(0, 3, 0)
      : view === "LEFT"
        ? new THREE.Vector3(-3, 0, 0)
        : view === "RIGHT"
          ? new THREE.Vector3(3, 0, 0)
          : new THREE.Vector3(0, 0, 3);
    offset.applyQuaternion(orientation);
    this.camera.position.copy(this.cameraTarget).add(offset);
    this.camera.up.set(0, 1, 0).applyQuaternion(orientation);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateProjectionMatrix();
  }

  private loadGlb(glb: unknown): void {
    const manifest = glb && typeof glb === "object" ? glb as {
      modelUrl?: unknown;
      dimensions?: { frameWidthMm?: unknown };
      coordinateSystem?: { unit?: unknown };
      anchors?: { origin?: { x?: unknown; y?: unknown; z?: unknown } };
    } : null;
    const modelUrl = manifest && typeof manifest.modelUrl === "string" ? manifest.modelUrl : "";
    if (!modelUrl || modelUrl === this.loadedGlb || this.loadingGlb) return;
    this.loadingGlb = true;
    this.loader.load(modelUrl, (result) => {
      this.glasses.clear();
      result.scene.updateMatrixWorld(true);
      const sourceBounds = new THREE.Box3().setFromObject(result.scene);
      const sourceWidth = sourceBounds.max.x - sourceBounds.min.x;
      const frameWidthMm = typeof manifest?.dimensions?.frameWidthMm === "number" ? manifest.dimensions.frameWidthMm : 150;
      const widthNormalization = sourceWidth > 1e-6 ? (frameWidthMm / 200) / sourceWidth : 0.01;
      const unitFactor = manifest?.coordinateSystem?.unit === "meter" ? 1000 : manifest?.coordinateSystem?.unit === "centimeter" ? 10 : 1;
      const modelScale = unitFactor * widthNormalization;
      result.scene.scale.setScalar(modelScale);
      const origin = manifest?.anchors?.origin;
      this.glbModelScale = modelScale;
      this.glbFrameWidthMm = frameWidthMm;
      this.glbOrigin = origin && [origin.x, origin.y, origin.z].every((value) => typeof value === "number")
        ? { x: Number(origin.x), y: Number(origin.y), z: Number(origin.z) }
        : null;
      this.glbRoot = result.scene;
      result.scene.position.set(0, 0, 0);
      result.scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.frustumCulled = false;
        mesh.renderOrder = 10;
        mesh.material = new THREE.MeshBasicMaterial({
          color: "#f1b54a",
          wireframe: true,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          opacity: 0.98,
        });
      });
      this.glasses.add(result.scene);
      this.glasses.visible = true;
      this.glasses.renderOrder = 10;
      this.loadedGlb = modelUrl;
      this.loadingGlb = false;
      this.applyGlassesPose();
      this.renderer.render(this.scene, this.camera);
    }, undefined, () => { this.loadingGlb = false; });
  }
}

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
  const pose = reconstruction ? {} : snapshot.pose ?? {};
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
  const meshLinks: Array<[number, number]> = reconstruction?.connections?.length ? reconstruction.connections : [];
  if (!meshLinks.length) {
    for (let index = 1; index < fitted.length; index += 1) meshLinks.push([index - 1, index]);
    for (let index = 17; index < fitted.length; index += 1) meshLinks.push([index - 17, index]);
  }
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
  if (!snapshot.glb) return;
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

// Kept for backwards compatibility with consumers that still import the
// legacy helpers; the Studio now renders Viewports through ViewportScene.
void drawViewport;

/** Updates all four lightweight face projections from the latest audit snapshot. */
export function updateViewportGrid(element: HTMLElement, snapshot: ViewportSnapshot): void {
  const hasReconstruction = Boolean(snapshot.reconstruction?.completed);
  const hasFace = Boolean((snapshot.face as { landmarks?: { raw?: unknown[] } } | undefined)?.landmarks?.raw?.length);
  if (snapshot.mode !== "connected") staticViewportSnapshots.delete(element);
  if (!hasReconstruction && hasFace && !staticViewportSnapshots.has(element)) {
    staticViewportSnapshots.set(element, { face: snapshot.face, pose: snapshot.pose });
  }
  const staticReference = staticViewportSnapshots.get(element);
  const viewportSnapshot = hasReconstruction || !staticReference
    ? snapshot
    : { ...snapshot, face: staticReference.face, pose: staticReference.pose };
  element.querySelectorAll<HTMLCanvasElement>("canvas.viewport-canvas").forEach((canvas) => {
    let scene = viewportScenes.get(canvas);
    if (!scene) { scene = new ViewportScene(canvas); viewportScenes.set(canvas, scene); }
    scene.render(viewportSnapshot);
  });
  const status = element.querySelector<HTMLElement>("[data-reconstruction-status]");
  if (status) {
    const reconstruction = snapshot.reconstruction;
    status.textContent = reconstruction?.completed
      ? `Reconstrução fixa · ${Math.round(reconstruction.coverage * 100)}% cobertura · ${reconstruction.capturedFrames} leituras`
      : staticReference ? "Modelo 3D fixo · leitura inicial" : "Aguardando leitura facial";
  }
  element.querySelectorAll<HTMLElement>("[data-viewport-caption]").forEach((caption) => {
    caption.textContent = snapshot.glb ? "rosto 3D · óculos GLB wireframe" : "rosto 3D · óculos GLB aguardando carregamento";
  });
}
