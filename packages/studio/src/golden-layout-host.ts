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
  let layoutDestroyed = false;
  let mode: StudioMode = options.runtime ? "connected" : "static";
  let runtimeUnsubscribe: (() => void) | null = null;
  let activeRuntime: StudioRuntimeAdapter | undefined = options.runtime;
  const modeListeners = new Set<(next: StudioMode) => void>();
  const hiddenPanels = new Set<string>();
  const collapsedPanels = new Set<string>();
  let layoutLocked = false;

  registry.list().forEach((panel) => {
    layout.registerComponentFactoryFunction(panel.id, (container) => {
      registry.create(panel.id, { panelId: panel.id, getSnapshot: () => store.getSnapshot() }, container);
      container.element.classList.toggle("studio-panel--scrollable", panel.scrollable);
      container.element.classList.toggle("studio-panel--hidden", hiddenPanels.has(panel.id));
      container.element.closest<HTMLElement>(".lm_item")?.classList.toggle("studio-panel-item--scrollable", panel.scrollable);
      const unsubscribe = store.subscribe((snapshot) => registry.update(panel.id, container.element, snapshot));
      container.on("destroy", () => { unsubscribe(); panel.destroy?.(container.element); });
    });
  });

  const resizeController = createLayoutResizeController(layout, options.host);
  let reapplyPanelState: (() => void) | null = null;
  const handleLayoutStateChanged = () => { resizeController.schedule(); reapplyPanelState?.(); };
  layout.on("stateChanged", handleLayoutStateChanged);
  const observer = new ResizeObserver(() => resizeController.schedule());
  let panelStateObserver: MutationObserver | null = null;
  const findItem = (id: string): HTMLElement | null => options.host.querySelector<HTMLElement>(`[data-panel-id="${CSS.escape(id)}"]`)?.closest<HTMLElement>(".lm_item") ?? null;
  const setPanelVisibility = (id: string, visible: boolean) => {
    if (visible) hiddenPanels.delete(id); else hiddenPanels.add(id);
    const item = findItem(id);
    const panelElement = options.host.querySelector<HTMLElement>(`[data-panel-id="${CSS.escape(id)}"]`);
    panelElement?.classList.toggle("studio-panel--hidden", !visible);
    if (!item) return;
    item.style.display = visible ? "" : "none";
    resizeController.schedule();
  };
  const setPanelCollapsed = (id: string, collapsed: boolean) => {
    if (collapsed) collapsedPanels.add(id); else collapsedPanels.delete(id);
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
      const persisted = options.persistence?.loadState?.();
      persisted?.hiddenPanels.forEach((id) => hiddenPanels.add(id));
      persisted?.collapsedPanels.forEach((id) => collapsedPanels.add(id));
      if (layoutDestroyed) { layout.init(); layout.on("stateChanged", handleLayoutStateChanged); layoutDestroyed = false; }
      layout.loadLayout((persisted?.layout ?? options.persistence?.load() ?? options.initialLayout) as unknown as LayoutConfig);
      const applyPersistedPanelState = () => {
        hiddenPanels.forEach((id) => setPanelVisibility(id, false));
        collapsedPanels.forEach((id) => setPanelCollapsed(id, true));
      };
      reapplyPanelState = applyPersistedPanelState;
      panelStateObserver?.disconnect();
      panelStateObserver = new MutationObserver(() => applyPersistedPanelState());
      panelStateObserver.observe(options.host, { childList: true, subtree: true });
      applyPersistedPanelState();
      const retryPersistedPanelState = (attempt = 0) => {
        applyPersistedPanelState();
        if (attempt < 10) requestAnimationFrame(() => retryPersistedPanelState(attempt + 1));
      };
      requestAnimationFrame(() => retryPersistedPanelState());
      observer.observe(options.host);
      resizeController.schedule();
    },
    saveLayout() {
      const nextLayout = layout.saveLayout() as unknown as LayoutConfig;
      if (options.persistence?.saveState) options.persistence.saveState({ version: 1, layout: nextLayout, hiddenPanels: [...hiddenPanels], collapsedPanels: [...collapsedPanels] });
      else options.persistence?.save(nextLayout);
    },
    restoreDefaultLayout() { options.persistence?.clear(); hiddenPanels.clear(); collapsedPanels.clear(); layout.loadLayout(options.initialLayout); resizeController.schedule(); },
    getLayout() { return layout.saveLayout() as unknown as LayoutConfig; },
    setLayout(next: LayoutConfig) { layout.loadLayout(next); resizeController.schedule(); },
    showPanel(id) { setPanelVisibility(id, true); },
    hidePanel(id) { setPanelVisibility(id, false); },
    collapsePanel(id) { setPanelCollapsed(id, true); },
    expandPanel(id) { setPanelCollapsed(id, false); },
    setLayoutLocked(locked) { layoutLocked = locked; options.host.classList.toggle("studio-layout-locked", locked); },
    isLayoutLocked() { return layoutLocked; },
    getMode() { return mode; },
    subscribeMode(listener) { modeListeners.add(listener); listener(mode); return () => modeListeners.delete(listener); },
    async connectRuntime(runtime) {
      runtimeUnsubscribe?.();
      // Mount can call connectRuntime with the adapter already supplied in
      // options. Never dispose that same instance before initialize().
      if (activeRuntime && activeRuntime !== runtime) activeRuntime.dispose?.();
      activeRuntime = runtime;
      mode = "connected";
      modeListeners.forEach((listener) => listener(mode));
      store.setSnapshot(runtime.getSnapshot());
      runtimeUnsubscribe = runtime.subscribe((snapshot) => {
        if (snapshot.mode && snapshot.mode !== mode) { mode = snapshot.mode; modeListeners.forEach((listener) => listener(mode)); }
        store.setSnapshot(snapshot);
      });
      try { await runtime.initialize?.(); } catch { mode = "degraded"; modeListeners.forEach((listener) => listener(mode)); }
    },
    disconnectRuntime() {
      runtimeUnsubscribe?.();
      runtimeUnsubscribe = null;
      activeRuntime?.dispose?.();
      activeRuntime = undefined;
      mode = "static";
      store.setSnapshot({ mode: "static" });
      modeListeners.forEach((listener) => listener(mode));
    },
    destroy() {
      if (!mounted) return;
      mounted = false;
      observer.disconnect();
      panelStateObserver?.disconnect();
      panelStateObserver = null;
      options.host.classList.remove("studio-layout-locked");
      resizeController.dispose();
      layout.off("stateChanged", handleLayoutStateChanged);
      reapplyPanelState = null;
      store.destroy();
      runtimeUnsubscribe?.();
      runtimeUnsubscribe = null;
      activeRuntime?.dispose?.();
      modeListeners.clear();
      layout.destroy();
      layoutDestroyed = true;
    },
  };
  return instance;
}
