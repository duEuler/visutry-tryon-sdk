# @visutry/studio

## Persistência de painéis ocultos

O host preserva o último layout completo antes de ocultar um painel. Assim, `saveLayout()` grava a árvore com todos os itens e o estado `hiddenPanels` separadamente; após reload, os painéis continuam disponíveis para `showPanel()`. Layouts antigos que realmente não contêm um painel ainda usam `restoreDefaultLayout()` como fallback.

Framework-neutral Golden Layout host for the VisuTry audit workspace. It owns
docking, panel registration, layout persistence, resize scheduling and the
audit snapshot store. Runtime integrations (camera, MediaPipe, Three.js and
GLB) are supplied by adapters and are intentionally not dependencies of this
package.

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

The optional stylesheet is available as `@visutry/studio/styles.css`; import
it once in the host that renders the Studio panels.
