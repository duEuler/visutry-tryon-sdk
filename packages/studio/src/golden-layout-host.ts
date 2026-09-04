import { GoldenLayout, type LayoutConfig } from "golden-layout";
import { AuditStore } from "./audit-store.js";
import { createPanelRegistry } from "./panel-registry.js";
import { createLayoutResizeController } from "./layout-resize-controller.js";
import type { StudioInstance, StudioMode, StudioOptions, StudioRuntimeAdapter } from "./types.js";

export function createGoldenLayoutStudio(options: StudioOptions): StudioInstance {
  const store = new AuditStore(options.snapshot);
  const registry = createPanelRegistry(options.panels);
  const layout = new GoldenLayout(options.host);
  let mounted = false;
  let mode: StudioMode = options.runtime ? "connected" : "static";
  let runtimeUnsubscribe: (() => void) | null = null;
  let activeRuntime: StudioRuntimeAdapter | undefined = options.runtime;

  registry.list().forEach((panel) => {
    layout.registerComponentFactoryFunction(panel.id, (container) => {
      registry.create(panel.id, { panelId: panel.id, getSnapshot: () => store.getSnapshot() }, container);
      container.element.classList.toggle("studio-panel--scrollable", panel.scrollable);
      const unsubscribe = store.subscribe((snapshot) => registry.update(panel.id, container.element, snapshot));
      container.on("destroy", () => { unsubscribe(); panel.destroy?.(container.element); });
    });
  });

  const resizeController = createLayoutResizeController(layout, options.host);
  const observer = new ResizeObserver(() => resizeController.schedule());
  const findItem = (id: string): HTMLElement | null => options.host.querySelector<HTMLElement>(`[data-panel-id="${CSS.escape(id)}"]`)?.closest<HTMLElement>(".lm_item") ?? null;
  const setPanelVisibility = (id: string, visible: boolean) => {
    const item = findItem(id);
    if (!item) return;
    item.style.display = visible ? "" : "none";
    resizeController.schedule();
  };
  const setPanelCollapsed = (id: string, collapsed: boolean) => {
    const item = findItem(id);
    if (!item) return;
    const content = item.querySelector<HTMLElement>(".lm_content");
    item.classList.toggle("studio-panel-collapsed", collapsed);
    if (content) content.style.display = collapsed ? "none" : "";
    if (collapsed) item.style.height = "28px"; else item.style.height = "";
    resizeController.schedule();
  };

  const instance: StudioInstance = {
    mount() {
      if (mounted) return;
      mounted = true;
      if (activeRuntime) void instance.connectRuntime(activeRuntime);
      layout.loadLayout((options.persistence?.load() ?? options.initialLayout) as unknown as LayoutConfig);
      observer.observe(options.host);
      resizeController.schedule();
    },
    saveLayout() { options.persistence?.save(layout.saveLayout() as unknown as LayoutConfig); },
    restoreDefaultLayout() { options.persistence?.clear(); layout.loadLayout(options.initialLayout); resizeController.schedule(); },
    getLayout() { return layout.saveLayout() as unknown as LayoutConfig; },
    setLayout(next: LayoutConfig) { layout.loadLayout(next); resizeController.schedule(); },
    showPanel(id) { setPanelVisibility(id, true); },
    hidePanel(id) { setPanelVisibility(id, false); },
    collapsePanel(id) { setPanelCollapsed(id, true); },
    expandPanel(id) { setPanelCollapsed(id, false); },
    getMode() { return mode; },
    async connectRuntime(runtime) {
      runtimeUnsubscribe?.();
      activeRuntime?.dispose?.();
      activeRuntime = runtime;
      mode = "connected";
      store.setSnapshot(runtime.getSnapshot());
      runtimeUnsubscribe = runtime.subscribe((snapshot) => store.setSnapshot(snapshot));
      try { await runtime.initialize?.(); } catch { mode = "degraded"; }
    },
    destroy() {
      observer.disconnect();
      resizeController.dispose();
      store.destroy();
      runtimeUnsubscribe?.();
      runtimeUnsubscribe = null;
      activeRuntime?.dispose?.();
      layout.destroy();
      mounted = false;
    },
  };
  return instance;
}
