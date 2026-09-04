# Migração gradual para o Golden Layout Studio

Este documento orienta a migração de consumidores da rota legada
`/audit-studio.html` para `/golden-layout-studio/index.html` sem interromper
sessões existentes.

## Fases

1. **Compatibilidade** — mantenha a rota legada publicada. Ela continua usando
   o runtime existente e oferece o link `Abrir Golden Layout Studio`.
2. **Opt-in** — encaminhe usuários que aceitarem a mudança para
   `/audit-studio.html?studio=golden`. O bridge redireciona para o Studio novo
   preservando a origem em `from=legacy`.
3. **Adoção** — novas telas devem importar `@visutry/studio` e fornecer um
   `StudioRuntimeAdapter`; não copie a inicialização de câmera, MediaPipe,
   Three.js ou GLB para os painéis.
4. **Retirada controlada** — remova a rota legada somente quando os acessos
   estiverem abaixo do limite definido pelo produto e os consumidores tiverem
   migrado. Antes disso, mantenha o bridge como fallback por uma versão.

## Contratos preservados

- A persistência do Golden Layout usa uma chave própria e não sobrescreve o
  estado da rota antiga.
- O runtime é conectado somente após ação explícita do usuário; sem conexão o
  Studio permanece `static`, com métricas, GLB e evidências neutros.
- `studio.destroy()` deve ser chamado no desmontar da tela para liberar
  observers, listeners, câmera e renderer.

## Rollback

Para interromper a adoção, remova apenas o link de opt-in ou desative o
encaminhamento `studio=golden`. A rota `/audit-studio.html` continua sendo o
fallback e nenhum estado do Studio precisa ser apagado.

## Critérios de conclusão

- consumidores usam o pacote `@visutry/studio` diretamente;
- a matriz desktop/cross-browser permanece verde;
- câmera física e alinhamento GLB foram validados no dispositivo-alvo;
- não existem acessos críticos ou dependências exclusivas da rota legada.
