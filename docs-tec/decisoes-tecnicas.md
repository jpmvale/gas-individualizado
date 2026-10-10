# Decisões técnicas (ADR-G\*)

As ADRs sem prefixo citadas na especificação (ADR-001, ADR-016…) são as do coda, cujo padrão este
projeto segue. As próprias deste projeto usam o prefixo **G**.

| ADR | Decisão | Status |
| --- | --- | --- |
| ADR-G01 | **Porta `FonteLeituras` com registro por condomínio.** O worker pede leituras acumuladas a uma fonte escolhida por `condominio.fonte` (mapa `FONTES_LEITURAS`). A `FonteSimulada` é determinística (hash do medidor e da hora), então demo e testes dão sempre o mesmo número. O adaptador da Aépio entra como mais uma fonte, com seu mapper, sem tocar no schema (DEC-007). | ✅ Aceita |
| ADR-G02 | **Consumo horário materializado, dia e mês agregados em SQL.** A ingestão grava a leitura bruta (idempotente por `medidor_id, instante`) e recalcula `consumo_hora` a partir da leitura anterior. Dia e mês saem de `date_trunc` no fuso do condomínio. Leitura menor que a anterior vira `anomala` e não gera consumo negativo. | ✅ Aceita |
| ADR-G03 | **Sem particionamento de `leitura` no MVP** (8.760 linhas por medidor por ano). Particionar por mês se crescer muito. | ✅ Aceita |
| ADR-G04 | **Escopo resolvido no serviço, não no front.** Unidade fora do alcance do usuário responde **404** (não revela que existe); rota de admin sem papel responde **403**. O morador só vê dados a partir do início do vínculo (RN-012). | ✅ Aceita |
| ADR-G05 | **Sessão opaca no banco e cookie `gas_sessao`.** Token aleatório guardado como sha256, cookie httpOnly; a API aceita o cookie traduzindo-o para bearer antes do Passport. Senha em argon2id. | ✅ Aceita |
| ADR-G06 | **Deploy na VPS compartilhada, sem proxy próprio.** Mesmo arranjo do property-scout: o Caddy compartilhado (repo vps-infra) roteia `gas.imp-software.cloud` pela rede `edge` para `gas-api` e `gas-front`; o forced command `~/bin/deploy.sh` roda as migrations, sobe api, front e worker, verifica pela URL pública e reverte sozinho. O deploy automático só liga com `DEPLOY_ENABLED=true`. Runbook em [`deploy.md`](deploy.md). | ✅ Aceita |
