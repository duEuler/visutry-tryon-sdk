import { type ComponentContainer } from "golden-layout";
import { bindAccordion, createDefaultStudioLayout, createGoldenLayoutStudio, createLocalStoragePersistence, createPanelShell, renderAccordion, type StudioPanelDefinition, type StudioRuntimeAdapter } from "@visutry/studio";
import type { VisuTrySDK } from "@visutry/tryon-core";
import "./styles.css";
import "./collapse.css";
import "./layout-fix.css";
import "./accordion-scroll.css";
import "./viewport-layout.css";
import "./runtime-canvas.css";

const persistence = createLocalStoragePersistence("visutry-golden-layout-state-v7", 7);
type Panel = { eyebrow: string; title: string; body: string };
const panels: Record<string, Panel> = {
  camera: { eyebrow: "01 / CAPTURA", title: "Câmera", body: `<div class="metric-grid"><div class="metric"><label>Fonte</label><strong>Integrated Webcam</strong></div><div class="metric"><label>Estado</label><strong class="status">● Ativa</strong></div><div class="metric"><label>Resolução</label><strong>640 × 480</strong></div><div class="metric"><label>FPS alvo</label><strong>30</strong></div></div>` },
  diagnostics: { eyebrow: "02 / OBSERVAÇÃO", title: "Diagnóstico", body: `<div class="gl-row"><span>Landmarks e overlay</span><strong class="status">ATIVO</strong></div><div class="gl-row"><span>Readout sobre o vídeo</span><strong>ATIVO</strong></div><div class="gl-row"><span>Curva de erro</span><strong>ATIVO</strong></div><div class="gl-row"><span>Snapshots manuais</span><strong>DESATIVADO</strong></div>` },
  quality: { eyebrow: "03 / QUALIDADE", title: "Tracking quality", body: `<div class="metric-grid"><div class="metric"><label>Confiança</label><strong>95%</strong></div><div class="metric"><label>Rosto</label><strong class="status">Detectado</strong></div><div class="metric"><label>Estabilidade</label><strong>0.98</strong></div><div class="metric"><label>Latência</label><strong>19.9 ms</strong></div></div>` },
  error: { eyebrow: "04 / MÉTRICAS", title: "Curva de erro", body: `<div class="visual" style="height:120px"><svg viewBox="0 0 300 100" width="100%" height="100%"><polyline fill="none" stroke="#43e39b" stroke-width="2" points="0,72 30,64 60,67 90,50 120,55 150,35 180,46 210,40 240,48 270,22 300,30"/></svg></div><p>atual <b>0.679 mm</b> · média 0.82 mm · status <span class="status">OK</span></p>` },
  live: { eyebrow: "PALCO CENTRAL", title: "Live 3D / Face overlay", body: `<div id="stage" class="visual"><canvas class="studio-live-canvas" aria-label="Canvas Live 3D"></canvas><div class="face-wire"><div class="glasses"></div></div><span style="position:absolute;bottom:10px;left:12px;color:#6f89a6">rosto ciano · GLB âmbar · anchors verdes</span></div>` },
  viewports: { eyebrow: "GEOMETRIA", title: "Viewports 3D", body: `<div class="viewport-grid">${["FRONT","TOP","LEFT","RIGHT"].map((v) => `<div class="mini"><strong>${v}</strong><div class="visual"><div class="face-wire small"><div class="glasses"></div></div></div><small>3D ao vivo · agora</small></div>`).join("")}</div>` },
  glb: { eyebrow: "OBJETIVO", title: "GLB objective", body: `<div class="gl-row"><span>Modelo</span><strong>Classic Aviator</strong></div><div class="gl-row"><span>Arquivo</span><strong>classic_aviator.glb</strong></div><div class="gl-row"><span>Dimensões</span><strong>150 × 58 × 50 mm</strong></div><div class="gl-row"><span>Escala</span><strong>0.213 (livre)</strong></div><div class="gl-row"><span>Visibilidade</span><strong class="status">Exibindo</strong></div>` },
  overlay: { eyebrow: "ALINHAMENTO", title: "Overlay & alignment", body: `<div class="gl-row"><span>Posição</span><strong>-0.288 · 0.130 · -0.002</strong></div><div class="gl-row"><span>Rotação</span><strong>-32.7° · 5.1° · 0.0°</strong></div><div class="gl-row"><span>Modo</span><strong>Eyes Center</strong></div><div class="gl-row"><span>Erro RMS</span><strong class="status">0.679 mm</strong></div>` },
  pose: { eyebrow: "LEITURA ESPACIAL", title: "Pose & landmarks", body: `<div class="gl-row"><span>Yaw / Pitch / Roll</span><strong>-32.7° / 5.1° / 0.0°</strong></div><div class="gl-row"><span>Landmarks</span><strong>478 / 478</strong></div><div class="gl-row"><span>Interpupilar</span><strong>64.2 px</strong></div><div class="gl-row"><span>Bounding box</span><strong>19.7 × 32.4%</strong></div>` },
  metrics: { eyebrow: "PERFORMANCE", title: "Render metrics", body: `<div class="gl-row"><span>Draw calls</span><strong>124</strong></div><div class="gl-row"><span>Triangles</span><strong>25,566</strong></div><div class="gl-row"><span>Frame time</span><strong>0.3 ms</strong></div><div class="gl-row"><span>DPR / canvas</span><strong>1.0 / 926 × 621</strong></div>` },
  evidence: { eyebrow: "EVIDÊNCIAS", title: "Evidence timeline", body: `<div class="timeline"><div class="thumb">10:15:23</div><div class="thumb">10:15:24</div><div class="thumb best">BEST · 10:15:26</div><div class="thumb">10:15:27</div><div class="thumb">10:15:28</div></div>` },
  selected: { eyebrow: "FRAME SELECIONADO", title: "Selected frame", body: `<div class="gl-row"><span>Time</span><strong>10:15:26.120</strong></div><div class="gl-row"><span>RMS Error</span><strong class="status">0.679 mm</strong></div><div class="gl-row"><span>Confidence</span><strong>95%</strong></div><div class="gl-row"><span>Pose</span><strong>-32.7° / 5.1° / 0.0°</strong></div><div class="gl-row"><span>Notes</span><strong>Optimal alignment</strong></div>` },
};
function accordion(ids: string[]) { return renderAccordion(ids.map((id) => ({ id, title: panels[id].title, body: panels[id].body }))); }
panels.leftDock = { eyebrow: "AUDITORIA", title: "Captura e diagnóstico", body: accordion(["camera", "diagnostics", "quality", "error"]) };
panels.rightDock = { eyebrow: "LEITURA ESPACIAL", title: "Auditoria do objetivo", body: accordion(["glb", "overlay", "pose", "metrics"]) };
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
