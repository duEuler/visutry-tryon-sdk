# Studio — validação visual desktop

Este registro documenta o baseline visual do Golden Layout Studio em desktop.
A validação é feita na rota `golden-layout-studio/index.html` com viewport de
referência 1132 × 912 px.

## Critérios verificados

| Área | Critério | Resultado |
| --- | --- | --- |
| Proporções | Dock esquerdo entre 14% e 27% do host | aprovado |
| Proporções | Dock direito entre 16% e 29% do host | aprovado |
| Hierarquia | Live 3D e Viewports ocupam o centro | aprovado |
| Bottom | Evidence timeline e Selected frame permanecem somente no centro | aprovado |
| Alinhamento | Nenhuma coluna se sobrepõe após resize | aprovado |
| Cores | Fundo `rgb(7, 13, 22)` e topbar `rgb(11, 19, 32)` | aprovado |
| Superfície | Stage com borda `rgb(45, 73, 101)` e painel com gradiente | aprovado |
| Scroll | Página sem overflow; accordions usam scroll próprio quando necessário | aprovado |
| Viewports | Quatro vistas empilhadas sem scroll interno | aprovado |

## Alinhamento GLB

O Studio não recalcula pose nem altera o modelo: esses invariantes pertencem
ao SDK e chegam pelo adapter. A validação integrada usa:

- `ManifestValidator` para origem, âncoras e dimensões válidas do manifesto;
- `GlassesPoseSolver` para escala limitada e posição no referencial canônico;
- `createStudioRuntimeAdapter` para preservar espelhamento da captura e
  encaminhar o manifesto carregado ao snapshot;
- o evento `glassesLoadFailed` para mudar o modo para `degraded` sem desmontar
  o layout.

Assim, a comparação visual do GLB deve confirmar o mesmo referencial da câmera
(espelhamento horizontal), origem próxima à ponte nasal e escala compatível
com a distância interpupilar; qualquer falha permanece observável no snapshot
e não é silenciosamente corrigida pelo Studio.

## Evidência automatizada

Os testes E2E `preserves the desktop visual geometry baseline`, `preserves the
visual desktop surface hierarchy`, `keeps page scrolling disabled while panel
scrolling remains available` e `scrolls accordion columns when their content
exceeds the dock` verificam esses critérios no navegador. A suíte também cobre
resize, agrupamento de abas, persistência, ocultação e remontagem.

O baseline é desktop-only por decisão de escopo; responsividade mobile não faz
parte desta etapa.
