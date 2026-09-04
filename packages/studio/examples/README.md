# React integration example

`ReactStudioHost.tsx` is a framework integration example for the public,
framework-neutral Studio API. It does not add React as a dependency of
`@visutry/studio`; the consuming application provides React and imports the
component source (or adapts the same lifecycle pattern).

The component demonstrates:

- a DOM ref as the Golden Layout host;
- `createReactStudioBinding()` for strict-mode-safe mount/unmount;
- the default panel registry and desktop layout;
- versioned local persistence;
- accordion callbacks resolved through the mounted `StudioInstance`.

`ReactStudioApp.tsx` is the complete consumer example. It renders a React
toolbar, a reactive `static`/`connected`/`degraded` status badge and the Studio
host. Pass a real `StudioRuntimeAdapter` through `runtime` when the camera and
tracking runtime is ready; omit it for an offline preview:

```tsx
import { ReactStudioApp } from "@visutry/studio/examples/ReactStudioApp";

export function AuditRoute() {
  return <ReactStudioApp persistenceKey="audit-studio-layout" />;
}
```

The component remounts safely when the runtime changes and destroys the
previous instance, observers and subscriptions during React cleanup. Import
`@visutry/studio/styles.css`, `@visutry/studio/golden-layout.css` and
`@visutry/studio/theme.css` once in the consuming application.

For a connected runtime, call `studioRef.current?.connectRuntime(adapter)` from
the application after its camera/MediaPipe/renderer adapter is ready. Always
call `binding.unmount()` in the effect cleanup so observers, animation frames,
panels and runtime resources are released.
