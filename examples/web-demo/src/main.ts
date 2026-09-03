/**
 * VisuTry H5 Demo — Main Application
 *
 * Wires the @visutry/tryon-web SDK to a camera video + canvas overlay,
 * provides glasses switching, face shape analysis, snapshot, and
 * performance monitoring.
 */

import { createVisuTryWebSDK, LandmarkOverlay } from "@visutry/tryon-web";
import { buildCanonicalFaceFrame, CoordinateSystem } from "@visutry/tryon-core";
import type { VisuTrySDK, GlassesAssetManifest, FaceShapeResult, PerformanceStats, GlassesItem, NormalizedFaceResult } from "@visutry/tryon-core";
import { Recommender } from "@visutry/recommender";

// Import demo glasses manifests
import aviatorClassic from "../../../packages/demo-assets/glasses/aviator-classic.json";
import roundRetro from "../../../packages/demo-assets/glasses/round-retro.json";
import squareModern from "../../../packages/demo-assets/glasses/square-modern.json";
import cateyeFashion from "../../../packages/demo-assets/glasses/cateye-fashion.json";
import sportWrap from "../../../packages/demo-assets/glasses/sport-wrap.json";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

const GLASSES_ICONS: Record<string, string> = {
  "aviator-classic": "🕶️",
  "round-retro": "👓",
  "square-modern": "🟫",
  "cateye-fashion": "🐱",
  "sport-wrap": "🏃",
};

const SHAPE_ICONS: Record<string, string> = {
  oval: "🥚",
  round: "⭕",
  square: "⬜",
  heart: "💜",
  diamond: "💎",
  oblong: "📐",
  unknown: "❓",
};

const ALL_GLASSES: GlassesAssetManifest[] = [
  aviatorClassic as GlassesAssetManifest,
  roundRetro as GlassesAssetManifest,
  squareModern as GlassesAssetManifest,
  cateyeFashion as GlassesAssetManifest,
  sportWrap as GlassesAssetManifest,
];

// ---------------------------------------------------------------------------
// DOM Elements
// ---------------------------------------------------------------------------

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
};

const loadingOverlay = $("loading-overlay");
const loadingText = $("loading-text");
const canvas = $("tryon-canvas") as HTMLCanvasElement;
const diagnosticCanvas = $("diagnostic-canvas") as HTMLCanvasElement;
const stage = $("stage");
const diagnosticReadout = $("diagnostic-readout");
const statFps = $("stat-fps");
const statDetect = $("stat-detect");
const statRender = $("stat-render");
const trackingDot = $("tracking-dot");
const trackingText = $("tracking-text");
const faceHint = $("face-hint");
const glassesList = $("glasses-list");
const glassesInfo = $("glasses-info");
const glassesName = $("glasses-name");
const glassesPrice = $("glasses-price");
const btnAnalyze = $("btn-analyze");
const btnSnapshot = $("btn-snapshot");
const btnSwitchCamera = $("btn-switch-camera");
const btnDiagnostic = $("btn-diagnostic") as HTMLButtonElement;
const shapeModal = $("shape-modal");
const shapeIcon = $("shape-icon");
const shapeName = $("shape-name");
const shapeConfidence = $("shape-confidence");
const shapeCandidates = $("shape-candidates");
const metricsGrid = $("metrics-grid");
const shapeWarnings = $("shape-warnings");
const warningsList = $("warnings-list");
const toastContainer = $("toast-container");
const modalClose = $("modal-close") as HTMLButtonElement;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let sdk: VisuTrySDK | null = null;
let recommender: Recommender | null = null;
let selectedGlassesIndex = 0;
let isAnalyzing = false;
let currentFacingMode: "user" | "environment" = "user";
let diagnosticEnabled = false;
const landmarkOverlay = new LandmarkOverlay(diagnosticCanvas);
let lastFace: NormalizedFaceResult | null = null;
let lastPose: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number } } | null = null;
let diagnosticBaseReadout = "";
let calibrationFrames = 0;
let calibrationApplied = false;

function resetSessionCalibration(): void {
  calibrationFrames = 0;
  calibrationApplied = false;
}

