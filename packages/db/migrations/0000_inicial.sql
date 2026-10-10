CREATE TYPE "public"."tipo_convite" AS ENUM('morador', 'admin');--> statement-breakpoint
CREATE TYPE "public"."tipo_unidade" AS ENUM('residencial', 'area_comum');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bloco" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"condominio_id" uuid NOT NULL,
	"nome" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "condominio" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"nome" text NOT NULL,
	"cidade" text,
	"fuso" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"fator_m3_kg" numeric(6, 3) DEFAULT '2.300' NOT NULL,
	"fonte" text DEFAULT 'simulada' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consumo_hora" (
	"medidor_id" uuid NOT NULL,
	"hora" timestamp with time zone NOT NULL,
	"m3" numeric(12, 3) NOT NULL,
	CONSTRAINT "consumo_hora_medidor_id_hora_pk" PRIMARY KEY("medidor_id","hora")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "convite" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tipo" "tipo_convite" NOT NULL,
	"email" text NOT NULL,
	"nome" text NOT NULL,
	"condominio_id" uuid NOT NULL,
	"unidade_id" uuid,
	"token_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"criado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leitura" (
	"medidor_id" uuid NOT NULL,
	"instante" timestamp with time zone NOT NULL,
	"valor_m3" numeric(14, 3) NOT NULL,
	"anomala" boolean DEFAULT false NOT NULL,
	"importada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leitura_medidor_id_instante_pk" PRIMARY KEY("medidor_id","instante")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "medidor" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"unidade_id" uuid,
	"condominio_id" uuid NOT NULL,
	"id_externo" text NOT NULL,
	"modelo" text,
	"inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"fim" timestamp with time zone,
	"ultima_transmissao" timestamp with time zone,
	"ultimo_instante" timestamp with time zone,
	"bateria_v" numeric(4, 2)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "papel_admin" (
	"usuario_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "papel_admin_usuario_id_condominio_id_pk" PRIMARY KEY("usuario_id","condominio_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessao" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tarifa" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"condominio_id" uuid NOT NULL,
	"preco_kg" numeric(10, 4) NOT NULL,
	"vigente_desde" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unidade" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"bloco_id" uuid NOT NULL,
	"identificacao" text NOT NULL,
	"tipo" "tipo_unidade" DEFAULT 'residencial' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usuario" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text NOT NULL,
	"nome" text NOT NULL,
	"senha_hash" text NOT NULL,
	"operador" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vinculo" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"unidade_id" uuid NOT NULL,
	"inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"fim" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bloco" ADD CONSTRAINT "bloco_condominio_id_condominio_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominio"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consumo_hora" ADD CONSTRAINT "consumo_hora_medidor_id_medidor_id_fk" FOREIGN KEY ("medidor_id") REFERENCES "public"."medidor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "convite" ADD CONSTRAINT "convite_condominio_id_condominio_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominio"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "convite" ADD CONSTRAINT "convite_unidade_id_unidade_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidade"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "convite" ADD CONSTRAINT "convite_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leitura" ADD CONSTRAINT "leitura_medidor_id_medidor_id_fk" FOREIGN KEY ("medidor_id") REFERENCES "public"."medidor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medidor" ADD CONSTRAINT "medidor_unidade_id_unidade_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidade"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medidor" ADD CONSTRAINT "medidor_condominio_id_condominio_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominio"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "papel_admin" ADD CONSTRAINT "papel_admin_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "papel_admin" ADD CONSTRAINT "papel_admin_condominio_id_condominio_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominio"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessao" ADD CONSTRAINT "sessao_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tarifa" ADD CONSTRAINT "tarifa_condominio_id_condominio_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominio"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unidade" ADD CONSTRAINT "unidade_bloco_id_bloco_id_fk" FOREIGN KEY ("bloco_id") REFERENCES "public"."bloco"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_unidade_id_unidade_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidade"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bloco_nome_uq" ON "bloco" USING btree ("condominio_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "convite_token_uq" ON "convite" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "convite_condominio_idx" ON "convite" USING btree ("condominio_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "medidor_externo_uq" ON "medidor" USING btree ("id_externo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "medidor_unidade_idx" ON "medidor" USING btree ("unidade_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessao_token_uq" ON "sessao" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessao_usuario_idx" ON "sessao" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unidade_ident_uq" ON "unidade" USING btree ("bloco_id","identificacao");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usuario_email_uq" ON "usuario" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vinculo_usuario_idx" ON "vinculo" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vinculo_unidade_idx" ON "vinculo" USING btree ("unidade_id");