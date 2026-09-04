import { GoldenLayout, type LayoutConfig, type ComponentContainer } from "golden-layout";
import "./styles.css";
import "./collapse.css";
import "./layout-fix.css";

const key = "visutry-golden-layout-state-v5";
type Panel = { eyebrow: string; title: string; body: string };
const panels: Record<string, Panel> = {
  camera: { eyebrow: "01 / CAPTURA", title: "Câmera", body: `<div class="metric-grid"><div class="metric"><label>Fonte</label><strong>Integrated Webcam</strong></div><div class="metric"><label>Estado</label><strong class="status">● Ativa</strong></div><div class="metric"><label>Resolução</label><strong>640 × 480</strong></div><div class="metric"><label>FPS alvo</label><strong>30</strong></div></div>` },
  diagnostics: { eyebrow: "02 / OBSERVAÇÃO", title: "Diagnóstico", body: `<div class="gl-row"><span>Landmarks e overlay</span><strong class="status">ATIVO</strong></div><div class="gl-row"><span>Readout sobre o vídeo</span><strong>ATIVO</strong></div><div class="gl-row"><span>Curva de erro</span><strong>ATIVO</strong></div><div class="gl-row"><span>Snapshots manuais</span><strong>DESATIVADO</strong></div>` },
  quality: { eyebrow: "03 / QUALIDADE", title: "Tracking quality", body: `<div class="metric-grid"><div class="metric"><label>Confiança</label><strong>95%</strong></div><div class="metric"><label>Rosto</label><strong class="status">Detectado</strong></div><div class="metric"><label>Estabilidade</label><strong>0.98</strong></div><div class="metric"><label>Latência</label><strong>19.9 ms</strong></div></div>` },
  error: { eyebrow: "04 / MÉTRICAS", title: "Curva de erro", body: `<div class="visual" style="height:120px"><svg viewBox="0 0 300 100" width="100%" height="100%"><polyline fill="none" stroke="#43e39b" stroke-width="2" points="0,72 30,64 60,67 90,50 120,55 150,35 180,46 210,40 240,48 270,22 300,30"/></svg></div><p>atual <b>0.679 mm</b> · média 0.82 mm · status <span class="status">OK</span></p>` },
  live: { eyebrow: "PALCO CENTRAL", title: "Live 3D / Face overlay", body: `<div class="visual"><div class="face-wire"><div class="glasses"></div></div><span style="position:absolute;bottom:10px;left:12px;color:#6f89a6">rosto ciano · GLB âmbar · anchors verdes</span></div>` },
  viewports: { eyebrow: "GEOMETRIA", title: "Viewports 3D", body: `<div class="viewport-grid">${["FRONT","TOP","LEFT","RIGHT"].map((v) => `<div class="mini"><strong>${v}</strong><div class="visual"><div class="face-wire small"><div class="glasses"></div></div></div><small>3D ao vivo · agora</small></div>`).join("")}</div>` },
  glb: { eyebrow: "OBJETIVO", title: "GLB objective", body: `<div class="gl-row"><span>Modelo</span><strong>Classic Aviator</strong></div><div class="gl-row"><span>Arquivo</span><strong>classic_aviator.glb</strong></div><div class="gl-row"><span>Dimensões</span><strong>150 × 58 × 50 mm</strong></div><div class="gl-row"><span>Escala</span><strong>0.213 (livre)</strong></div><div class="gl-row"><span>Visibilidade</span><strong class="status">Exibindo</strong></div>` },
  overlay: { eyebrow: "ALINHAMENTO", title: "Overlay & alignment", body: `<div class="gl-row"><span>Posição</span><strong>-0.288 · 0.130 · -0.002</strong></div><div class="gl-row"><span>Rotação</span><strong>-32.7° · 5.1° · 0.0°</strong></div><div class="gl-row"><span>Modo</span><strong>Eyes Center</strong></div><div class="gl-row"><span>Erro RMS</span><strong class="status">0.679 mm</strong></div>` },
  pose: { eyebrow: "LEITURA ESPACIAL", title: "Pose & landmarks", body: `<div class="gl-row"><span>Yaw / Pitch / Roll</span><strong>-32.7° / 5.1° / 0.0°</strong></div><div class="gl-row"><span>Landmarks</span><strong>478 / 478</strong></div><div class="gl-row"><span>Interpupilar</span><strong>64.2 px</strong></div><div class="gl-row"><span>Bounding box</span><strong>19.7 × 32.4%</strong></div>` },
  metrics: { eyebrow: "PERFORMANCE", title: "Render metrics", body: `<div class="gl-row"><span>Draw calls</span><strong>124</strong></div><div class="gl-row"><span>Triangles</span><strong>25,566</strong></div><div class="gl-row"><span>Frame time</span><strong>0.3 ms</strong></div><div class="gl-row"><span>DPR / canvas</span><strong>1.0 / 926 × 621</strong></div>` },
  evidence: { eyebrow: "EVIDÊNCIAS", title: "Evidence timeline", body: `<div class="timeline"><div class="thumb">10:15:23</div><div class="thumb">10:15:24</div><div class="thumb best">BEST · 10:15:26</div><div class="thumb">10:15:27</div><div class="thumb">10:15:28</div></div>` },
  selected: { eyebrow: "FRAME SELECIONADO", title: "Selected frame", body: `<div class="gl-row"><span>Time</span><strong>10:15:26.120</strong></div><div class="gl-row"><span>RMS Error</span><strong class="status">0.679 mm</strong></div><div class="gl-row"><span>Confidence</span><strong>95%</strong></div><div class="gl-row"><span>Pose</span><strong>-32.7° / 5.1° / 0.0°</strong></div><div class="gl-row"><span>Notes</span><strong>Optimal alignment</strong></div>` },
};
function accordion(ids: string[]) { return `<div class="accordion">${ids.map((id) => { const p = panels[id]; return `<article class="accordion-item is-open"><button class="accordion-trigger" type="button" aria-expanded="true"><span>${p.title}</span><span>−</span></button><div class="accordion-content">${p.body}</div></article>`; }).join("")}</div>`; }
panels.leftDock = { eyebrow: "AUDITORIA", title: "Captura e diagnóstico", body: accordion(["camera", "diagnostics", "quality", "error"]) };
panels.rightDock = { eyebrow: "LEITURA ESPACIAL", title: "Auditoria do objetivo", body: accordion(["glb", "overlay", "pose", "metrics"]) };
function component(container: ComponentContainer, id: string) {
  const p = panels[id] ?? panels.camera;
  container.element.innerHTML = `<section class="gl-panel"><div class="panel-body">${p.body}</div></section>`;
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
  container.element.querySelectorAll<HTMLButtonElement>(".accordion-trigger").forEach((trigger) => trigger.addEventListener("click", () => {
    const item = trigger.closest(".accordion-item");
    const open = item?.classList.toggle("is-open") ?? false;
    trigger.setAttribute("aria-expanded", String(open));
    if (trigger.lastElementChild) trigger.lastElementChild.textContent = open ? "−" : "+";
  }));
}
const defaultLayout: LayoutConfig = {
  root: {
    type: "row",
    content: [
        { type: "component", width: 20, componentType: "leftDock", title: "Captura e diagnóstico" },
        { type: "column", width: 58, content: [
          { type: "row", height: 82, content: [{ type: "component", componentType: "live", title: "Live 3D" }, { type: "component", componentType: "viewports", title: "Viewports 3D", width: 28 }] },
          { type: "row", height: 18, content: [{ type: "component", componentType: "evidence", title: "Evidence timeline", width: 78 }, { type: "component", componentType: "selected", title: "Selected frame", width: 22 }] },
        ] },
        { type: "component", width: 22, componentType: "rightDock", title: "Auditoria espacial" },
      ]
    ],
  },
};
const host = document.getElementById("layout-host"); if (!host) throw new Error("layout host ausente");
const layout = new GoldenLayout(host); Object.keys(panels).forEach((id) => layout.registerComponentFactoryFunction(id, (container) => component(container, id)));
const saved = localStorage.getItem(key); try { layout.loadLayout(saved ? JSON.parse(saved) : defaultLayout); } catch { layout.loadLayout(defaultLayout); }
const syncLayoutSize = () => {
  layout.updateSize(host.clientWidth, host.clientHeight);
  host.querySelectorAll<HTMLElement>(".lm_item:has(.accordion)>.lm_content").forEach((content) => {
    content.style.overflowY = "auto";
    content.style.overflowX = "hidden";
  });
};
requestAnimationFrame(syncLayoutSize);
new ResizeObserver(syncLayoutSize).observe(host);
document.getElementById("save-layout")?.addEventListener("click", () => { localStorage.setItem(key, JSON.stringify(layout.saveLayout())); });
document.getElementById("reset-layout")?.addEventListener("click", () => { localStorage.removeItem(key); location.reload(); });
