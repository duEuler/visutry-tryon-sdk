import { useEffect, useRef } from "react";
import {
  createDefaultPanelDefinitions,
  createDefaultStudioLayout,
  createLocalStoragePersistence,
  createReactStudioBinding,
  type StudioInstance,
  type ReactStudioBinding,
} from "@visutry/studio";

/**
 * Reference React host. React owns the DOM ref and lifecycle; Studio owns
 * Golden Layout, panel state, persistence and runtime subscriptions.
 */
export function ReactStudioHost(): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<StudioInstance | null>(null);
  const bindingRef = useRef<ReactStudioBinding | null>(null);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const panels = createDefaultPanelDefinitions({
      collapsePanel: (id) => studioRef.current?.collapsePanel(id),
      expandPanel: (id) => studioRef.current?.expandPanel(id),
    });
    const binding = createReactStudioBinding({
      panels,
      initialLayout: createDefaultStudioLayout(),
      persistence: createLocalStoragePersistence("react-studio-layout", 1),
    });
    bindingRef.current = binding;
    studioRef.current = binding.mount(hostRef.current);
    return () => {
      binding.unmount();
      studioRef.current = null;
      bindingRef.current = null;
    };
  }, []);

  return <div ref={hostRef} className="studio-host" aria-label="VisuTry Studio" />;
}
