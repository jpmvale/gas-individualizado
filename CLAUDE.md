# gas-individualizado — guia para o Claude Code

Medição individualizada de gás (GLP) para condomínios: o morador vê o próprio consumo, o síndico
vê o prédio. Especificação em [`docs/especificacao.md`](docs/especificacao.md) (RN-\*, UC-\*,
DEC-\*, QA-\*); decisões técnicas em [`docs-tec/decisoes-tecnicas.md`](docs-tec/decisoes-tecnicas.md)
(ADR-G\*). Mesmo padrão de stack e operação do coda.

## Como trabalhar aqui

1. **Decidir junto:** trazer opções com trade-offs e uma recomendação; perguntar só nas bifurcações
   reais e marcar o resto como revisável.
2. **Registrar + propagar:** decisão fechada vira DEC/ADR, e as RNs/UCs/docs afetados são
   atualizados no mesmo commit.
3. **Idioma:** documentação, código de domínio e conversa em **português (pt-BR)**.
4. **Commits:** `tipo: frase` curta em português (`feat`, `fix`, `docs`).
5. **Testes:** `pnpm test` roda só os unitários; a integração **se pula sozinha** sem
   `TEST_DATABASE_URL`. Para valer, `pnpm test:integration` (Postgres real, `gas_test` recriado).
   Mudança de regra passa por ela antes do commit.
6. **Gerenciador de pacotes:** sempre `pnpm` direto, nunca `corepack pnpm`, `npm` ou `yarn`.

## Integração com a Aépio

A aplicação é agnóstica da fonte (DEC-007): tudo passa pela porta `FonteLeituras`
(`packages/core/src/modules/medicao/fonte-leituras.port.ts`). Hoje só existe a `FonteSimulada`;
o adaptador real entra quando a Aépio documentar os endpoints (QA-01) e é escolhido por
`condominio.fonte`. Nenhum campo da Aépio vaza para o schema.

## Estado atual

Leia [`docs-tec/HANDOFF.md`](docs-tec/HANDOFF.md) para retomar de onde a última sessão parou.