function rotateOffset(v: { x: number; y: number; z: number }, r: { x: number; y: number; z: number }) {
  const cx = Math.cos(r.x), sx = Math.sin(r.x), cy = Math.cos(r.y), sy = Math.sin(r.y), cz = Math.cos(r.z), sz = Math.sin(r.z);
  const x1 = v.x, y1 = cx * v.y - sx * v.z, z1 = sx * v.y + cx * v.z;
  const x2 = cy * x1 + sy * z1, z2 = -sy * x1 + cy * z1;
  return { x: cz * x2 - sz * y1, y: sz * x2 + cz * y1, z: z2 };
}

function updateAlignmentReadout(face: NormalizedFaceResult, pose: NonNullable<typeof lastPose>): void {
  const asset = ALL_GLASSES[selectedGlassesIndex];
  const left = asset.anchors?.leftLensCenter;
  const right = asset.anchors?.rightLensCenter;
  const sem = face.landmarks.semantic;
  if (!left || !right || !sem.leftEyeCenter || !sem.rightEyeCenter) return;
  const toWorld = (p: { x: number; y: number; z?: number }) => CoordinateSystem.normalizedToRenderWorld(p, 1);
  const origin = asset.anchors.origin;
  const scale = pose.scale.x;
  const factor = 5 * scale;
  const modelPoint = (p: { x: number; y: number; z: number }) => {
    const o = rotateOffset({ x: (p.x - origin.x) * factor, y: (p.y - origin.y) * factor, z: (p.z - origin.z) * factor }, pose.rotation);
    return { x: pose.position.x + o.x, y: pose.position.y + o.y, z: pose.position.z + o.z };
  };
  const ml = modelPoint(left);
  const mr = modelPoint(right);
  const el = toWorld(sem.leftEyeCenter);
  const er = toWorld(sem.rightEyeCenter);
  const error = (Math.hypot(ml.x - el.x, ml.y - el.y) + Math.hypot(mr.x - er.x, mr.y - er.y)) / 2;
  const status = error < 0.035 ? "OK" : error < 0.075 ? "AJUSTE FINO" : "REVISAR ÂNCORAS";
  diagnosticReadout.textContent = `${diagnosticBaseReadout}\nalinhamento: ${status} · erro ${error.toFixed(3)}u`;
}

/** Applies one guarded, session-only origin correction from the nose bridge. */
function autoCalibrateOrigin(face: NormalizedFaceResult, pose: NonNullable<typeof lastPose>): void {
  if (calibrationApplied || face.pose.confidence < 0.8) return;
  const bridge = face.landmarks.semantic.noseBridge;
  if (!bridge) return;
  calibrationFrames += 1;
  if (calibrationFrames < 12) return;
  const video = document.getElementById("camera-video") as HTMLVideoElement | null;
  const rect = stage.getBoundingClientRect();
  const videoAspect = video?.videoWidth && video?.videoHeight ? video.videoWidth / video.videoHeight : undefined;
  const stageAspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : undefined;
  const aspect = videoAspect && stageAspect ? Math.max(videoAspect, stageAspect) : videoAspect ?? stageAspect ?? 1;
  const target = CoordinateSystem.normalizedToRenderWorld(bridge, aspect);
  const delta = {
    x: Math.max(-0.08, Math.min(0.08, target.x - pose.position.x)),
    y: Math.max(-0.08, Math.min(0.08, target.y - pose.position.y)),
    z: Math.max(-0.04, Math.min(0.04, target.z - pose.position.z)),
  };
  const asset = ALL_GLASSES[selectedGlassesIndex];
  asset.fitting.defaultOffset = {
    x: asset.fitting.defaultOffset.x + delta.x * 0.75,
    y: asset.fitting.defaultOffset.y + delta.y * 0.75,
    z: asset.fitting.defaultOffset.z + delta.z * 0.75,
  };
  calibrationApplied = true;
  diagnosticBaseReadout += `\ncalibração: origem ajustada (${delta.x.toFixed(3)}, ${delta.y.toFixed(3)}, ${delta.z.toFixed(3)})`;
  diagnosticReadout.textContent = diagnosticBaseReadout;
}

