# Deploy

Produção é a **VPS compartilhada** (Hostinger) onde já rodam coda, kindred, expense-analyzer, fdp e
property-scout, com o mesmo desenho deles. Domínio: **gas.imp-software.cloud**. A configuração do
lado da máquina vive no repositório **vps-infra** (Caddyfile, `bin/deploy.sh`).

## Topologia

```
   Internet ──443──▶ container `caddy` (Caddyfile estático em ~/caddy, repo vps-infra)
                         └─ gas.imp-software.cloud → gas-api:3000 (/api/*) · gas-front:3001
                                     ▲
                       rede docker externa `edge`
                                     │
   ~/apps/gas-individualizado: postgres · redis · migrate · api · worker · front
   (nenhuma porta publicada no host)
```

O `docker-compose.prod.yml` acrescenta o `front`, dá nomes fixos aos containers (`gas-api`,
`gas-front`), liga os dois à `edge` e remove a porta do Postgres. Não há Caddy próprio: o
roteamento é um bloco no Caddyfile compartilhado.

## Pré-requisitos (uma vez)

1. **DNS.** Registro **A** de `gas` em `imp-software.cloud` → `187.77.242.128`, no painel da
   Hostinger. Desde 03/08/2026 não há curinga: sem o registro, o Caddy não emite certificado.
2. **Clone na VPS** em `~/apps/gas-individualizado`. O repositório é público, então basta
   `git clone https://github.com/jpmvale/gas-individualizado ~/apps/gas-individualizado`. O forced
   command faz `git checkout --detach <sha>`, então o compose vem do mesmo commit da imagem.
3. **`.env` de produção** em `~/apps/gas-individualizado/.env` (não versionado, o deploy nunca o
   sobrescreve):

   ```
   POSTGRES_PASSWORD=<senha forte, definida antes do primeiro up>
   APP_URL=https://gas.imp-software.cloud
   SESSION_TTL=30d
   # Convites por e-mail. Vazio = o link do convite vai para o log da API.
   RESEND_API_KEY=
   EMAIL_FROM=Gás Individualizado <no-reply@mail.imp-software.cloud>
   ```

4. **vps-infra:** o ramo `gas-individualizado` no `bin/deploy.sh` e o bloco no `caddy/Caddyfile`,
   copiados para a VPS (`scp` + `caddy reload`). Sem o ramo, o deploy morre com "app não
   reconhecido", que é o comportamento correto do script.
5. **Secrets do repositório** (Settings → Secrets and variables → Actions):

   | Nome | O que é |
   |---|---|
   | `VPS_HOST` | IP da VPS |
   | `VPS_DEPLOY_KEY` | a mesma chave dos outros apps: `~/.ssh/id_fdp_deploy` da máquina de desenvolvimento, cuja pública já está no `authorized_keys` da VPS presa ao `deploy.sh` |

   ```bash
   gh secret set VPS_DEPLOY_KEY -R jpmvale/gas-individualizado < ~/.ssh/id_fdp_deploy
   ```

   Não há `GHCR_TOKEN`: o repositório é público e o `GITHUB_TOKEN` do próprio Actions publica no
   GHCR. A VPS continua baixando as imagens com o login `read:packages` que já tem.

   E em *Variables*: **`DEPLOY_ENABLED=true`**, que liga o deploy automático a cada merge (ligada
   depois do primeiro deploy manual dar certo), e **`NEXT_PUBLIC_DEMO=false`**. A demo de produção
   é **fechada** (decisão do João Pedro, 10/10/2026): sem os botões "entrar como", que enviam a senha
   fixa `gas12345`. Para abrir a demo, trocar a variável para `true`, redefinir a senha das contas
   demo para `gas12345` e publicar de novo (a variável é lida no build do front).

## O deploy

`.github/workflows/deploy.yml` roda depois do CI verde em `main` (ou por disparo manual em
Actions → deploy → Run workflow):

1. checkout do commit que o CI aprovou;
2. build e push de `gas-individualizado-api` (backend, compartilhada por migrate, api e worker) e
   `gas-individualizado-front` no GHCR, marcadas com o sha curto e `latest`;
3. `ssh deploy@<vps> "gas-individualizado <sha>"`, preso ao `~/bin/deploy.sh` pelo
   `authorized_keys`.

Na VPS o script roda as **migrations** (`run --rm migrate`) antes do `up`, sobe `api`, `front` e
`worker`, confere que os containers rodam a imagem pedida, verifica pela URL pública (a raiz deve
responder **307**, o desvio para o login, e `/api/health` **200**) e reverte sozinho para a tag
anterior se a verificação falhar, saindo com erro mesmo depois de reverter.

## Primeiro acesso (dados de demonstração)

Enquanto a Aépio não entrega os endpoints (QA-01), o condomínio de produção é o da demo, com a fonte
simulada. Depois do primeiro deploy, uma vez:

```bash
cd ~/apps/gas-individualizado
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm \
  -e DEMO_SENHA='<senha das contas demo>' worker node apps/worker/dist/demo-seed.js
```

A senha usada está em `~/.config/gas-demo-senha` na VPS (modo 600), fora de qualquer repositório; vale
para as três contas demo. O seed é idempotente (não recria o condomínio se ele existe). A partir daí o worker sincroniza de
hora em hora e o histórico continua crescendo em tempo real.

## Operação

```bash
cd ~/apps/gas-individualizado
C="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

$C ps
$C logs -f api
$C logs -f worker                 # sincronização das leituras
tail -f ~/backups/deploy.log      # o que o forced command fez
cat ~/.deploy-state/gas-individualizado   # sha no ar
```

**Rollback manual** (a chave do Actions só roda o script):

```bash
cd ~/apps/gas-individualizado
git checkout --detach <sha-anterior>
IMAGE_TAG=<sha-anterior> docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

`docker compose down` não apaga o banco; `down -v` apaga, não use.

## Ainda não feito

- **Backup** do Postgres: com dados simulados não há o que proteger. Entra quando chegar o primeiro
  condomínio real, no mesmo molde do property-scout (`backup-postgres.sh` no cron da VPS).
- **Sonda e alerta** de disponibilidade no Grafana, como os outros apps.
