# Handoff — VisuTry VTO / referencial 3D facial

**Data:** 2026-09-03
**Branch:** `main`
**Repositório:** `franksunye/visutry-tryon-sdk`

## Estado entregue

O sandbox web-demo agora possui um modo Diagnóstico que exibe a malha do
MediaPipe, a caixa 2D de detecção e um box 3D facial. O box é construído a
partir de `CanonicalFaceFrame`, com origem facial e eixos locais X (linha dos
olhos), Y (vertical facial) e Z (normal aproximada).

O GLB Khronos Sunglasses está preservado em:

`examples/web-demo/public/models/references/khronos-sunglasses/SunglassesKhronos.glb`

Seu manifesto e licença ficam no mesmo diretório. SHA-256 registrado:
`25D72DD0869C99F94A3C0D6DFE0707714ECA056E531F6FF77E7545719C86AB8C`.

## Calibração atual

Após 12 frames com confiança mínima de 80%, o demo calcula a diferença entre a
ponte nasal detectada e a posição do pose e aplica 75% de uma correção limitada
à origem do ativo. A correção vale apenas durante a sessão e é reiniciada ao
trocar de armação.

O diagnóstico também compara os centros dos olhos com os centros das lentes e
classifica o resultado como `OK`, `AJUSTE FINO` ou `REVISAR ÂNCORAS`.

## Validações executadas

- `npm.cmd run build` em `examples/web-demo`: passou.
- Testes Vitest do solver/core e renderer: passaram nas execuções anteriores.
- Bancada local verificada em `http://localhost:5180/` com câmera, malha,
  seleção de modelos, box 3D e leitura de calibração.

## Próximos passos

1. Coletar uma sequência estável frontal + dois perfis.
2. Ajustar escala e profundidade das âncoras do Khronos usando o erro observado.
3. Criar teste automatizado para a transformação do box 3D.
4. Só depois avaliar a promoção do ativo para o storefront em
   `C:\GIT_CLIENT\oticas-acar`.

## Limitações e cuidados

- Profundidade de câmera é relativa; não declarar medidas faciais clínicas.
- O Khronos Sunglasses é referência de sandbox, com licença e marcas descritas
  no README do ativo.
- O storefront externo tinha alterações locais pendentes antes deste handoff;
  elas não foram misturadas nem sobrescritas.

## Branch experimental: MediaPipe canonical transform

Branch de validação: `codex/mediapipe-canonical-vto`.

Esta branch ativa a matriz de transformação canônica do MediaPipe Face
Geometry para a orientação do GLB. A translação absoluta da matriz está no
espaço métrico da câmera e não pode ser projetada diretamente no palco
ortográfico sem intrínsecos da câmera; por isso X/Y continuam ancorados nos
landmarks projetados e Z usa profundidade facial relativa. A calibração
automática por ponte nasal fica desligada para não combinar duas origens
diferentes durante o experimento.

O modo Diagnóstico exibe agora `matriz canônica: t=(x, y, z) cm` e continua
comparando os centros das lentes com os olhos. O objetivo desta etapa é validar
empiricamente sinais, escala e âncoras do GLB em frontal e perfis antes de
promover qualquer mudança ao `main`.

Validação desta branch:

- `pnpm.cmd --filter @visutry/tryon-core run build`: passou.
- Vitest core + renderer + SDK: 143 testes passaram.
- `npm.cmd run build` em `examples/web-demo`: passou.
