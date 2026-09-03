# Contexto para Gemini — VisuTry / Óticas Acar

## Objetivo

Evoluir um sandbox de provação virtual de óculos com MediaPipe Face Landmarker,
Three.js e manifestos de modelos GLB. O objetivo imediato é alinhar o espaço
facial detectado ao espaço local do modelo, com observabilidade suficiente para
calibrar âncoras.

## Implementado

- frame canônico facial com origem, eixos e dimensões relativas;
- caixa 3D de diagnóstico derivada do rosto, acompanhando posição e rotação;
- pontos semânticos de olhos, ponte e nariz;
- carregamento do SunglassesK Khronos com manifesto e licença CC BY 4.0;
- normalização de escala/origem do GLB e correção para viewport `object-fit: cover`;
- calibração de sessão limitada usando a ponte nasal após 12 frames confiáveis;
- indicador de erro entre centros dos olhos e âncoras das lentes.

## Próximo trabalho recomendado

Calibrar escala e profundidade das âncoras do GLB usando várias poses (frontal,
perfil esquerdo e perfil direito), registrar os valores no manifesto e só então
promover o modelo para uso integrado no storefront.

## Limitações

A câmera monocular fornece profundidade relativa, não uma medida absoluta do
rosto. A caixa 3D é um referencial de validação. O modelo Khronos é referência
de sandbox e não deve ser tratado automaticamente como ativo comercial.

## Repositórios

- Sandbox VisuTry: `C:\Users\euler\AppData\Local\Temp\acar-visutry\visutry`
- Storefront Óticas Acar: `C:\GIT_CLIENT\oticas-acar`

Nunca misture commits entre os dois repositórios sem uma solicitação explícita.
