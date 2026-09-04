import { GoldenLayout, type LayoutConfig } from "golden-layout";
import { AuditStore } from "./audit-store.js";
import { createPanelRegistry } from "./panel-registry.js";
import { createLayoutResizeController } from "./layout-resize-controller.js";
import { normalizeStudioLayout } from "./layout-contract.js";
import { itemContent, panelElement, panelItem } from "./layout/golden-layout-dom.js";
import type { StudioInstance, StudioMode, StudioOptions, StudioRuntimeAdapter } from "./types.js";

export function createGoldenLayoutStudio(options: StudioOptions): StudioInstance {
  const store = new AuditStore(options.snapshot);
  const registry = createPanelRegistry(options.panels);
  const layout = new GoldenLayout(options.host);
  const hasRegisteredPanels = (node: unknown): boolean => {
    if (!node || typeof node !== "object") return false;
    const value = node as { type?: unknown; componentType?: unknown; content?: unknown };
    if (value.type === "component") return typeof value.componentType === "string" && registry.get(value.componentType) !== undefined;
    if (value.type === "row" || value.type === "column" || value.type === "stack") {
      return Array.isArray(value.content) && value.content.length > 0 && value.content.every(hasRegisteredPanels);
    }
    return false;
  };
  const ensureRegisteredPanels = (candidate: LayoutConfig): LayoutConfig => {
    if (!hasRegisteredPanels((candidate as unknown as { root?: unknown }).root)) throw new Error("Studio layout references an unknown panel");
    return candidate;
  };
  let mounted = false;
  let layoutDestroyed = false;
  let mode: StudioMode = options.runtime ? "connected" : "static";
  let runtimeUnsubscribe: (() => void) | null = null;
  let activeRuntime: StudioRuntimeAdapter | undefined = options.runtime;
  const modeListeners = new Set<(next: StudioMode) => void>();
  const panelVisibilityListeners = new Set<(id: string, visible: boolean) => void>();
  const hiddenPanels = new Set<string>();
  const collapsedPanels = new Set<string>();
  let lastCompleteLayout: LayoutConfig = options.initialLayout;
  let layoutLocked = false;
  const setMode = (next: StudioMode) => {
    if (mode === next) return;
    const previous = mode;
    mode = next;
    options.host.dataset.studioMode = next;
    options.host.classList.remove(`studio-mode--${previous}`);
    options.host.classList.add(`studio-mode--${next}`);
    modeListeners.forEach((listener) => listener(next));
  };
  options.host.dataset.studioMode = mode;
  options.host.classList.add(`studio-mode--${mode}`);

  registry.list().forEach((panel) => {
    layout.registerComponentFactoryFunction(panel.id, (container) => {
      registry.create(panel.id, { panelId: panel.id, getSnapshot: () => store.getSnapshot() }, container);
      container.element.classList.toggle("studio-panel--scrollable", panel.scrollable);
      container.element.querySelector<HTMLElement>(`[data-panel-id="${CSS.escape(panel.id)}"]`)?.classList.toggle("studio-panel--scrollable", panel.scrollable);
      container.element.classList.toggle("studio-panel--hidden", hiddenPanels.has(panel.id));
      panelItem(container.element)?.classList.toggle("studio-panel-item--scrollable", panel.scrollable);
      const unsubscribe = store.subscribe((snapshot) => registry.update(panel.id, container.element, snapshot));
      container.on("destroy", () => { unsubscribe(); registry.destroy(panel.id, container.element); });
    });
  });

  const resizeController = createLayoutResizeController(layout, options.host);
  let reapplyPanelState: (() => void) | null = null;
  const handleLayoutStateChanged = () => { resizeController.schedule(); reapplyPanelState?.(); };
  layout.on("stateChanged", handleLayoutStateChanged);
  const observer = new ResizeObserver(() => resizeController.schedule());
  let panelStateObserver: MutationObserver | null = null;
  let panelStateRetryFrame: number | null = null;
  const visibilityFrames = new Set<number>();
  const findItem = (id: string): HTMLElement | null => panelItem(panelElement(options.host, id));
  const setPanelVisibility = (id: string, visible: boolean) => {
    const wasVisible = !hiddenPanels.has(id);
    if (visible) hiddenPanels.delete(id); else hiddenPanels.add(id);
    if (wasVisible !== visible) panelVisibilityListeners.forEach((listener) => listener(id, visible));
    const item = findItem(id);
    const element = panelElement(options.host, id);
    element?.classList.toggle("studio-panel--hidden", !visible);
    if (!item) return;
    item.style.display = visible ? "" : "none";
    resizeController.schedule();
    if (visible) {
      let attempts = 0;
      const clearHiddenState = () => {
        const panel = panelElement(options.host, id);
        panel?.classList.remove("studio-panel--hidden");
        const parent = panelItem(panel);
        if (parent) parent.style.display = "";
        if (++attempts < 4) {
          const frame = requestAnimationFrame(() => { visibilityFrames.delete(frame); clearHiddenState(); });
          visibilityFrames.add(frame);
        }
      };
      const frame = requestAnimationFrame(() => { visibilityFrames.delete(frame); clearHiddenState(); });
      visibilityFrames.add(frame);
    }
  };
  const setPanelCollapsed = (id: string, collapsed: boolean) => {
    if (collapsed) collapsedPanels.add(id); else collapsedPanels.delete(id);
    const item = findItem(id);
    if (!item) return;
    const content = itemContent(item);
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
      const loadedCandidate = (persisted?.layout ?? options.persistence?.load() ?? options.initialLayout) as unknown as LayoutConfig;
      let loadedLayout: LayoutConfig;
      try { loadedLayout = normalizeStudioLayout(loadedCandidate); }
      catch { loadedLayout = normalizeStudioLayout(options.initialLayout); }
      if (!hasRegisteredPanels((loadedLayout as unknown as { root?: unknown }).root)) loadedLayout = normalizeStudioLayout(options.initialLayout);
      lastCompleteLayout = loadedLayout;
      layout.loadLayout(loadedLayout);
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
        if (attempt < 10) panelStateRetryFrame = requestAnimationFrame(() => retryPersistedPanelState(attempt + 1));
        else panelStateRetryFrame = null;
      };
      if (panelStateRetryFrame !== null) cancelAnimationFrame(panelStateRetryFrame);
      panelStateRetryFrame = requestAnimationFrame(() => retryPersistedPanelState());
      observer.observe(options.host);
      resizeController.schedule();
    },
    saveLayout() {
      const currentLayout = layout.saveLayout() as unknown as LayoutConfig;
      // Golden Layout may omit items whose stack is temporarily hidden. Keep
      // the last complete tree so hidden panels can be restored after reload.
      const currentDeclarativeLayout = normalizeStudioLayout(currentLayout);
      const nextLayout = hiddenPanels.size > 0 ? lastCompleteLayout : currentDeclarativeLayout;
      if (hiddenPanels.size === 0) lastCompleteLayout = currentDeclarativeLayout;
      if (options.persistence?.saveState) options.persistence.saveState({ version: 1, layout: nextLayout, hiddenPanels: [...hiddenPanels], collapsedPanels: [...collapsedPanels] });
      else options.persistence?.save(nextLayout);
    },
    restoreDefaultLayout() { options.persistence?.clear(); hiddenPanels.clear(); collapsedPanels.clear(); lastCompleteLayout = options.initialLayout; layout.loadLayout(options.initialLayout); resizeController.schedule(); },
    getLayout() { return normalizeStudioLayout(layout.saveLayout() as unknown as LayoutConfig); },
    setLayout(next: LayoutConfig) {
      const normalized = ensureRegisteredPanels(normalizeStudioLayout(next));
      lastCompleteLayout = normalized;
      layout.loadLayout(normalized);
      reapplyPanelState?.();
      resizeController.schedule();
    },
    showPanel(id) { setPanelVisibility(id, true); },
    hidePanel(id) { setPanelVisibility(id, false); },
    collapsePanel(id) { setPanelCollapsed(id, true); },
    expandPanel(id) { setPanelCollapsed(id, false); },
    setLayoutLocked(locked) { layoutLocked = locked; options.host.classList.toggle("studio-layout-locked", locked); },
    isLayoutLocked() { return layoutLocked; },
    getMode() { return mode; },
    subscribeMode(listener) { modeListeners.add(listener); listener(mode); return () => modeListeners.delete(listener); },
    subscribeSnapshot(listener) { return store.subscribe(listener); },
    subscribePanelVisibility(listener) { panelVisibilityListeners.add(listener); return () => panelVisibilityListeners.delete(listener); },
    async connectRuntime(runtime) {
      runtimeUnsubscribe?.();
      // Mount can call connectRuntime with the adapter already supplied in
      // options. Never dispose that same instance before initialize().
      if (activeRuntime && activeRuntime !== runtime) activeRuntime.dispose?.();
      activeRuntime = runtime;
      setMode("connected");
      store.setSnapshot(runtime.getSnapshot());
      runtimeUnsubscribe = runtime.subscribe((snapshot) => {
        if (snapshot.mode) setMode(snapshot.mode);
        store.setSnapshot(snapshot);
      });
      try { await runtime.initialize?.(); } catch { setMode("degraded"); }
    },
    disconnectRuntime() {
      runtimeUnsubscribe?.();
      runtimeUnsubscribe = null;
      activeRuntime?.dispose?.();
      activeRuntime = undefined;
      setMode("static");
      store.setSnapshot({ mode: "static" });
      modeListeners.forEach((listener) => listener(mode));
    },
    destroy() {
      if (!mounted) return;
      mounted = false;
      observer.disconnect();
      panelStateObserver?.disconnect();
      panelStateObserver = null;
      if (panelStateRetryFrame !== null) {
        cancelAnimationFrame(panelStateRetryFrame);
        panelStateRetryFrame = null;
      }
      visibilityFrames.forEach((frame) => cancelAnimationFrame(frame));
      visibilityFrames.clear();
      options.host.classList.remove("studio-layout-locked");
      options.host.classList.remove(`studio-mode--${mode}`);
      delete options.host.dataset.studioMode;
      resizeController.dispose();
      layout.off("stateChanged", handleLayoutStateChanged);
      reapplyPanelState = null;
      store.destroy();
      runtimeUnsubscribe?.();
      runtimeUnsubscribe = null;
      activeRuntime?.dispose?.();
      modeListeners.clear();
      panelVisibilityListeners.clear();
      layout.destroy();
      layoutDestroyed = true;
    },
  };
  return instance;
}
