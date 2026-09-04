import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  createDefaultPanelDefinitions,
  createDefaultStudioLayout,
  createLocalStoragePersistence,
  createReactStudioBinding,
  type StudioInstance,
  type StudioMode,
  type StudioRuntimeAdapter,
} from "@visutry/studio";

export interface ReactStudioAppProps {
  /** Supply a real camera/tracking adapter to switch from static to connected mode. */
  runtime?: StudioRuntimeAdapter;
  persistenceKey?: string;
}

/**
 * Complete React consumer example. React owns the toolbar and status badge;
 * the Studio package owns Golden Layout, panel rendering and resource cleanup.
 */
export function ReactStudioApp({ runtime, persistenceKey = "react-studio-layout" }: ReactStudioAppProps): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<StudioInstance | null>(null);
  const [mode, setMode] = useState<StudioMode>("static");

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const panels = createDefaultPanelDefinitions({
      collapsePanel: (id) => studioRef.current?.collapsePanel(id),
      expandPanel: (id) => studioRef.current?.expandPanel(id),
    });
    const binding = createReactStudioBinding({
      panels,
      initialLayout: createDefaultStudioLayout(),
      persistence: createLocalStoragePersistence(persistenceKey, 1),
      ...(runtime ? { runtime } : {}),
    });
    const studio = binding.mount(hostRef.current);
    studioRef.current = studio;
    const unsubscribe = studio.subscribeMode(setMode);
    return () => {
      unsubscribe();
      binding.unmount();
      studioRef.current = null;
    };
  }, [persistenceKey, runtime]);

  const studio = studioRef.current;
  return (
    <section className="react-studio-app" data-studio-mode={mode}>
      <div className="react-studio-toolbar" role="toolbar" aria-label="Controles do Studio">
        <span className="react-studio-status" role="status">Runtime: {mode}</span>
        <button type="button" onClick={() => studio?.expandPanel("leftDock")}>Expandir painéis</button>
        <button type="button" onClick={() => studio?.collapsePanel("leftDock")}>Recolher painéis</button>
        <button type="button" onClick={() => studio?.saveLayout()}>Salvar layout</button>
        <button type="button" onClick={() => studio?.restoreDefaultLayout()}>Restaurar padrão</button>
      </div>
      <div ref={hostRef} className="studio-host" aria-label="VisuTry Studio" />
    </section>
  );
}
