import { bindStudioToolbar, createDefaultPanelDefinitions, createDefaultStudioLayout, createGoldenLayoutStudio, createLocalStoragePersistence, type StudioInstance, type StudioMode, type StudioRuntimeAdapter } from "@visutry/studio";
import type { VisuTrySDK } from "@visutry/tryon-core";
import "./runtime-canvas.css";
import "@visutry/studio/styles.css";
import "@visutry/studio/golden-layout.css";
import "@visutry/studio/theme.css";

const persistence = createLocalStoragePersistence("visutry-golden-layout-state-v7", 7);
const defaultLayout = createDefaultStudioLayout();
const host = document.getElementById("layout-host"); if (!host) throw new Error("layout host ausente");
let studio!: StudioInstance;
const panelDefinitions = createDefaultPanelDefinitions({ collapsePanel: (id) => studio.collapsePanel(id), expandPanel: (id) => studio.expandPanel(id) });
studio = createGoldenLayoutStudio({ host, panels: panelDefinitions, initialLayout: defaultLayout, persistence });
studio.mount();
const toolbarBinding = bindStudioToolbar(document, studio);
if (import.meta.env.DEV) {
  (window as Window & { __visutryStudio?: typeof studio }).__visutryStudio = studio;
}
const modeLabel = document.getElementById("studio-mode");
const statusLabel = document.getElementById("studio-status");
const setStatus = (message: string) => { if (statusLabel) statusLabel.textContent = message; };
const formatRuntimeError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as { code?: unknown; message?: unknown };
    if (typeof value.code === "string" && typeof value.message === "string") return `${value.code}: ${value.message}`;
    if (typeof value.message === "string") return value.message;
    if (typeof value.code === "string") return value.code;
  }
  return "Falha no runtime";
};
const syncModeLabel = () => { if (modeLabel) modeLabel.textContent = studio.getMode(); };
const unsubscribeSnapshot = studio.subscribeSnapshot((snapshot) => { if (snapshot.error) setStatus(formatRuntimeError(snapshot.error)); });
let runtimeSdk: VisuTrySDK | null = null;
let runtimeAdapter: StudioRuntimeAdapter | null = null;
let resumeTryOnOnVisible = false;
const unsubscribePanelVisibility = studio.subscribePanelVisibility((id, visible) => {
  if (id !== "live" || !runtimeSdk) return;
  if (!visible) {
    runtimeSdk.stopTryOn();
    return;
  }
  if (resumeTryOnOnVisible && !document.hidden) void runtimeSdk.startTryOn().catch(() => {
    if (tryOnButton) tryOnButton.textContent = "Tentar try-on novamente";
  });
});
const runtimeButton = document.getElementById("connect-runtime") as HTMLButtonElement | null;
const cameraButton = document.getElementById("start-camera") as HTMLButtonElement | null;
const tryOnButton = document.getElementById("start-tryon") as HTMLButtonElement | null;
const glbButton = document.getElementById("load-glb") as HTMLButtonElement | null;
const evidenceButton = document.getElementById("capture-evidence") as HTMLButtonElement | null;
const stopButton = document.getElementById("stop-runtime") as HTMLButtonElement | null;
const setRuntimeControls = (mode: StudioMode) => {
  const ready = mode === "connected";
  const hasRuntime = mode !== "static";
  if (runtimeButton) runtimeButton.disabled = hasRuntime;
  [cameraButton, tryOnButton, glbButton, evidenceButton].forEach((button) => { if (button) button.disabled = !ready; });
  if (stopButton) stopButton.disabled = !hasRuntime;
};
const unsubscribeMode = studio.subscribeMode((mode) => { if (modeLabel) modeLabel.textContent = mode; setRuntimeControls(mode); });
cameraButton?.addEventListener("click", async () => { if (!runtimeSdk || !runtimeAdapter) return; cameraButton.disabled = true; try { await runtimeSdk.startCamera(); const video = document.querySelector<HTMLVideoElement>("#camera-video"); runtimeAdapter.setSnapshot?.({ camera: { active: true, source: "Integrated Webcam", width: video?.videoWidth || 640, height: video?.videoHeight || 480, fps: 30 } }); cameraButton.textContent = "Câmera ativa"; setStatus("Câmera iniciada"); } catch (error) { cameraButton.disabled = false; cameraButton.textContent = "Tentar câmera novamente"; setStatus(error instanceof Error ? error.message : "Falha ao iniciar câmera"); } });
tryOnButton?.addEventListener("click", async () => { if (!runtimeSdk) return; try { await runtimeSdk.startTryOn(); resumeTryOnOnVisible = true; tryOnButton.textContent = "Try-on ativo"; } catch { tryOnButton.textContent = "Tentar try-on novamente"; } });
glbButton?.addEventListener("click", async () => { if (!runtimeSdk) return; glbButton.disabled = true; glbButton.textContent = "Carregando…"; try { const { default: asset } = await import("@visutry/demo-assets/glasses/aviator-classic.json"); await runtimeSdk.loadGlasses(asset); glbButton.textContent = "GLB carregado"; setStatus("GLB carregado"); } catch (error) { glbButton.disabled = false; glbButton.textContent = "Tentar GLB novamente"; setStatus(error instanceof Error ? error.message : "Falha ao carregar GLB"); } });
evidenceButton?.addEventListener("click", async () => { if (!runtimeAdapter) return; evidenceButton.disabled = true; try { await runtimeAdapter.captureEvidence?.(); evidenceButton.textContent = "Evidência capturada"; setStatus("Evidência registrada"); } catch (error) { evidenceButton.disabled = false; evidenceButton.textContent = "Tentar evidência novamente"; setStatus(error instanceof Error ? error.message : "Falha ao capturar evidência"); } });
stopButton?.addEventListener("click", () => { runtimeSdk?.stopTryOn(); runtimeSdk?.stopCamera(); resumeTryOnOnVisible = false; runtimeSdk = null; runtimeAdapter = null; studio.disconnectRuntime(); if (cameraButton) cameraButton.textContent = "Iniciar câmera"; if (tryOnButton) tryOnButton.textContent = "Iniciar try-on"; if (glbButton) glbButton.textContent = "Carregar GLB"; if (evidenceButton) evidenceButton.textContent = "Capturar evidência"; setStatus("Runtime parado"); });
document.addEventListener("visibilitychange", () => {
  if (!runtimeSdk) return;
  if (document.hidden) { runtimeSdk.stopTryOn(); return; }
  if (resumeTryOnOnVisible) void runtimeSdk.startTryOn().catch(() => { if (tryOnButton) tryOnButton.textContent = "Tentar try-on novamente"; });
});
const stageElement = document.getElementById("stage");
const stageObserver = typeof IntersectionObserver === "function" && stageElement
  ? new IntersectionObserver(([entry]) => {
      if (!runtimeSdk || document.hidden) return;
      if (!entry.isIntersecting) {
        runtimeSdk.stopTryOn();
        return;
      }
      if (resumeTryOnOnVisible) void runtimeSdk.startTryOn().catch(() => { if (tryOnButton) tryOnButton.textContent = "Tentar try-on novamente"; });
    }, { threshold: 0.01 })
  : null;
stageObserver?.observe(stageElement);
window.addEventListener("beforeunload", () => { toolbarBinding.dispose(); unsubscribeMode(); unsubscribeSnapshot(); unsubscribePanelVisibility(); studio.destroy(); });
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
    runtimeSdk = createVisuTryWebSDK({ canvas, camera: { width: 640, height: 480, frameRate: 30, mirror: true }, privacy: { processOnDeviceOnly: true, allowSnapshotExport: true } });
    runtimeAdapter = createStudioRuntimeAdapter(runtimeSdk, { getVideo: () => document.querySelector<HTMLVideoElement>("#camera-video") });
    await studio.connectRuntime(runtimeAdapter);
    const mode = studio.getMode();
    syncModeLabel();
    setRuntimeControls(mode);
    button.textContent = mode === "connected" ? "Runtime conectado" : "Runtime indisponível";
  } catch (error) {
    button.disabled = false;
    button.textContent = "Tentar runtime novamente";
    syncModeLabel();
    setStatus(error instanceof Error ? error.message : "Runtime indisponível");
  }
});
