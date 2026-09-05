import {
  bindStudioToolbar,
  createDefaultPanelDefinitions,
  createDefaultStudioLayout,
  createGoldenLayoutStudio,
  createLocalStoragePersistence,
  type StudioInstance,
  type StudioMode,
  type StudioRuntimeAdapter,
  type AuditSnapshot,
  createFaceReconstructionSession,
  type FaceReconstructionSession,
} from "@visutry/studio";
import type { NormalizedFaceResult, VisuTrySDK } from "@visutry/tryon-core";
import "./runtime-canvas.css";
import "@visutry/studio/styles.css";
import "@visutry/studio/golden-layout.css";
import "@visutry/studio/theme.css";

const persistence = createLocalStoragePersistence("visutry-golden-layout-state-v7", 7);
const defaultLayout = createDefaultStudioLayout();
const host = document.getElementById("layout-host");
if (!host) throw new Error("layout host ausente");
// The panel callbacks close over the instance that is created immediately below.
// eslint-disable-next-line prefer-const
let studio!: StudioInstance;
const panelDefinitions = createDefaultPanelDefinitions({
  collapsePanel: (id) => studio.collapsePanel(id),
  expandPanel: (id) => studio.expandPanel(id),
});
studio = createGoldenLayoutStudio({
  host,
  panels: panelDefinitions,
  initialLayout: defaultLayout,
  persistence,
});
studio.mount();
const landmarkCanvas = document.querySelector<HTMLCanvasElement>(".studio-landmark-canvas");
let landmarkOverlay: { renderFromFace(face: NormalizedFaceResult, width: number, height: number): void; clear(): void } | null = null;
let lastFace: NormalizedFaceResult | null = null;
let lastAuditSnapshot: AuditSnapshot | null = null;
const reconstructionSession: FaceReconstructionSession = createFaceReconstructionSession({ maxFrames: 120, minConfidence: 0.45, requiredRegions: ["front", "left", "right"] });
const toolbarBinding = bindStudioToolbar(document, studio);
if (import.meta.env.DEV) {
  (window as Window & { __visutryStudio?: typeof studio }).__visutryStudio = studio;
}
const modeLabel = document.getElementById("studio-mode");
const statusLabel = document.getElementById("studio-status");
const setStatus = (message: string) => {
  if (statusLabel) statusLabel.textContent = message;
};
const formatRuntimeError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as { code?: unknown; message?: unknown };
    if (typeof value.code === "string" && typeof value.message === "string")
      return `${value.code}: ${value.message}`;
    if (typeof value.message === "string") return value.message;
    if (typeof value.code === "string") return value.code;
  }
  return "Falha no runtime";
};
const withRuntimeTimeout = async <T>(operation: Promise<T>, label: string, timeoutMs = 25000): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} excedeu o tempo limite de ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};
const syncModeLabel = () => {
  if (modeLabel) modeLabel.textContent = studio.getMode();
};
const unsubscribeSnapshot = studio.subscribeSnapshot((snapshot) => {
  lastAuditSnapshot = snapshot;
  if (snapshot.error) setStatus(formatRuntimeError(snapshot.error));
  const face = snapshot.face as NormalizedFaceResult | undefined;
  if (face?.landmarks?.raw?.length) lastFace = face;
  if (reconstructionCaptureActive && reconstructionSession.getState() !== "capturing") reconstructionSession.start();
  if (reconstructionCaptureActive && face?.landmarks?.raw?.length) {
    reconstructionSession.ingest({
      id: `frame-${Date.now()}`,
      timestamp: Date.now(),
      landmarks: face.landmarks.raw,
      connections: face.landmarks.connections?.map(([from, to]) => [from, to] as [number, number]),
      yaw: snapshot.pose?.yaw ?? 0,
      pitch: snapshot.pose?.pitch ?? 0,
      roll: snapshot.pose?.roll ?? 0,
      confidence: snapshot.tracking?.confidence ?? face.quality?.confidence ?? 1,
      stability: snapshot.tracking?.stability ?? 0,
      faceCoverage: face.bbox ? Math.min(1, Math.max(0, face.bbox.width * face.bbox.height * 3)) : undefined,
    });
    const progress = reconstructionSession.getProgress();
    const labels: Record<string, string> = { front: "Frontal", left: "Lateral esq.", right: "Lateral dir.", top: "Topo", chin: "Queixo", neck: "Pescoço", shoulders: "Ombros" };
    const done = progress.observedRegions.map((region) => `${labels[region] ?? region} ✓`).join(" · ");
    const missing = progress.missingRegions.map((region) => `${labels[region] ?? region} em captura`).join(" · ");
    const progressBar = document.querySelector<HTMLProgressElement>("#reconstruction-progress");
    if (progressBar) progressBar.value = progress.percent;
    const progressLabel = document.querySelector<HTMLElement>("#reconstruction-progress-label");
    if (progressLabel) progressLabel.textContent = `${progress.percent}% · ${progress.acceptedFrames} leituras`;
    setStatus(progress.ready ? `${done} · perspectiva suficiente; finalize para gravar` : `${done}${done && missing ? " · " : ""}${missing}`);
  }
  if (landmarkOverlay && snapshot.mode === "connected" && snapshot.tracking?.detected && lastFace?.landmarks?.raw?.length) {
    landmarkCanvas?.classList.remove("studio-runtime-hidden");
    landmarkOverlay.renderFromFace(lastFace, snapshot.camera?.width ?? 640, snapshot.camera?.height ?? 480);
  } else {
    if (!snapshot.tracking?.detected || snapshot.mode !== "connected") lastFace = null;
    landmarkOverlay?.clear();
    landmarkCanvas?.classList.add("studio-runtime-hidden");
  }
});
let runtimeSdk: VisuTrySDK | null = null;
let runtimeAdapter: StudioRuntimeAdapter | null = null;
let resumeTryOnOnVisible = false;
let cameraReady = false;
let tryOnReady = false;
let glbReady = false;
let reconstructionCaptureActive = false;
const runtimeButton = document.getElementById("connect-runtime") as HTMLButtonElement | null;
const cameraButton = document.getElementById("start-camera") as HTMLButtonElement | null;
const tryOnButton = document.getElementById("start-tryon") as HTMLButtonElement | null;
const glbButton = document.getElementById("load-glb") as HTMLButtonElement | null;
const evidenceButton = document.getElementById("capture-evidence") as HTMLButtonElement | null;
const reconstructionButton = document.getElementById("capture-reconstruction") as HTMLButtonElement | null;
const clearReconstructionButton = document.getElementById("clear-reconstruction") as HTMLButtonElement | null;
const exportReconstructionButton = document.getElementById("export-reconstruction") as HTMLButtonElement | null;
const stopButton = document.getElementById("stop-runtime") as HTMLButtonElement | null;
const setRuntimeControls = (mode: StudioMode) => {
  const ready = mode === "connected";
  const hasRuntime = mode !== "static";
  const current = (id: string) => document.getElementById(id) as HTMLButtonElement | null;
  const runtime = current("connect-runtime");
  const camera = current("start-camera");
  const tryon = current("start-tryon");
  const glb = current("load-glb");
  const evidence = current("capture-evidence");
  const reconstruction = current("capture-reconstruction");
  const clear = current("clear-reconstruction");
  const exportButton = current("export-reconstruction");
  const stop = current("stop-runtime");
  document.body.dataset.runtimeMode = mode;
  if (runtime) runtime.disabled = hasRuntime;
  [camera, tryon, glb, evidence, reconstruction, clear, exportButton].forEach((button) => {
    if (!button) return;
    button.disabled = !ready;
    button.setAttribute("aria-disabled", String(!ready));
    button.title = ready
      ? "Disponível com runtime conectado"
      : "Conecte o runtime para habilitar este recurso";
  });
  if (ready) {
    if (camera) camera.disabled = cameraReady;
    if (tryon) tryon.disabled = tryOnReady;
    if (glb) glb.disabled = glbReady;
    if (clear) clear.disabled = !reconstructionSession.getSnapshot()?.completed;
    if (exportButton) exportButton.disabled = !reconstructionSession.getSnapshot()?.completed;
  }
  if (stop) stop.disabled = !hasRuntime;
};
const applyDiagnosticVisibility = (target: string, visible: boolean) => {
  const selectors: Record<string, string> = {
    landmarks: '#stage .face-wire, #stage .studio-landmark-canvas',
    readout: '#stage .studio-runtime-caption',
    error: '[data-panel-id="leftDock"] [data-accordion-id="error"]',
    snapshots: '[data-panel-id="evidence"]',
  };
  const selector = selectors[target];
  if (!selector) return;
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.classList.toggle("studio-diagnostic-hidden", !visible);
  });
};
document.querySelectorAll<HTMLInputElement>("[data-diagnostic-toggle]").forEach((control) => {
  applyDiagnosticVisibility(control.dataset.diagnosticToggle ?? "", control.checked);
  control.addEventListener("change", () => applyDiagnosticVisibility(control.dataset.diagnosticToggle ?? "", control.checked));
});
const unsubscribeMode = studio.subscribeMode((mode) => {
  if (modeLabel) modeLabel.textContent = mode;
  setRuntimeControls(mode);
});
cameraButton?.addEventListener("click", async () => {
  if (!runtimeSdk || !runtimeAdapter) return;
  cameraButton.disabled = true;
  try {
    await runtimeSdk.startCamera();
    const video = document.querySelector<HTMLVideoElement>("#camera-video");
    runtimeAdapter.setSnapshot?.({
      camera: {
        active: true,
        source: "Integrated Webcam",
        width: video?.videoWidth || 640,
        height: video?.videoHeight || 480,
        fps: 30,
      },
    });
    cameraButton.textContent = "Câmera ativa";
    cameraReady = true;
    setStatus("Câmera iniciada");
  } catch (error) {
    cameraButton.disabled = false;
    cameraButton.textContent = "Tentar câmera novamente";
    setStatus(error instanceof Error ? error.message : "Falha ao iniciar câmera");
  }
});
tryOnButton?.addEventListener("click", async () => {
  if (!runtimeSdk) return;
  try {
    await runtimeSdk.startTryOn();
    resumeTryOnOnVisible = true;
    tryOnReady = true;
    tryOnButton.disabled = true;
    tryOnButton.textContent = "Try-on ativo";
  } catch {
    tryOnButton.textContent = "Tentar try-on novamente";
  }
});
glbButton?.addEventListener("click", async () => {
  if (!runtimeSdk) return;
  glbButton.disabled = true;
  glbButton.textContent = "Carregando…";
  try {
    const { default: asset } = await import("@visutry/demo-assets/glasses/aviator-classic.json");
    await runtimeSdk.loadGlasses(asset);
    glbReady = true;
    glbButton.textContent = "GLB carregado";
    setStatus("GLB carregado");
  } catch (error) {
    glbButton.disabled = false;
    glbButton.textContent = "Tentar GLB novamente";
    setStatus(error instanceof Error ? error.message : "Falha ao carregar GLB");
  }
});
evidenceButton?.addEventListener("click", async () => {
  if (!runtimeAdapter) return;
  evidenceButton.disabled = true;
  try {
    await runtimeAdapter.captureEvidence?.();
    evidenceButton.textContent = "Evidência capturada";
    setStatus("Evidência registrada");
  } catch (error) {
    evidenceButton.disabled = false;
    evidenceButton.textContent = "Tentar evidência novamente";
    setStatus(error instanceof Error ? error.message : "Falha ao capturar evidência");
  }
});
document.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("#capture-reconstruction");
  if (!button || !runtimeAdapter || studio.getMode() !== "connected") return;
  if (reconstructionSession.getState() === "capturing") {
    const progress = reconstructionSession.getProgress();
    if (!reconstructionSession.canFinish()) {
      const labels: Record<string, string> = { front: "frente", left: "lado esquerdo", right: "lado direito" };
      button.textContent = "Finalizar reconstrução";
      button.title = "Ainda falta capturar os ângulos indicados";
      setStatus(`Continue girando o rosto: falta ${progress.missingRegions.map((region) => labels[region] ?? region).join(" e ")}`);
      return;
    }
    const reconstruction = reconstructionSession.finish();
    if (reconstruction.capturedFrames === 0) {
      runtimeAdapter.setSnapshot?.({ reconstruction: null });
      button.textContent = "Capturar reconstrução";
      setStatus("Nenhuma leitura aceita; mantenha o rosto visível e tente novamente");
      return;
    }
    runtimeAdapter.setSnapshot?.({ reconstruction });
    reconstructionCaptureActive = false;
    button.textContent = "Reconstrução congelada";
    button.title = `Cobertura ${Math.round(reconstruction.coverage * 100)}%`;
    if (clearReconstructionButton) clearReconstructionButton.disabled = false;
    if (exportReconstructionButton) exportReconstructionButton.disabled = false;
    setStatus(`Reconstrução concluída · ${Math.round(reconstruction.coverage * 100)}% de cobertura`);
    return;
  }
  reconstructionSession.start();
  reconstructionCaptureActive = true;
  const progressBar = document.querySelector<HTMLProgressElement>("#reconstruction-progress");
  if (progressBar) progressBar.value = 0;
  const progressLabel = document.querySelector<HTMLElement>("#reconstruction-progress-label");
  if (progressLabel) progressLabel.textContent = "0% · aguardando ângulos";
  if (lastFace?.landmarks?.raw?.length) {
    reconstructionSession.ingest({
      id: `frame-${Date.now()}-initial`,
      timestamp: Date.now(),
      landmarks: lastFace.landmarks.raw,
      connections: lastFace.landmarks.connections?.map(([from, to]) => [from, to] as [number, number]),
      yaw: lastAuditSnapshot?.pose?.yaw ?? 0,
      pitch: lastAuditSnapshot?.pose?.pitch ?? 0,
      roll: lastAuditSnapshot?.pose?.roll ?? 0,
      confidence: lastAuditSnapshot?.tracking?.confidence ?? lastFace.quality?.confidence ?? 1,
      stability: lastAuditSnapshot?.tracking?.stability ?? lastFace.quality?.stabilityScore ?? 0,
      faceCoverage: lastFace.bbox ? Math.min(1, Math.max(0, lastFace.bbox.width * lastFace.bbox.height * 3)) : undefined,
    });
  }
  runtimeAdapter.setSnapshot?.({ reconstruction: null });
  if (clearReconstructionButton) clearReconstructionButton.disabled = true;
  if (exportReconstructionButton) exportReconstructionButton.disabled = true;
  button.textContent = "Finalizar reconstrução";
  button.title = "Finalize após girar o rosto para os ângulos desejados";
  button.setAttribute("aria-label", "Finalizar reconstrução 3D");
  setStatus("Capturando ângulos: frente, topo, esquerda e direita");
});
clearReconstructionButton?.addEventListener("click", () => {
  if (!runtimeAdapter || studio.getMode() !== "connected") return;
  reconstructionSession.cancel();
  reconstructionCaptureActive = false;
  runtimeAdapter.setSnapshot?.({ reconstruction: null });
    if (reconstructionButton) { reconstructionButton.textContent = "Capturar reconstrução"; reconstructionButton.setAttribute("aria-label", "Capturar reconstrução 3D"); }
  clearReconstructionButton.disabled = true;
  if (exportReconstructionButton) exportReconstructionButton.disabled = true;
  setStatus("Reconstrução limpa");
});
exportReconstructionButton?.addEventListener("click", () => {
  const reconstruction = reconstructionSession.getSnapshot();
  if (!reconstruction?.completed) return;
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), reconstruction }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "visutry-face-calibration.json";
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("Snapshot de calibração exportado");
});
stopButton?.addEventListener("click", () => {
  runtimeSdk?.stopTryOn();
  runtimeSdk?.stopCamera();
  resumeTryOnOnVisible = false;
  runtimeSdk = null;
  runtimeAdapter = null;
  cameraReady = false;
  tryOnReady = false;
  glbReady = false;
  studio.disconnectRuntime();
  if (cameraButton) cameraButton.textContent = "Iniciar câmera";
  if (tryOnButton) tryOnButton.textContent = "Iniciar try-on";
  if (glbButton) glbButton.textContent = "Carregar GLB";
  if (evidenceButton) evidenceButton.textContent = "Capturar evidência";
  reconstructionSession.cancel();
  reconstructionCaptureActive = false;
  if (reconstructionButton) { reconstructionButton.textContent = "Capturar reconstrução"; reconstructionButton.setAttribute("aria-label", "Capturar reconstrução 3D"); }
  if (clearReconstructionButton) clearReconstructionButton.disabled = true;
  if (exportReconstructionButton) exportReconstructionButton.disabled = true;
  setStatus("Runtime parado; dados limpos");
});
document.addEventListener("visibilitychange", () => {
  if (!runtimeSdk || document.hidden || !resumeTryOnOnVisible) return;
  // Live 3D intentionally remains active; only the Viewports can be frozen.
});
const stageElement = document.getElementById("stage");
const stageObserver =
  typeof IntersectionObserver === "function" && stageElement
    ? new IntersectionObserver(
        ([entry]) => {
          if (!runtimeSdk || document.hidden || !entry.isIntersecting) return;
          // Do not stop Live 3D when its panel is outside the viewport.
        },
        { threshold: 0.01 },
      )
    : null;
