# VisuTry Studio — guia de integração

Este guia descreve como consumir o módulo `@visutry/studio` em uma aplicação
desktop. O Studio é framework-neutral: ele gerencia Golden Layout, painéis,
abas, resize, persistência, toolbar e lifecycle; o aplicativo fornece os
adaptadores de câmera, tracking, renderer, GLB e evidências.

## Instalação

```bash
pnpm add @visutry/studio golden-layout
```

Importe uma vez os estilos públicos:

```ts
import "@visutry/studio/styles.css";
import "@visutry/studio/golden-layout.css";
import "@visutry/studio/theme.css";
```

## Montagem DOM

```ts
const studio = createGoldenLayoutStudio({
  host: document.querySelector("#studio")!,
  panels: createDefaultPanelDefinitions(studioControls),
  initialLayout: createDefaultStudioLayout(),
  persistence: createLocalStoragePersistence("my-studio", 1),
});

studio.mount();
```

Sempre destrua a instância ao desmontar a tela:

```ts
window.addEventListener("beforeunload", () => studio.destroy());
```

## Modos de runtime

- `static`: preview/offline; controles de câmera, tracking, GLB e evidência
  ficam desativados e painéis exibem valores neutros.
- `connected`: um adaptador está conectado; snapshots alimentam os painéis.
- `degraded`: o adaptador falhou; o layout permanece montado para recuperação.

```ts
const unsubscribe = studio.subscribeMode((mode) => {
  status.textContent = mode;
});
await studio.connectRuntime(runtimeAdapter);
// Quando necessário:
studio.disconnectRuntime();
unsubscribe();
```

## Runtime adapter

O adapter deve fornecer um snapshot completo ou parcial e publicar atualizações
normalizadas:

```ts
const runtime: StudioRuntimeAdapter = {
  getSnapshot: () => ({ mode: "connected", camera: { active: true } }),
  subscribe: (listener) => sdk.onSnapshot(listener),
  initialize: () => sdk.initialize(),
  dispose: () => sdk.dispose(),
  captureEvidence: () => sdk.captureEvidence(),
};
await studio.connectRuntime(runtime);
```

O Studio não abre câmera nem inicializa MediaPipe/Three.js diretamente. Use os
adapters do SDK e conecte-os somente quando o usuário solicitar o runtime.

## React

Use `createReactStudioBinding` em um `useEffect`. O componente completo de
referência está em
[`packages/studio/examples/ReactStudioApp.tsx`](../packages/studio/examples/ReactStudioApp.tsx):

```tsx
import { ReactStudioApp } from "@visutry/studio/examples/ReactStudioApp";

export function AuditRoute() {
  return <ReactStudioApp persistenceKey="audit-studio-layout" />;
}
```

React controla apenas a referência DOM e o lifecycle; não crie uma instância
Golden Layout adicional dentro do componente. Para uma integração manual,
`ReactStudioHost.tsx` mostra somente o padrão mínimo de `ref` e cleanup.

## Persistência e toolbar

`createLocalStoragePersistence(key, version)` salva layout, painéis ocultos e
recolhidos. JSON inválido ou versões incompatíveis retornam ao layout padrão.
`bindStudioToolbar` conecta botões por `data-studio-action` (`save`, `restore`,
`expand`, `collapse`, `show-side-panels`, `hide-side-panels` e `lock`).

## Checklist de produção

- [ ] Conceder permissão de câmera apenas após ação do usuário.
- [x] Instanciar uma única câmera, tracker e renderer no runtime conectado.
- [x] Carregar MediaPipe/Three.js/GLB sob demanda na rota do Studio.
- [x] Pausar try-on quando a aba ou painel Live 3D não estiver visível.
- [x] Chamar `dispose()` de todos os adapters em `studio.destroy()`.
- [ ] Validar escala/origem/espelhamento do GLB no dispositivo-alvo.
- [x] Confirmar que o consumidor React fornece `react`, `react-dom` e os tipos
      correspondentes; eles não são dependências obrigatórias do pacote Studio.
- [x] Executar E2E em pelo menos 1366×768 e 1920×1080.
- [ ] Executar a matriz Firefox/WebKit com `VISUTRY_E2E_CROSS_BROWSER=1`.
- [ ] Fazer teste final com câmera física; a câmera simulada não substitui esse
  teste de hardware.
