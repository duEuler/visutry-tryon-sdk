# Golden Layout Studio

Bancada visual isolada para validar docking, abas, redimensionamento e persistência de painéis sem iniciar câmera, MediaPipe ou Three.js. Acesse `/golden-layout-studio/index.html`.

## Gates de validação

Os testes padrão validam layout, scroll, stacks, persistência, lifecycle e
geometria visual sem hardware. Para executar também o fluxo real de runtime,
use `VISUTRY_E2E_CAMERA=1` antes do comando Playwright; os cenários opt-in
conectam o SDK, iniciam a câmera, carregam o GLB e capturam uma evidência.

O baseline desktop garante que as laterais respeitam o contrato de proporção,
que a timeline fica contida na região central e que a página não cria scroll
global. Os scrollbars permanecem somente nos accordions declarados como
`scrollable`.

## Por que Golden Layout

Golden Layout 2 fornece `rows`, `columns` e `stacks`; cada stack vira uma aba e o usuário pode arrastar, dividir e redimensionar os painéis. O layout é serializado com `saveLayout()` e restaurado com `loadLayout()`, neste protótipo salvo em `localStorage`.

## Preparação para React

Os IDs de componentes já são o contrato independente de framework: `camera`, `diagnostics`, `quality`, `error`, `live`, `glb`, `overlay`, `pose`, `metrics` e `evidence`. Na migração, cada registro passa a apontar para um componente React (`CameraPanel.tsx`, `Live3DPanel.tsx` etc.). A instância Golden Layout deve viver em `useRef`; o estado de auditoria permanece em um store único e os painéis recebem snapshots imutáveis por props. O salvamento/restauração continua no host, evitando que cada painel conheça o docking.

Estrutura sugerida: `AuditStudioShell` (layout + toolbar), `AuditStore` (camera, diagnóstico, GLB, pose, histórico), `PanelRegistry` (IDs → componentes) e `ViewportPanel` (fonte live/freeze/snapshot). Primeiro portar o shell estático; depois conectar o SDK existente somente nos painéis que forem habilitados.

Referências: [Golden Layout](https://github.com/golden-layout/golden-layout), [API v2](https://golden-layout.github.io/golden-layout/version-2/), [binding de componentes](https://golden-layout.github.io/golden-layout/binding-components/) e [tutorial React](https://github.com/golden-layout/golden-layout-website/blob/master/pages/tutorials/getting-started-react.md).