stageObserver?.observe(stageElement);
window.addEventListener("beforeunload", () => {
  toolbarBinding.dispose();
  unsubscribeMode();
  unsubscribeSnapshot();
  studio.destroy();
});
window.addEventListener("beforeunload", () => stageObserver?.disconnect());
document.getElementById("connect-runtime")?.addEventListener("click", async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  const canvas = document.querySelector<HTMLCanvasElement>(".studio-live-canvas");
  if (!canvas) return;
  button.disabled = true;
  button.textContent = "Conectando…";
  try {
    const { createVisuTryWebSDK, createStudioRuntimeAdapter } = await import("@visutry/tryon-web");
    // Snapshot export is available only through the explicit evidence button;
    // all camera and tracking processing remains on-device.
    runtimeSdk = createVisuTryWebSDK({
      canvas,
      camera: { width: 640, height: 480, frameRate: 30, mirror: true },
      privacy: { processOnDeviceOnly: true, allowSnapshotExport: true },
    });
    runtimeAdapter = createStudioRuntimeAdapter(runtimeSdk, {
      getVideo: () => document.querySelector<HTMLVideoElement>("#camera-video"),
    });
    const { LandmarkOverlay } = await import("@visutry/tryon-web");
    landmarkOverlay = landmarkCanvas ? new LandmarkOverlay(landmarkCanvas, {
      tesselationColor: "rgba(104, 183, 224, 0.48)",
      contourColor: "rgba(66, 218, 238, 0.92)",
      irisColor: "rgba(242, 177, 74, 0.9)",
      highlightColor: "#39dca2",
    }) : null;
    await withRuntimeTimeout(studio.connectRuntime(runtimeAdapter), "Inicialização do runtime");
    // Fast path for the desktop Studio: connect all runtime capabilities in sequence.
    await withRuntimeTimeout(runtimeSdk.startCamera(), "Inicialização da câmera");
    const video = document.querySelector<HTMLVideoElement>("#camera-video");
    runtimeAdapter.setSnapshot?.({
      camera: {
        active: true,
        source: "Integrated Webcam",
        width: video?.videoWidth || 640,
        height: video?.videoHeight || 480,
        fps: 30,
      },
    });
    if (cameraButton) {
      cameraButton.disabled = true;
      cameraButton.textContent = "Câmera ativa";
    }
    cameraReady = true;
    await withRuntimeTimeout(runtimeSdk.startTryOn(), "Inicialização do try-on");
    resumeTryOnOnVisible = true;
    tryOnReady = true;
    if (tryOnButton) {
      tryOnButton.disabled = true;
      tryOnButton.textContent = "Try-on ativo";
    }
    const { default: asset } = await import("@visutry/demo-assets/glasses/aviator-classic.json");
    await withRuntimeTimeout(runtimeSdk.loadGlasses(asset), "Carregamento do GLB");
    glbReady = true;
    if (glbButton) {
      glbButton.disabled = true;
      glbButton.textContent = "GLB carregado";
    }
    setStatus("Câmera, try-on e GLB ativos");
    // Start collecting angular coverage immediately after connection. This
    // does not create the 3D model; it only waits for front/left/right views.
    reconstructionCaptureActive = true;
    if (reconstructionSession.getState() !== "capturing") reconstructionSession.start();
    const progressBar = document.querySelector<HTMLProgressElement>("#reconstruction-progress");
    if (progressBar) progressBar.value = 0;
    const progressLabel = document.querySelector<HTMLElement>("#reconstruction-progress-label");
    if (progressLabel) progressLabel.textContent = "0% · vire o rosto para os lados";
    const mode = studio.getMode();
    syncModeLabel();
    setRuntimeControls(mode);
    button.textContent = mode === "connected" ? "Runtime conectado" : "Runtime indisponível";
  } catch (error) {
    const failure = error instanceof Error ? error : new Error("Runtime indisponível");
    runtimeAdapter?.setSnapshot?.({ mode: "degraded", error: failure });
    runtimeSdk?.stopTryOn();
    runtimeSdk?.stopCamera();
    resumeTryOnOnVisible = false;
    landmarkOverlay?.clear();
    landmarkCanvas?.classList.add("studio-runtime-hidden");
    button.disabled = false;
    button.textContent = "Tentar runtime novamente";
    syncModeLabel();
    setStatus(failure.message);
  }
});
