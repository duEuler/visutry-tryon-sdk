import type { ComponentContainer } from "golden-layout";
import { createAccordionPanel, type AccordionSection } from "./accordion-panel.js";
import { renderEvidenceTimeline } from "./evidence-timeline.js";
import { renderMetricGrid } from "./metric-grid.js";
import { createPanelShell } from "./panel-shell.js";
import { renderViewportGrid } from "./viewport-panel.js";
import type { AuditSnapshot, StudioInstance, StudioPanelContext, StudioPanelDefinition } from "../types.js";
import { itemControls, panelItem } from "../layout/golden-layout-dom.js";

type Panel = { eyebrow: string; title: string; body: string };
const panelCleanups = new WeakMap<HTMLElement, () => void>();

const panels: Record<string, Panel> = {
  camera: { eyebrow: "01 / CAPTURA", title: "Câmera", body: renderMetricGrid([{ label: "Fonte", value: "Integrated Webcam" }, { label: "Estado", value: "● Ativa", status: true }, { label: "Resolução", value: "640 × 480" }, { label: "FPS alvo", value: "30" }]).replace(/<strong/g, '<strong data-studio-field="camera"') },
  diagnostics: { eyebrow: "02 / OBSERVAÇÃO", title: "Diagnóstico", body: `<label class="gl-row diagnostic-option"><span>Landmarks e overlay</span><input type="checkbox" data-diagnostic-toggle="landmarks" checked aria-label="Exibir landmarks e overlay"></label><label class="gl-row diagnostic-option"><span>Readout sobre o vídeo</span><input type="checkbox" data-diagnostic-toggle="readout" checked aria-label="Exibir leitura sobre o vídeo"></label><label class="gl-row diagnostic-option"><span>Curva de erro</span><input type="checkbox" data-diagnostic-toggle="error" checked aria-label="Exibir curva de erro"></label><label class="gl-row diagnostic-option"><span>Snapshots manuais</span><input type="checkbox" data-diagnostic-toggle="snapshots" checked aria-label="Exibir snapshots manuais"></label>` },
  quality: { eyebrow: "03 / QUALIDADE", title: "Tracking quality", body: renderMetricGrid([{ label: "Confiança", value: "95%" }, { label: "Rosto", value: "Detectado", status: true }, { label: "Estabilidade", value: "0.98" }, { label: "Latência", value: "19.9 ms" }]).replace(/<strong/g, '<strong data-studio-field="tracking"') },
  error: { eyebrow: "04 / MÉTRICAS", title: "Curva de erro", body: `<div class="visual" style="height:120px"><svg viewBox="0 0 300 100" width="100%" height="100%"><polyline fill="none" stroke="#43e39b" stroke-width="2" points="0,72 30,64 60,67 90,50 120,55 150,35 180,46 210,40 240,48 270,22 300,30"/></svg></div><p data-studio-field="error-summary">atual <b>0.679 mm</b> · média 0.82 mm · status <span class="status">OK</span></p>` },
  live: { eyebrow: "PALCO CENTRAL", title: "Live 3D / Face overlay", body: `<div id="stage" class="visual"><canvas class="studio-live-canvas" aria-label="Canvas Live 3D"></canvas><div class="face-wire"><div class="glasses"></div></div><span class="studio-runtime-caption" data-studio-active-text="rosto ciano · GLB âmbar · anchors verdes" style="position:absolute;bottom:10px;left:12px;color:#6f89a6">rosto ciano · GLB âmbar · anchors verdes</span></div>` },
  viewports: { eyebrow: "GEOMETRIA", title: "Viewports 3D", body: renderViewportGrid(["FRONT", "TOP", "LEFT", "RIGHT"].map((label) => ({ label, body: `<div class="visual"><div class="face-wire small"><div class="glasses"></div></div></div><small>3D ao vivo · agora</small>` }))) },
  glb: { eyebrow: "OBJETIVO", title: "GLB objective", body: `<div class="gl-row"><span>Modelo</span><strong data-studio-field="glb-name">Classic Aviator</strong></div><div class="gl-row"><span>Arquivo</span><strong data-studio-field="glb-file">classic_aviator.glb</strong></div><div class="gl-row"><span>Dimensões</span><strong data-studio-field="glb-dimensions">150 × 58 × 50 mm</strong></div><div class="gl-row"><span>Escala</span><strong data-studio-field="glb-scale">0.213 (livre)</strong></div><div class="gl-row"><span>Visibilidade</span><strong class="status" data-studio-field="glb-visibility">Exibindo</strong></div>` },
  overlay: { eyebrow: "ALINHAMENTO", title: "Overlay & alignment", body: `<div class="gl-row"><span>Posição</span><strong data-studio-field="overlay-position">-0.288 · 0.130 · -0.002</strong></div><div class="gl-row"><span>Rotação</span><strong data-studio-field="overlay-rotation">-32.7° · 5.1° · 0.0°</strong></div><div class="gl-row"><span>Modo</span><strong data-studio-field="overlay-mode">Eyes Center</strong></div><div class="gl-row"><span>Erro RMS</span><strong class="status" data-studio-field="overlay-error">0.679 mm</strong></div>` },
  pose: { eyebrow: "LEITURA ESPACIAL", title: "Pose & landmarks", body: `<div class="gl-row"><span>Yaw / Pitch / Roll</span><strong data-studio-field="pose">-32.7° / 5.1° / 0.0°</strong></div><div class="gl-row"><span>Landmarks</span><strong data-studio-field="landmarks">478 / 478</strong></div><div class="gl-row"><span>Interpupilar</span><strong data-studio-field="interpupilar">64.2 px</strong></div><div class="gl-row"><span>Bounding box</span><strong data-studio-field="bounding-box">19.7 × 32.4%</strong></div>` },
  metrics: { eyebrow: "PERFORMANCE", title: "Render metrics", body: `<div class="gl-row"><span>Draw calls</span><strong data-studio-field="draw-calls">124</strong></div><div class="gl-row"><span>Triangles</span><strong data-studio-field="triangles">25,566</strong></div><div class="gl-row"><span>Frame time</span><strong data-studio-field="frame-time">0.3 ms</strong></div><div class="gl-row"><span>DPR / canvas</span><strong data-studio-field="canvas">1.0 / 926 × 621</strong></div>` },
  evidence: { eyebrow: "EVIDÊNCIAS", title: "Evidence timeline", body: `<div class="timeline"><div class="thumb">10:15:23</div><div class="thumb">10:15:24</div><div class="thumb best">BEST · 10:15:26</div><div class="thumb">10:15:27</div><div class="thumb">10:15:28</div></div>` },
  selected: { eyebrow: "FRAME SELECIONADO", title: "Selected frame", body: `<div class="gl-row"><span>Time</span><strong>10:15:26.120</strong></div><div class="gl-row"><span>RMS Error</span><strong class="status">0.679 mm</strong></div><div class="gl-row"><span>Confidence</span><strong>95%</strong></div><div class="gl-row"><span>Pose</span><strong>-32.7° / 5.1° / 0.0°</strong></div><div class="gl-row"><span>Notes</span><strong>Optimal alignment</strong></div>` },
};

