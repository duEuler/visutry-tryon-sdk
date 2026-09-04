import { GoldenLayout, type LayoutConfig } from "golden-layout";
import { AuditStore } from "./audit-store.js";
import type { StudioInstance, StudioMode, StudioOptions } from "./types.js";

export function createGoldenLayoutStudio(options: StudioOptions): StudioInstance {
  const store = new AuditStore(options.snapshot);
  const layout = new GoldenLayout(options.host);
  let resizeFrame: number | null = null;
  let mounted = false;
  let mode: StudioMode = options.runtime ? "connected" : "static";
  let runtimeUnsubscribe: (() => void) | null = null;

  options.panels.forEach((panel) => {
    layout.registerComponentFactoryFunction(panel.id, (container) => {
      panel.create({ panelId: panel.id, getSnapshot: () => store.getSnapshot() }, container);
      container.element.classList.toggle("studio-panel--scrollable", panel.scrollable);
      const unsubscribe = store.subscribe((snapshot) => panel.update?.(container.element, snapshot));
      container.on("destroy", () => { unsubscribe(); panel.destroy?.(container.element); });
    });
  });

  const syncSize = () => {
    if (resizeFrame !== null) return;
    resizeFrame = requestAnimationFrame(() => {
      layout.updateSize(options.host.clientWidth, options.host.clientHeight);
      resizeFrame = null;
    });
  };
  const observer = new ResizeObserver(syncSize);
  const findItem = (id: string): HTMLElement | null => options.host.querySelector<HTMLElement>(`[data-panel-id="${CSS.escape(id)}"]`)?.closest<HTMLElement>(".lm_item") ?? null;
  const setPanelVisibility = (id: string, visible: boolean) => {
    const item = findItem(id);
    if (!item) return;
    item.style.display = visible ? "" : "none";
    syncSize();
  };
  const setPanelCollapsed = (id: string, collapsed: boolean) => {
    const item = findItem(id);
    if (!item) return;
    const content = item.querySelector<HTMLElement>(".lm_content");
    item.classList.toggle("studio-panel-collapsed", collapsed);
    if (content) content.style.display = collapsed ? "none" : "";
    if (collapsed) item.style.height = "28px"; else item.style.height = "";
    syncSize();
  };

  const instance: StudioInstance = {
    mount() {
      if (mounted) return;
      mounted = true;
      if (options.runtime) {
        store.setSnapshot(options.runtime.getSnapshot());
        runtimeUnsubscribe = options.runtime.subscribe((snapshot) => store.setSnapshot(snapshot));
        const initialization = options.runtime.initialize?.();
        if (initialization) void initialization.catch(() => { mode = "degraded"; });
      }
      layout.loadLayout((options.persistence?.load() ?? options.initialLayout) as unknown as LayoutConfig);
      observer.observe(options.host);
      syncSize();
    },
    saveLayout() { options.persistence?.save(layout.saveLayout() as unknown as LayoutConfig); },
    restoreDefaultLayout() { options.persistence?.clear(); layout.loadLayout(options.initialLayout); syncSize(); },
    getLayout() { return layout.saveLayout() as unknown as LayoutConfig; },
    setLayout(next: LayoutConfig) { layout.loadLayout(next); syncSize(); },
    showPanel(id) { setPanelVisibility(id, true); },
    hidePanel(id) { setPanelVisibility(id, false); },
    collapsePanel(id) { setPanelCollapsed(id, true); },
    expandPanel(id) { setPanelCollapsed(id, false); },
    getMode() { return mode; },
    destroy() {
      observer.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      store.destroy();
      runtimeUnsubscribe?.();
      runtimeUnsubscribe = null;
      options.runtime?.dispose?.();
      layout.destroy();
      mounted = false;
    },
  };
  return instance;
}
