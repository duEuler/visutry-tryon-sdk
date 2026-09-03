# VisuTry SDK — regras de continuidade

## Escopo

Este repositório é o sandbox técnico do VisuTry usado para validar geometria
facial, pose 3D, modelos GLB e a experiência de try-on da Óticas Acar.

## Regras operacionais

- Preserve o estado do sandbox, os modelos de referência, manifestos, testes e
  documentação antes de qualquer limpeza ou reestruturação.
- Não misture este repositório com `C:\GIT_CLIENT\oticas-acar`: são árvores Git
  independentes e possuem remotos diferentes.
- Não trate a calibração monocular como medição clínica ou distância absoluta.
- Valide mudanças com build e testes; quando houver alteração visual, confirme
  também a bancada em `examples/web-demo`.
- Modelos de terceiros devem permanecer identificados por origem, licença,
  hash quando disponível e uso permitido.
- Não envie fotos, landmarks ou telemetria para serviços externos: o fluxo deve
  continuar local/on-device.

## Estado atual

O modo Diagnóstico mostra malha facial, caixa 3D, centro, eixos X/Y/Z,
comparação entre âncoras do GLB e calibração de origem por ponte nasal após
frames estáveis. Consulte `docs/handoffs/2026-09-03-visutry-vto.md` antes de
continuar.