function add(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }): { x: number; y: number; z: number } {
  return { x: a.x + b.x, y: a.y + b.y, z: (a.z ?? 0) + (b.z ?? 0) };
}

function mul(v: { x: number; y: number; z?: number }, scalar: number): { x: number; y: number; z: number } {
  return { x: v.x * scalar, y: v.y * scalar, z: (v.z ?? 0) * scalar };
}

/** Draws a face-local cuboid, not just a 2D bounding rectangle. */
function drawFaceSpaceBox(
  ctx: CanvasRenderingContext2D,
  canonical: ReturnType<typeof buildCanonicalFaceFrame>,
  toCanvas: (point?: { x: number; y: number }) => { x: number; y: number } | null,
): void {
  if (!canonical) return;
  const width = canonical.width * 1.38;
  const height = canonical.height * 1.08;
  const depth = Math.max(canonical.depth * 4, width * 0.42);
  const center = add(canonical.origin, mul(canonical.yAxis, -height * 0.08));
  const corners: Array<{ x: number; y: number; z: number }> = [];
  for (const z of [-depth / 2, depth / 2]) {
    for (const y of [-height / 2, height / 2]) {
      for (const x of [-width / 2, width / 2]) {
        corners.push(add(center, add(add(mul(canonical.xAxis, x), mul(canonical.yAxis, y)), mul(canonical.zAxis, z))));
      }
    }
  }
  const projected = corners.map((p) => toCanvas(p));
  if (projected.some((p) => !p)) return;
  const pts = projected as Array<{ x: number; y: number }>;
  const faces = [
    [0, 1, 3, 2], [4, 6, 7, 5], // front/back
    [0, 4, 5, 1], [2, 3, 7, 6],
    [0, 2, 6, 4], [1, 5, 7, 3],
  ];
  ctx.save();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(78, 214, 255, .9)";
  for (const [index, face] of faces.entries()) {
    ctx.beginPath();
    face.forEach((corner, i) => i === 0 ? ctx.moveTo(pts[corner].x, pts[corner].y) : ctx.lineTo(pts[corner].x, pts[corner].y));
    ctx.closePath();
    ctx.fillStyle = index === 0 ? "rgba(78, 214, 255, .08)" : "rgba(78, 214, 255, .025)";
    ctx.fill();
    ctx.stroke();
  }
  const edges = [[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]];
  ctx.beginPath();
  for (const [a, b] of edges) { ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); }
  ctx.stroke();
  const origin = toCanvas(canonical.origin);
  if (origin) {
    const axisLength = width * 0.34;
    const axes = [[canonical.xAxis, "#ff5b7a", "X"], [canonical.yAxis, "#35d07f", "Y"], [canonical.zAxis, "#ffd166", "Z"]] as const;
    for (const [axis, color, label] of axes) {
      const end = toCanvas(add(canonical.origin, mul(axis, axisLength)));
      if (!end) continue;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      ctx.fillText(label, end.x + 4, end.y - 4);
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillText("C", origin.x + 6, origin.y + 12);
  }
  ctx.restore();
}

