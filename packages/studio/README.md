# @visutry/studio

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

## Panel contract

Each panel declares `id`, `title`, `region`, `scrollable`, `create`, and
optional `update`/`destroy` hooks. Accordion panels set `scrollable: true`;
simple panels remain non-scrollable. This keeps layout behavior explicit and
avoids selector-based coupling to Golden Layout internals.