const accordionSections = (ids: string[]): AccordionSection[] => ids.map((id) => ({ id, title: panels[id].title, body: panels[id].body }));

function renderSelectedFrame(element: HTMLElement, selected: { id: string; timestamp: number; confidence?: number; rmsError?: number }): void {
  const body = element.querySelector<HTMLElement>(".panel-body");
  if (!body) return;
  body.replaceChildren();
  const rows: [string, string][] = [["Time", new Date(selected.timestamp).toLocaleTimeString()], ["Frame", selected.id]];
  if (selected.rmsError !== undefined) rows.push(["RMS Error", `${selected.rmsError} mm`]);
  if (selected.confidence !== undefined) rows.push(["Confidence", `${Math.round(selected.confidence * 100)}%`]);
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "gl-row";
    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    const valueElement = document.createElement("strong");
    valueElement.textContent = value;
    row.append(labelElement, valueElement);
    body.append(row);
  });
}

function updateRuntimePresentation(element: HTMLElement, snapshot: AuditSnapshot): void {
  const inactive = snapshot.mode === "static" || snapshot.mode === "degraded";
  element.classList.toggle("studio-panel--inactive", inactive);
  if (snapshot.mode === "connected") {
    const setMany = (field: string, values: Array<string | number | undefined>) => {
      element.querySelectorAll<HTMLElement>(`[data-studio-field="${field}"]`).forEach((node, index) => {
        node.textContent = values[index] === undefined ? "—" : String(values[index]);
      });
    };
    const camera = snapshot.camera ?? {};
    setMany("camera", [camera.source, camera.active === undefined ? undefined : camera.active ? "● Ativa" : "Desligada", camera.width && camera.height ? `${camera.width} × ${camera.height}` : undefined, camera.fps]);
    const tracking = snapshot.tracking ?? {};
    setMany("tracking", [tracking.confidence === undefined ? undefined : `${Math.round(tracking.confidence * 100)}%`, tracking.detected === undefined ? undefined : tracking.detected ? "Detectado" : "Não detectado", tracking.stability, tracking.latencyMs === undefined ? undefined : `${tracking.latencyMs} ms`]);
    const glb = snapshot.glb as (AuditSnapshot["glb"] & { dimensions?: { frameWidthMm?: number; lensWidthMm?: number; lensHeightMm?: number } }) | null | undefined;
    setMany("glb-name", [glb?.name]);
    setMany("glb-file", [glb?.modelUrl]);
    setMany("glb-dimensions", [glb?.dimensions ? `${glb.dimensions.frameWidthMm ?? "—"} × ${glb.dimensions.lensWidthMm ?? "—"} × ${glb.dimensions.lensHeightMm ?? "—"} mm` : undefined]);
    setMany("glb-scale", [(glb as { fitting?: { defaultScale?: number } } | null)?.fitting?.defaultScale]);
    setMany("glb-visibility", [glb ? "Exibindo" : "—"]);
    const pose = snapshot.pose;
    setMany("pose", [pose ? `${pose.yaw ?? "—"}° / ${pose.pitch ?? "—"}° / ${pose.roll ?? "—"}°` : undefined]);
    setMany("overlay-position", [pose?.position ? `${pose.position.x} · ${pose.position.y} · ${pose.position.z}` : undefined]);
    setMany("overlay-rotation", [pose ? `${pose.yaw ?? "—"}° / ${pose.pitch ?? "—"}° / ${pose.roll ?? "—"}°` : undefined]);
    setMany("overlay-mode", [pose ? "Eyes Center" : undefined]);
    const face = snapshot.face as { rmsError?: number; interpupilar?: number; bbox?: { width?: number; height?: number } } | undefined;
    setMany("overlay-error", [face?.rmsError === undefined ? undefined : `${face.rmsError} mm`]);
    const errorSummary = element.querySelector<HTMLElement>('[data-studio-field="error-summary"]');
    if (errorSummary) errorSummary.textContent = face?.rmsError === undefined ? "Aguardando amostras do runtime." : `Erro atual: ${face.rmsError} mm`;
    setMany("landmarks", [tracking.landmarks ? `${tracking.landmarks} / ${tracking.landmarks}` : undefined]);
    setMany("interpupilar", [face?.interpupilar === undefined ? undefined : `${Math.round(face.interpupilar * 10) / 10} px`]);
    setMany("bounding-box", [face?.bbox ? `${Math.round((face.bbox.width ?? 0) * 1000) / 10} × ${Math.round((face.bbox.height ?? 0) * 1000) / 10}%` : undefined]);
    const render = snapshot.render ?? {};
    setMany("draw-calls", [render.drawCalls]);
    setMany("triangles", [render.triangles]);
    setMany("frame-time", [render.frameTimeMs === undefined ? undefined : `${render.frameTimeMs} ms`]);
    setMany("canvas", [render.dpr === undefined && render.width === undefined ? undefined : `${render.dpr ?? "—"} / ${render.width ?? "—"} × ${render.height ?? "—"}`]);
  }
  const runtimeTexts = element.querySelectorAll<HTMLElement>("[data-studio-active-text]");
  if (!inactive) {
    runtimeTexts.forEach((value) => {
      value.textContent = value.dataset.studioActiveText ?? value.textContent;
      delete value.dataset.studioActiveText;
    });
    element.querySelectorAll<HTMLElement>(".studio-runtime-hidden").forEach((value) => value.classList.remove("studio-runtime-hidden"));
    element.querySelectorAll(".runtime-placeholder, .panel-empty-state").forEach((value) => value.remove());
    return;
  }
  element.querySelectorAll<HTMLElement>(".studio-live-canvas").forEach((value) => value.classList.remove("studio-runtime-hidden"));
  element.querySelectorAll<HTMLElement>("strong").forEach((value) => {
    value.dataset.studioActiveText ??= value.textContent ?? "";
    value.textContent = "—";
  });
  element.querySelectorAll<HTMLElement>("small").forEach((value) => {
    value.dataset.studioActiveText ??= value.textContent ?? "";
    value.textContent = "runtime desligado";
  });
  element.querySelectorAll<HTMLElement>(".studio-runtime-caption").forEach((value) => {
    value.dataset.studioActiveText ??= value.textContent ?? "";
    value.textContent = "runtime desligado";
  });
  element.querySelectorAll<HTMLElement>(".face-wire, svg").forEach((value) => value.classList.add("studio-runtime-hidden"));
  element.querySelectorAll<HTMLElement>("p").forEach((value) => {
    if (!value.textContent?.includes("atual ")) return;
    value.dataset.studioActiveText ??= value.textContent;
    value.textContent = "Aguardando runtime para métricas de erro.";
  });
  if (element.querySelector(".studio-runtime-hidden") && !element.querySelector(".runtime-placeholder")) {
    const placeholder = document.createElement("span");
    placeholder.className = "runtime-placeholder";
    placeholder.textContent = "Runtime desligado";
    element.querySelector(".panel-body")?.append(placeholder);
  }
  const timeline = element.querySelector<HTMLElement>(".timeline");
  if (timeline) {
    timeline.replaceChildren();
    const empty = document.createElement("span");
    empty.className = "timeline-empty";
    empty.textContent = "Nenhuma evidência disponível";
    timeline.append(empty);
  }
  const body = element.querySelector<HTMLElement>(".panel-body");
  if (body && element.dataset.panelId === "selected") {
    body.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "panel-empty-state";
    empty.textContent = "Conecte o runtime para selecionar um frame.";
    body.append(empty);
  }
}

