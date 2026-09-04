import { type ComponentContainer } from "golden-layout";
import { createAccordionPanel, createDefaultStudioLayout, createGoldenLayoutStudio, createLocalStoragePersistence, createPanelShell, renderEvidenceTimeline, type AuditSnapshot, type StudioPanelDefinition, type StudioRuntimeAdapter } from "@visutry/studio";
import { panels, accordionSections } from "./panel-catalog";
import type { VisuTrySDK } from "@visutry/tryon-core";
import "./styles.css";
import "./collapse.css";
import "./layout-fix.css";
import "./accordion-scroll.css";
import "./viewport-layout.css";
import "./runtime-canvas.css";
import "@visutry/studio/styles.css";

const persistence = createLocalStoragePersistence("visutry-golden-layout-state-v7", 7);
function component(container: ComponentContainer, id: string) {
  const p = panels[id] ?? panels.camera;
  const isAccordionPanel = id === "leftDock" || id === "rightDock";
  createPanelShell({ panelId: id, getSnapshot: () => ({}) }, container, { panelId: id, body: p.body, accordion: isAccordionPanel });
  const item = container.element.closest<HTMLElement>(".lm_item");
  const controls = item?.querySelector<HTMLElement>(".lm_controls");
  if (controls && !controls.querySelector(".audit-collapse-control")) {
    const toggle = document.createElement("button");
    toggle.className = "audit-collapse-control";
    toggle.type = "button";
    toggle.textContent = "▼";
    toggle.title = "Minimizar janela";
    toggle.setAttribute("aria-label", "Minimizar janela");
    controls.prepend(toggle);
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const collapsed = item.classList.toggle("audit-collapsed");
      toggle.textContent = collapsed ? "▲" : "▼";
      toggle.title = collapsed ? "Expandir janela" : "Minimizar janela";
      toggle.setAttribute("aria-label", toggle.title);
    });
  }
  if (isAccordionPanel) {
    createAccordionPanel({ panelId: id, getSnapshot: () => ({}) }, container, accordionSections(id === "leftDock" ? ["camera", "diagnostics", "quality", "error"] : ["glb", "overlay", "pose", "metrics"]));
  }
}
const defaultLayout = createDefaultStudioLayout();
const host = document.getElementById("layout-host"); if (!host) throw new Error("layout host ausente");
const panelDefinitions: StudioPanelDefinition[] = Object.keys(panels).map((id) => ({
  id,
  title: panels[id].title,
  region: id === "leftDock" ? "left" : id === "rightDock" ? "right" : id === "evidence" || id === "selected" ? "bottom" : "center",
  scrollable: id === "leftDock" || id === "rightDock",
  create: (_context, container) => component(container, id),
  update: id === "evidence" ? (element, snapshot: AuditSnapshot) => {
    const items = (snapshot.evidence ?? []) as { id: string; timestamp: number }[];
    if (items.length) element.querySelector(".timeline")!.innerHTML = renderEvidenceTimeline(items.map((item) => ({ label: new Date(item.timestamp).toLocaleTimeString(), best: item.id === snapshot.selectedFrameId })));
  } : id === "selected" ? (element, snapshot: AuditSnapshot) => {
    const selected = ((snapshot.evidence ?? []) as { id: string; timestamp: number }[]).find((item) => item.id === snapshot.selectedFrameId);
    if (selected) element.querySelector(".panel-body")!.innerHTML = `<div class="gl-row"><span>Time</span><strong>${new Date(selected.timestamp).toLocaleTimeString()}</strong></div><div class="gl-row"><span>Frame</span><strong>${selected.id}</strong></div>`;
  } : undefined,
}));
const studio = createGoldenLayoutStudio({ host, panels: panelDefinitions, initialLayout: defaultLayout, persistence });
studio.mount();
if (import.meta.env.DEV) {
  (window as Window & { __visutryStudio?: typeof studio }).__visutryStudio = studio;
}
const modeLabel = document.getElementById("studio-mode");
const statusLabel = document.getElementById("studio-status");
const setStatus = (message: string) => { if (statusLabel) statusLabel.textContent = message; };
const syncModeLabel = () => { if (modeLabel) modeLabel.textContent = studio.getMode(); };
const unsubscribeMode = studio.subscribeMode((mode) => { if (modeLabel) modeLabel.textContent = mode; });
let runtimeSdk: VisuTrySDK | null = null;
let runtimeAdapter: StudioRuntimeAdapter | null = null;
let resumeTryOnOnVisible = false;
document.getElementById("save-layout")?.addEventListener("click", () => studio.saveLayout());
document.getElementById("reset-layout")?.addEventListener("click", () => studio.restoreDefaultLayout());
document.getElementById("expand-accordions")?.addEventListener("click", () => { studio.expandPanel("leftDock"); studio.expandPanel("rightDock"); });
document.getElementById("collapse-accordions")?.addEventListener("click", () => { studio.collapsePanel("leftDock"); studio.collapsePanel("rightDock"); });
document.getElementById("show-side-panels")?.addEventListener("click", () => { studio.showPanel("leftDock"); studio.showPanel("rightDock"); });
document.getElementById("hide-side-panels")?.addEventListener("click", () => { studio.hidePanel("leftDock"); studio.hidePanel("rightDock"); });
document.getElementById("toggle-layout-lock")?.addEventListener("click", (event) => { const button = event.currentTarget as HTMLButtonElement; const locked = !studio.isLayoutLocked(); studio.setLayoutLocked(locked); button.textContent = locked ? "Desbloquear layout" : "Bloquear layout"; });
const runtimeButton = document.getElementById("connect-runtime") as HTMLButtonElement | null;
const cameraButton = document.getElementById("start-camera") as HTMLButtonElement | null;
const tryOnButton = document.getElementById("start-tryon") as HTMLButtonElement | null;
const glbButton = document.getElementById("load-glb") as HTMLButtonElement | null;
const evidenceButton = document.getElementById("capture-evidence") as HTMLButtonElement | null;
const stopButton = document.getElementById("stop-runtime") as HTMLButtonElement | null;
const setRuntimeControls = (connected: boolean) => { [cameraButton, tryOnButton, glbButton, evidenceButton, stopButton].forEach((button) => { if (button) button.disabled = !connected; }); };
cameraButton?.addEventListener("click", async () => { if (!runtimeSdk) return; cameraButton.disabled = true; try { await runtimeSdk.startCamera(); cameraButton.textContent = "Câmera ativa"; setStatus("Câmera iniciada"); } catch (error) { cameraButton.disabled = false; cameraButton.textContent = "Tentar câmera novamente"; setStatus(error instanceof Error ? error.message : "Falha ao iniciar câmera"); } });
tryOnButton?.addEventListener("click", async () => { if (!runtimeSdk) return; try { await runtimeSdk.startTryOn(); resumeTryOnOnVisible = true; tryOnButton.textContent = "Try-on ativo"; } catch { tryOnButton.textContent = "Tentar try-on novamente"; } });
glbButton?.addEventListener("click", async () => { if (!runtimeSdk) return; glbButton.disabled = true; glbButton.textContent = "Carregando…"; try { const { default: asset } = await import("@visutry/demo-assets/glasses/aviator-classic.json"); await runtimeSdk.loadGlasses(asset); glbButton.textContent = "GLB carregado"; setStatus("GLB carregado"); } catch (error) { glbButton.disabled = false; glbButton.textContent = "Tentar GLB novamente"; setStatus(error instanceof Error ? error.message : "Falha ao carregar GLB"); } });
evidenceButton?.addEventListener("click", async () => { if (!runtimeAdapter) return; evidenceButton.disabled = true; try { await runtimeAdapter.captureEvidence?.(); evidenceButton.textContent = "Evidência capturada"; setStatus("Evidência registrada"); } catch (error) { evidenceButton.disabled = false; evidenceButton.textContent = "Tentar evidência novamente"; setStatus(error instanceof Error ? error.message : "Falha ao capturar evidência"); } });
stopButton?.addEventListener("click", () => { runtimeSdk?.stopTryOn(); runtimeSdk?.stopCamera(); resumeTryOnOnVisible = false; runtimeSdk = null; runtimeAdapter = null; studio.disconnectRuntime(); setRuntimeControls(false); if (cameraButton) cameraButton.textContent = "Iniciar câmera"; if (tryOnButton) tryOnButton.textContent = "Iniciar try-on"; if (glbButton) glbButton.textContent = "Carregar GLB"; if (evidenceButton) evidenceButton.textContent = "Capturar evidência"; setStatus("Runtime parado"); });
document.addEventListener("visibilitychange", () => {
  if (!runtimeSdk) return;
  if (document.hidden) { runtimeSdk.stopTryOn(); return; }
  if (resumeTryOnOnVisible) void runtimeSdk.startTryOn().catch(() => { if (tryOnButton) tryOnButton.textContent = "Tentar try-on novamente"; });
});
window.addEventListener("beforeunload", () => { unsubscribeMode(); studio.destroy(); });
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
    runtimeSdk = createVisuTryWebSDK({ canvas, privacy: { processOnDeviceOnly: true, allowSnapshotExport: true } });
    runtimeAdapter = createStudioRuntimeAdapter(runtimeSdk, { getVideo: () => document.querySelector<HTMLVideoElement>("#camera-video") });
    await studio.connectRuntime(runtimeAdapter);
    const mode = studio.getMode();
    syncModeLabel();
    setRuntimeControls(mode === "connected");
    button.textContent = mode === "connected" ? "Runtime conectado" : "Runtime indisponível";
  } catch (error) {
    button.disabled = false;
    button.textContent = "Tentar runtime novamente";
    syncModeLabel();
    setStatus(error instanceof Error ? error.message : "Runtime indisponível");
  }
});