function drawCalibrationGuides(face: NormalizedFaceResult): void {
  const video = document.getElementById("camera-video") as HTMLVideoElement | null;
  const videoWidth = video?.videoWidth || 640;
  const videoHeight = video?.videoHeight || 480;
  const rect = stage.getBoundingClientRect();
  const scale = Math.max(rect.width / videoWidth, rect.height / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const cropX = (renderedWidth - rect.width) / 2;
  const cropY = (renderedHeight - rect.height) / 2;
  const toCanvas = (point?: { x: number; y: number }) => point
    ? { x: point.x * renderedWidth - cropX, y: point.y * renderedHeight - cropY }
    : null;
  const ctx = diagnosticCanvas.getContext("2d");
  if (!ctx) return;
  const semantic = face.landmarks.semantic;
  const canonical = buildCanonicalFaceFrame(face);
  const activeAsset = ALL_GLASSES[selectedGlassesIndex];
  const lensAnchors = activeAsset?.anchors?.leftLensCenter && activeAsset?.anchors?.rightLensCenter
    ? Math.hypot(
      activeAsset.anchors.rightLensCenter.x - activeAsset.anchors.leftLensCenter.x,
      activeAsset.anchors.rightLensCenter.y - activeAsset.anchors.leftLensCenter.y,
      activeAsset.anchors.rightLensCenter.z - activeAsset.anchors.leftLensCenter.z,
    )
    : null;
  const boxTopLeft = toCanvas({ x: face.bbox.x, y: face.bbox.y });
  const boxBottomRight = toCanvas({ x: face.bbox.x + face.bbox.width, y: face.bbox.y + face.bbox.height });
  drawFaceSpaceBox(ctx, canonical, toCanvas);
  const points = [
    ["LE", semantic.leftEyeCenter],
    ["RE", semantic.rightEyeCenter],
    ["NB", semantic.noseBridge],
    ["NT", semantic.noseTip],
  ] as const;
  ctx.save();
  if (boxTopLeft && boxBottomRight) {
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "rgba(53,208,127,.9)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(boxTopLeft.x, boxTopLeft.y, boxBottomRight.x - boxTopLeft.x, boxBottomRight.y - boxTopLeft.y);
    ctx.setLineDash([]);
  }
  ctx.lineWidth = 2;
  ctx.font = "11px ui-monospace, monospace";
  for (const [label, point] of points) {
    const p = toCanvas(point);
    if (!p) continue;
    ctx.fillStyle = label === "NB" || label === "NT" ? "#ffd166" : "#35d07f";
    ctx.strokeStyle = "rgba(0,0,0,.8)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillText(label, p.x + 7, p.y - 7);
  }
  const left = toCanvas(semantic.leftEyeCenter);
  const right = toCanvas(semantic.rightEyeCenter);
  if (left && right) {
    ctx.strokeStyle = "#35d07f";
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
    const distance = Math.hypot(right.x - left.x, right.y - left.y);
    diagnosticBaseReadout = [
      `olhos: ${Math.round(distance)} px`,
      `pose: yaw ${Math.round(face.pose.yaw * 180 / Math.PI)}° · pitch ${Math.round(face.pose.pitch * 180 / Math.PI)}°`,
      `confiança: ${Math.round(face.pose.confidence * 100)}%`,
      "rosto → GLB: olhos → lentes · ponte → bridge · nariz → nosepads",
      canonical ? `frame 3D: ${canonical.width.toFixed(3)} × ${canonical.height.toFixed(3)} · origem ${canonical.origin.x.toFixed(2)},${canonical.origin.y.toFixed(2)}` : "frame 3D: aguardando âncoras",
      lensAnchors ? `GLB: distância entre lentes ${(lensAnchors * 1000).toFixed(0)} mm · escala comparável` : "GLB: âncoras de lentes ausentes",
    ].join("\n");
    diagnosticReadout.textContent = diagnosticBaseReadout;
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Toast Notifications
// ---------------------------------------------------------------------------

function showToast(message: string, type: "info" | "error" | "success" | "warning" = "info"): void {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 300ms ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---------------------------------------------------------------------------
// Glasses Selector UI
// ---------------------------------------------------------------------------

function renderGlassesList(): void {
  glassesList.innerHTML = "";
  ALL_GLASSES.forEach((glasses, index) => {
    const isSelected = index === selectedGlassesIndex;
    const card = document.createElement("div");
    card.className = "glasses-card" + (isSelected ? " selected" : "");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-pressed", String(isSelected));

    const iconDiv = document.createElement("div");
    iconDiv.className = "glasses-card-icon";
    iconDiv.textContent = GLASSES_ICONS[glasses.id] ?? "👓";
    card.appendChild(iconDiv);

    const nameDiv = document.createElement("div");
    nameDiv.className = "glasses-card-name";
    nameDiv.textContent = glasses.name;
    card.appendChild(nameDiv);

    const handleActivate = () => switchGlasses(index);
    card.addEventListener("click", handleActivate);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleActivate();
      }
    });

    glassesList.appendChild(card);
  });
}

async function switchGlasses(index: number): Promise<void> {
  if (index === selectedGlassesIndex || !sdk) return;
  selectedGlassesIndex = index;
  resetSessionCalibration();
  renderGlassesList();

  const glasses = ALL_GLASSES[index];
  glassesName.textContent = glasses.name;
  glassesPrice.textContent = `¥${glasses.metadata?.price ?? "—"}`;
  glassesInfo.classList.remove("hidden");

  try {
    await sdk.switchGlasses(glasses);
    showToast(`Switched to ${glasses.name}`, "success");
  } catch (err) {
    showToast(`Failed to load ${glasses.name}`, "error");
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// Performance Stats Update
// ---------------------------------------------------------------------------

function updatePerformanceStats(stats: PerformanceStats): void {
  statFps.textContent = String(stats.fps);
  statDetect.textContent = `${stats.detectLatencyMs}ms`;
  statRender.textContent = `${stats.renderLatencyMs}ms`;
}

function updateTrackingStatus(tracking: boolean): void {
  if (tracking) {
    trackingDot.className = "stat-dot tracking";
    trackingText.textContent = "Tracking";
    faceHint.classList.add("hidden");
  } else {
    trackingDot.className = "stat-dot lost";
    trackingText.textContent = "Lost";
    faceHint.classList.remove("hidden");
  }
}

// ---------------------------------------------------------------------------
// Face Shape Analysis
// ---------------------------------------------------------------------------

async function handleAnalyzeFaceShape(): Promise<void> {
  if (!sdk || isAnalyzing) return;
  isAnalyzing = true;
  btnAnalyze.style.opacity = "0.5";
  showToast("Analyzing face shape... Please look at the camera.", "info");

  try {
    const result = await sdk.analyzeFaceShape();
    showShapeResult(result);
    // Move focus into the modal so keyboard/screen-reader users land on a
    // dismissible control when the result dialog appears.
    modalClose.focus();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    showToast(message, "error");
    console.error(err);
  } finally {
    isAnalyzing = false;
    btnAnalyze.style.opacity = "1";
  }
}

function showShapeResult(result: FaceShapeResult): void {
  // Primary shape
  shapeIcon.textContent = SHAPE_ICONS[result.primary] ?? "❓";
  shapeName.textContent = result.primary;
  shapeConfidence.textContent = `Confidence: ${(result.confidence * 100).toFixed(1)}%`;

  // Candidates with bars
  shapeCandidates.innerHTML = "";
  result.candidates.forEach((candidate) => {
    const row = document.createElement("div");
    row.className = "candidate-row";
    const scorePercent = (candidate.score * 100).toFixed(1);

    const nameSpan = document.createElement("span");
    nameSpan.className = "candidate-name";
    nameSpan.textContent = candidate.shape;
    row.appendChild(nameSpan);

    const barDiv = document.createElement("div");
    barDiv.className = "candidate-bar";
    const barFill = document.createElement("div");
    barFill.className = "candidate-bar-fill";
    barFill.style.width = `${candidate.score * 100}%`;
    barDiv.appendChild(barFill);
    row.appendChild(barDiv);

    const scoreSpan = document.createElement("span");
    scoreSpan.className = "candidate-score";
    scoreSpan.textContent = `${scorePercent}%`;
    row.appendChild(scoreSpan);

    shapeCandidates.appendChild(row);
  });

  // Metrics grid
  const m = result.metrics;
  metricsGrid.innerHTML = "";
  const metrics: Array<[string, string]> = [
    ["Face Width", m.faceWidth?.toFixed(1) ?? "—"],
    ["Cheekbone Width", m.cheekboneWidth?.toFixed(1) ?? "—"],
    ["Jaw Width", m.jawWidth?.toFixed(1) ?? "—"],
    ["Eye Distance", m.eyeOuterDistance?.toFixed(1) ?? "—"],
    ["W/H Ratio", m.widthHeightRatio?.toFixed(3) ?? "—"],
    ["Jaw/Cheek Ratio", m.jawCheekRatio?.toFixed(3) ?? "—"],
    ["Chin Type", m.chinType ?? "—"],
    ["Quality", m.measurementQuality != null ? `${(m.measurementQuality * 100).toFixed(0)}%` : "—"],
  ];

  metrics.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "metric-item";
    const labelSpan = document.createElement("span");
    labelSpan.className = "metric-label";
    labelSpan.textContent = label;
    item.appendChild(labelSpan);
    const valueSpan = document.createElement("span");
    valueSpan.className = "metric-value";
    valueSpan.textContent = value;
    item.appendChild(valueSpan);
    metricsGrid.appendChild(item);
  });

  // Warnings
  if (result.warnings && result.warnings.length > 0) {
    warningsList.innerHTML = "";
    result.warnings.forEach((w) => {
      const li = document.createElement("li");
      li.textContent = w;
      warningsList.appendChild(li);
    });
    shapeWarnings.classList.remove("hidden");
  } else {
    shapeWarnings.classList.add("hidden");
  }

  // Show recommendations if recommender is available
  if (recommender) {
    try {
      const recommendations = recommender.recommend({
        faceShape: result,
        faceMetrics: result.metrics,
        inventory: ALL_GLASSES.map((g): GlassesItem => ({
          id: g.id,
          name: g.name,
          brand: g.metadata?.brand,
          thumbnailUrl: g.thumbnailUrl ?? "",
          modelUrl: g.modelUrl,
          manifest: g,
          shapeCategory: g.metadata?.shapeCategory ?? "rectangle",
          dimensions: {
            frameWidthMm: g.dimensions.frameWidthMm,
            lensWidthMm: g.dimensions.lensWidthMm,
            lensHeightMm: g.dimensions.lensHeightMm,
            bridgeWidthMm: g.dimensions.bridgeWidthMm,
          },
          material: g.material?.frameMaterial,
          colors: g.metadata?.colors,
          price: g.metadata?.price,
        })),
      });
      if (recommendations.length > 0) {
        showToast(`Recommended: ${recommendations[0].item.name}`, "success");
      }
    } catch {
      // Recommendation is optional, ignore errors
    }
  }

  shapeModal.classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

async function handleSnapshot(): Promise<void> {
  if (!sdk) return;
  try {
    const result = await sdk.snapshot({ format: "image/png" });
    // Download the snapshot
    const link = document.createElement("a");
    link.download = `visutry-snapshot-${Date.now()}.png`;
    link.href = result.dataUrl;
    link.click();
    showToast("Snapshot saved!", "success");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Snapshot failed";
    showToast(message, "error");
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// Camera Switch
// ---------------------------------------------------------------------------

async function handleSwitchCamera(): Promise<void> {
  if (!sdk) return;
  currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
  try {
    sdk.stopCamera();
    // Recreate with new facing mode — the SDK facade doesn't expose a direct
    // switchCamera method, so we stop and start with new config. In a production
    // app you'd re-initialize or use the camera provider's switchCamera.
    showToast("Camera switched. Reloading...", "info");
    setTimeout(() => window.location.reload(), 500);
  } catch (err) {
    showToast("Failed to switch camera", "error");
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// Modal Close
// ---------------------------------------------------------------------------

function closeModal(): void {
  shapeModal.classList.add("hidden");
  // Return focus to the control that opened the modal so keyboard users keep a
  // logical focus order after dismissing the dialog.
  btnAnalyze.focus();
}

// ---------------------------------------------------------------------------
// Main Initialization
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  try {
    loadingText.textContent = "Loading VisuTry SDK...";

    // Create SDK instance
    sdk = createVisuTryWebSDK({
      canvas: canvas,
      fitting: {
        // Use MediaPipe's full face transform so the glasses plane follows
        // the same 3D heading as the diagnostic face mask in profile.
        useTransformationMatrix: true,
        // MediaPipe matrix translation uses camera-space units, while the
        // orthographic renderer uses render-world units. Keep matrix
        // orientation but derive a compatible relative depth from the nose.
        depthStrategy: "noseTip",
      },
      camera: {
        facingMode: currentFacingMode,
        width: 640,
        height: 480,
        frameRate: 30,
      },
      tracker: {
        mode: "batterySaver",
        maxFaces: 1,
        enableTransformationMatrix: true,
      },
      mediaPipeOptions: {
        wasmPath: "/mediapipe",
        modelAssetPath: "/mediapipe/face_landmarker.task",
      },
      renderer: {
        width: 640,
        height: 480,
        mirror: true,
        background: "transparent",
      },
      privacy: {
        processOnDeviceOnly: true,
        allowSnapshotExport: true,
        allowAnalytics: false,
      },
    });

    // Initialize recommender
    recommender = new Recommender();

    // Set up event listeners
    sdk.on("error", (err) => {
      const detail = err instanceof Error ? err.message : JSON.stringify(err, Object.getOwnPropertyNames(err));
      console.error("SDK Error:", detail);
      showToast(detail || "Erro desconhecido do SDK", "error");
    });

    btnDiagnostic.addEventListener("click", () => {
      diagnosticEnabled = !diagnosticEnabled;
      btnDiagnostic.setAttribute("aria-pressed", String(diagnosticEnabled));
      stage.classList.toggle("diagnostic-active", diagnosticEnabled);
      if (!diagnosticEnabled) {
        landmarkOverlay.clear();
        diagnosticReadout.textContent = "";
        diagnosticBaseReadout = "";
      }
    });

    sdk.on("faceDetected", (face) => {
      updateTrackingStatus(true);
      lastFace = face;
      if (diagnosticEnabled && face) {
        const video = document.getElementById("camera-video") as HTMLVideoElement | null;
        landmarkOverlay.renderFromFace(face, video?.videoWidth || 640, video?.videoHeight || 480);
        drawCalibrationGuides(face);
      }
    });

    sdk.on("poseUpdated", (pose) => {
      lastPose = pose;
      if (lastFace) autoCalibrateOrigin(lastFace, pose);
      if (diagnosticEnabled && lastFace) updateAlignmentReadout(lastFace, pose);
    });

    sdk.on("faceLost", () => {
      updateTrackingStatus(false);
      if (diagnosticEnabled) {
        landmarkOverlay.clear();
        diagnosticReadout.textContent = "Rosto não detectado";
        diagnosticBaseReadout = "Rosto não detectado";
      }
    });

    sdk.on("performanceUpdated", (stats) => {
      updatePerformanceStats(stats);
    });

    loadingText.textContent = "Initializing SDK (loading MediaPipe model)...";

    // Initialize SDK
    await sdk.initialize();

    loadingText.textContent = "Starting camera...";

    // Start camera and try-on
    await sdk.startCamera();
    await sdk.startTryOn();

    // Load default glasses
    await sdk.loadGlasses(ALL_GLASSES[0]);
    glassesName.textContent = ALL_GLASSES[0].name;
    glassesPrice.textContent = `¥${ALL_GLASSES[0].metadata?.price ?? "—"}`;
    glassesInfo.classList.remove("hidden");

    // Render glasses selector
    renderGlassesList();

    // Hide loading overlay
    loadingOverlay.classList.add("hidden");

    showToast("VisuTry SDK ready!", "success");
  } catch (err) {
    loadingText.textContent = "Failed to initialize";
    const message = err instanceof Error ? err.message : JSON.stringify(err, Object.getOwnPropertyNames(err));
    console.error("Init error:", message);
    setTimeout(() => {
      loadingOverlay.querySelector(".spinner")?.remove();
      const blockedByWasmPolicy = message.includes("WebAssembly") && message.includes("unsafe-eval");
      loadingText.textContent = blockedByWasmPolicy
        ? "VisuTry bloqueado neste navegador: o rastreador WebAssembly exige um navegador com WASM permitido. Abra este endereço no Chrome ou Edge."
        : `Error: ${message}`;
      loadingText.style.color = "#ef4444";
    }, 100);
  }
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------

btnAnalyze.addEventListener("click", handleAnalyzeFaceShape);
btnSnapshot.addEventListener("click", handleSnapshot);
btnSwitchCamera.addEventListener("click", handleSwitchCamera);
modalClose.addEventListener("click", closeModal);
document.querySelector(".modal-backdrop")?.addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// Prevent body scroll on mobile
document.addEventListener("touchmove", (e) => {
  const target = e.target as Element | null;
  if (target?.closest(".modal-content") || target?.closest(".glasses-list")) return;
  e.preventDefault();
}, { passive: false });

// Clean up on page unload
window.addEventListener("beforeunload", () => {
  sdk?.destroy();
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

init();