function createPanel(studio: Pick<StudioInstance, "collapsePanel" | "expandPanel">, context: StudioPanelContext, container: ComponentContainer, id: string): void {
  const accordion = id === "leftDock" || id === "rightDock";
  if (accordion) createAccordionPanel(context, container, accordionSections(id === "leftDock" ? ["camera", "diagnostics", "quality", "error"] : ["glb", "overlay", "pose", "metrics"]));
  else createPanelShell(context, container, { panelId: id, body: panels[id].body });
  const item = panelItem(container.element);
  if (!item) return;
  const controls = itemControls(item);
  if (!controls || controls.querySelector(".audit-collapse-control")) return;
  const toggle = document.createElement("button");
  const controller = new AbortController();
  toggle.className = "audit-collapse-control";
  toggle.type = "button";
  toggle.textContent = "▼";
  toggle.title = "Minimizar janela";
  toggle.setAttribute("aria-label", "Minimizar janela");
  controls.prepend(toggle);
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const collapsed = !item.classList.contains("studio-panel-collapsed");
    if (collapsed) studio.collapsePanel(id); else studio.expandPanel(id);
    toggle.textContent = collapsed ? "▲" : "▼";
    toggle.title = collapsed ? "Expandir janela" : "Minimizar janela";
    toggle.setAttribute("aria-label", toggle.title);
  }, { signal: controller.signal });
  panelCleanups.set(container.element, () => controller.abort());
}

