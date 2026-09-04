import { type ComponentContainer } from "golden-layout";
import { bindAccordion, createDefaultStudioLayout, createGoldenLayoutStudio, createLocalStoragePersistence, createPanelShell, renderEvidenceTimeline, type AuditSnapshot, type StudioPanelDefinition, type StudioRuntimeAdapter } from "@visutry/studio";
import { panels, accordionBody } from "./panel-catalog";
import type { VisuTrySDK } from "@visutry/tryon-core";
import "./styles.css";
import "./collapse.css";
import "./layout-fix.css";
import "./accordion-scroll.css";
import "./viewport-layout.css";
import "./runtime-canvas.css";

const persistence = createLocalStoragePersistence("visutry-golden-layout-state-v7", 7);
function accordion(ids: string[]) { return accordionBody(ids); }
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
    container.element.querySelector<HTMLElement>(".panel-body")!.innerHTML = accordion(id === "leftDock" ? ["camera", "diagnostics", "quality", "error"] : ["glb", "overlay", "pose", "metrics"]);
    bindAccordion(container);
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
cameraButton?.addEventListener("click", async () => { if (!runtimeSdk) return; cameraButton.disabled = true; try { await runtimeSdk.startCamera(); cameraButton.textContent = "Câmera ativa"; } catch { cameraButton.disabled = false; cameraButton.textContent = "Tentar câmera novamente"; } });
tryOnButton?.addEventListener("click", async () => { if (!runtimeSdk) return; try { await runtimeSdk.startTryOn(); resumeTryOnOnVisible = true; tryOnButton.textContent = "Try-on ativo"; } catch { tryOnButton.textContent = "Tentar try-on novamente"; } });
glbButton?.addEventListener("click", async () => { if (!runtimeSdk) return; glbButton.disabled = true; glbButton.textContent = "Carregando…"; try { const { default: asset } = await import("@visutry/demo-assets/glasses/aviator-classic.json"); await runtimeSdk.loadGlasses(asset); glbButton.textContent = "GLB carregado"; } catch { glbButton.disabled = false; glbButton.textContent = "Tentar GLB novamente"; } });
evidenceButton?.addEventListener("click", async () => { if (!runtimeAdapter) return; evidenceButton.disabled = true; try { await runtimeAdapter.captureEvidence?.(); evidenceButton.textContent = "Evidência capturada"; } catch { evidenceButton.disabled = false; evidenceButton.textContent = "Tentar evidência novamente"; } });
stopButton?.addEventListener("click", () => { runtimeSdk?.stopTryOn(); runtimeSdk?.stopCamera(); resumeTryOnOnVisible = false; runtimeAdapter = null; setRuntimeControls(false); if (cameraButton) cameraButton.textContent = "Iniciar câmera"; if (tryOnButton) tryOnButton.textContent = "Iniciar try-on"; if (glbButton) glbButton.textContent = "Carregar GLB"; if (evidenceButton) evidenceButton.textContent = "Capturar evidência"; });
document.addEventListener("visibilitychange", () => {
  if (!runtimeSdk) return;
  if (document.hidden) { runtimeSdk.stopTryOn(); return; }
  if (resumeTryOnOnVisible) void runtimeSdk.startTryOn().catch(() => { if (tryOnButton) tryOnButton.textContent = "Tentar try-on novamente"; });
});
window.addEventListener("beforeunload", () => studio.destroy());
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
    runtimeAdapter = createStudioRuntimeAdapter(runtimeSdk);
    await studio.connectRuntime(runtimeAdapter);
    const mode = studio.getMode();
    setRuntimeControls(mode === "connected");
    button.textContent = mode === "connected" ? "Runtime conectado" : "Runtime indisponível";
  } catch {
    button.disabled = false;
    button.textContent = "Tentar runtime novamente";
  }
});
