import { GoldenLayout, type LayoutConfig } from "golden-layout";
import { AuditStore } from "./audit-store.js";
import type { StudioInstance, StudioOptions } from "./types.js";

export function createGoldenLayoutStudio(options: StudioOptions): StudioInstance {
  const store = new AuditStore(options.snapshot);
  const layout = new GoldenLayout(options.host);
  let resizeFrame: number | null = null;
  let mounted = false;

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

  const instance: StudioInstance = {
    mount() {
      if (mounted) return;
      mounted = true;
      layout.loadLayout((options.persistence?.load() ?? options.initialLayout) as unknown as LayoutConfig);
      observer.observe(options.host);
      syncSize();
    },
    saveLayout() { options.persistence?.save(layout.saveLayout() as unknown as LayoutConfig); },
    restoreDefaultLayout() { options.persistence?.clear(); layout.loadLayout(options.initialLayout); syncSize(); },
    getLayout() { return layout.saveLayout() as unknown as LayoutConfig; },
    setLayout(next: LayoutConfig) { layout.loadLayout(next); syncSize(); },
    showPanel() { /* visibility is controlled by Golden Layout docking */ },
    hidePanel() { /* visibility is controlled by Golden Layout docking */ },
    collapsePanel() { /* host-level collapse controls remain theme-specific */ },
    expandPanel() { /* host-level expand controls remain theme-specific */ },
    destroy() {
      observer.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      store.destroy();
      layout.destroy();
      mounted = false;
    },
  };
  return instance;
}