export function createDefaultPanelDefinitions(studio: Pick<StudioInstance, "collapsePanel" | "expandPanel">): StudioPanelDefinition[] {
  return Object.keys({ leftDock: 1, rightDock: 1, live: 1, viewports: 1, evidence: 1, selected: 1 }).map((id) => ({
    id,
    title: id === "leftDock" ? "Captura e diagnóstico" : id === "rightDock" ? "Auditoria espacial" : panels[id].title,
    region: id === "leftDock" ? "left" : id === "rightDock" ? "right" : id === "evidence" || id === "selected" ? "bottom" : "center",
    scrollable: id === "leftDock" || id === "rightDock",
    create: (context, container) => createPanel(studio, context, container, id),
    destroy: (element) => { panelCleanups.get(element)?.(); panelCleanups.delete(element); },
    update: (element, snapshot: AuditSnapshot) => {
      updateRuntimePresentation(element, snapshot);
      if (id === "evidence") {
      const items = (snapshot.evidence ?? []) as { id: string; timestamp: number; dataUrl?: string }[];
      const timeline = element.querySelector<HTMLElement>(".timeline");
      if (timeline && snapshot.mode === "connected") timeline.innerHTML = items.length
        ? renderEvidenceTimeline(items.map((item) => ({ label: new Date(item.timestamp).toLocaleTimeString(), dataUrl: item.dataUrl, best: item.id === snapshot.selectedFrameId })))
        : "<span class=\"timeline-empty\">Nenhuma evidência disponível</span>";
      }
      if (id === "selected") {
      const selected = ((snapshot.evidence ?? []) as { id: string; timestamp: number; confidence?: number; rmsError?: number }[]).find((item) => item.id === snapshot.selectedFrameId);
      if (selected && snapshot.mode !== "static" && snapshot.mode !== "degraded") renderSelectedFrame(element, selected);
      }
    },
  }));
}
