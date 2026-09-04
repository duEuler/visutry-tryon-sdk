# @visutry/studio

## Persistência de painéis ocultos

O host preserva o último layout completo antes de ocultar um painel. Assim, `saveLayout()` grava a árvore com todos os itens e o estado `hiddenPanels` separadamente; após reload, os painéis continuam disponíveis para `showPanel()`. Layouts antigos que realmente não contêm um painel ainda usam `restoreDefaultLayout()` como fallback.

Framework-neutral Golden Layout host for the VisuTry audit workspace. It owns
docking, panel registration, layout persistence, resize scheduling and the
audit snapshot store. Runtime integrations (camera, MediaPipe, Three.js and
GLB) are supplied by adapters and are intentionally not dependencies of this
package.

## Module boundaries

The implementation is intentionally split into small framework-neutral modules:

- `default-layout` contains only the desktop baseline arrangement.
- `layout-contract` normalizes persisted Golden Layout trees.
- `panel-registry` validates panel IDs, regions and lifecycle hooks.
- `golden-layout-host` owns docking, visibility, collapse, resize and runtime lifecycle.
- `panels/*` contains reusable DOM factories for shells, accordions, viewports,
  metrics and evidence timelines.
- `layout-persistence` isolates versioned storage and migration fallback.

The demo supplies application-specific panel content in its own
`panel-definitions.ts`; the package does not import camera, tracking or renderer
implementations.

## Integration contract

The package is framework-neutral. A React host keeps the same lifecycle and
passes a DOM ref as `host`:

```tsx
const hostRef = useRef<HTMLDivElement>(null);
const studioRef = useRef<StudioInstance>();

useEffect(() => {
  if (!hostRef.current) return;
  const studio = createGoldenLayoutStudio({
    host: hostRef.current,
    panels,
    initialLayout: createDefaultStudioLayout(),
    persistence: createLocalStoragePersistence("studio-layout", 1),
  });
  studio.mount();
  studioRef.current = studio;
  return () => studio.destroy();
}, []);
```

React owns the component lifecycle; Studio owns Golden Layout, panel lifecycle,
scroll policy, resize scheduling and persistence. Runtime adapters implement
`StudioRuntimeAdapter` and may publish snapshots or capture evidence without
requiring React-specific code.

For incremental integrations, the package also exports `StudioAdapters` with
independent `CameraAdapter`, `TrackingAdapter`, `RendererAdapter`, `GlbAdapter`
and `EvidenceAdapter` contracts. Each adapter may be supplied independently;
the optional `runtime` field is the composed facade used by
`connectRuntime()`. Every adapter follows the same `initialize()`/`dispose()`
lifecycle so a React host can release resources in one cleanup.
When adapters are supplied independently, `createCompositeStudioRuntime()`
provides the same runtime facade used by `connectRuntime()`, including reverse
order disposal, rollback on partial initialization, degraded state and evidence
registration.

### Static/offline mode

For previews, Storybook or an unavailable device runtime, use the built-in
`createStaticRuntimeAdapter`. It keeps the same subscription contract and can
publish deterministic snapshots without opening a camera:

```ts
const runtime = createStaticRuntimeAdapter({
  camera: { active: false },
  tracking: { detected: false },
});
const unsubscribe = runtime.subscribe(snapshot => console.log(snapshot.mode));
runtime.setSnapshot?.({ tracking: { detected: true, confidence: 1 } });
// React cleanup: unsubscribe(); studio.destroy();
```

When replacing a connected adapter, call `studio.connectRuntime(next)`; the
previous adapter is disposed only after it is no longer active. Always call
`studio.destroy()` on unmount so observers, resize frames, panel listeners and
runtime resources are released.

The host exposes `subscribeMode(listener)` for reactive status badges and
`disconnectRuntime()` for an explicit return to offline/static mode. Both are
safe to call from a React effect cleanup or from a framework-neutral toolbar.
Use `subscribeSnapshot(listener)` when a host component needs the latest audit
data without reaching into the internal store.
Use `subscribePanelVisibility(listener)` when a renderer or expensive runtime
should pause while a specific panel is hidden; the subscription is removed by
returning its disposer.

### Eventos e ciclo de runtime

The framework-neutral API intentionally exposes subscriptions instead of a
framework event bus:

- `subscribeMode(listener)` emits `static`, `connected` or `degraded` whenever
  the active runtime changes state.
- `subscribeSnapshot(listener)` emits the complete `AuditSnapshot` whenever a
  camera, tracking, pose, GLB, render or evidence value changes.
- `connectRuntime(adapter)` initializes and subscribes one runtime adapter;
  replacing an adapter disposes the previous one after the new adapter is
  ready.
- `disconnectRuntime()` disposes the active adapter and returns the Studio to
  static mode.
- Runtime and capture failures are published in `snapshot.error` and switch
  the mode to `degraded`; the host remains mounted so the UI can recover.

In React, keep the unsubscribe functions in the effect cleanup and never call
`setState` from a disposed subscription. The Studio does not retain listeners
after `destroy()`.

## Loading and performance boundary

The Studio package contains only the docking host and panel contracts. The demo
imports the Web SDK dynamically when `Conectar runtime` is activated; the
MediaPipe, Three.js and GLB chunks therefore stay out of the initial Studio
request. Camera and try-on loops are stopped when the document is hidden and
can be resumed by the host when it becomes visible again. Integrations should
keep one runtime, camera and renderer instance and call `dispose()` during
unmount.

## Panel contract

Each panel declares `id`, `title`, `region`, `scrollable`, `create`, and
optional `update`/`destroy` hooks. Accordion panels set `scrollable: true`;
simple panels remain non-scrollable. This keeps layout behavior explicit and
avoids selector-based coupling to Golden Layout internals.

## Toolbar contract

Use `bindStudioToolbar(root, studio)` with buttons carrying a
`data-studio-action` attribute (`save`, `restore`, `expand`, `collapse`,
`show-side-panels`, `hide-side-panels` or `lock`). The returned binding has a
`dispose()` method and should be released together with the Studio instance:

```ts
const toolbar = bindStudioToolbar(document, studio);
// on unmount
toolbar.dispose();
studio.destroy();
```

Para menus de visibilidade por painel, use `show-panel` ou `hide-panel` junto
com `data-studio-panel="panelId"`. O binding aceita vários botões com a mesma
ação e remove todos os listeners em `dispose()`.

For another layout, pass `accordionPanelIds` to avoid coupling the toolbar to
the demo's `leftDock` and `rightDock` IDs.

The optional stylesheet is available as `@visutry/studio/styles.css`; import
it once in the host that renders the Studio panels.

O contrato de integração do Golden Layout fica disponível separadamente em
`@visutry/studio/golden-layout.css`. Ele contém sizing dos nós, scroll dos
containers, bloqueio do layout e controles de minimizar; o tema visual pode
continuar sendo fornecido pelo aplicativo consumidor.

Para usar o tema visual de referência do Studio, importe também
`@visutry/studio/theme.css`. O demo mantém separado apenas o CSS de runtime
(`runtime-canvas.css`), responsável pelas camadas de vídeo e canvas.
