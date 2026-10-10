/*
 * Client da API. O front chama sempre caminhos relativos (/api/*): em dev o Next repassa à API,
 * em produção o Caddy roteia. A sessão viaja num cookie httpOnly que este código nunca lê.
 */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function api<T>(caminho: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${caminho}`, {
      method: opts.method ?? "GET",
      headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, "Não foi possível falar com o servidor. Tente de novo.");
  }
  const texto = await res.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (!res.ok) {
    const m = dados?.message;
    throw new ApiError(res.status, Array.isArray(m) ? m.join("; ") : m || `Erro ${res.status}`);
  }
  return dados as T;
}

export interface UnidadeDoMorador {
  unidadeId: string;
  identificacao: string;
  bloco: string;
  condominioId: string;
  condominio: string;
  desde: string;
}

export interface Me {
  id: string;
  email: string;
  nome: string;
  operador: boolean;
  unidades: UnidadeDoMorador[];
  condominiosAdmin: { id: string; nome: string }[];
}

export interface PontoSerie {
  periodo: string;
  m3: number;
  mediaCondominio: number | null;
}

export interface Resumo {
  unidade: { id: string; identificacao: string; bloco: string; tipo: string };
  condominio: { id: string; nome: string; fatorM3Kg: number; precoKg: number | null };
  medidor: { idExterno: string; modelo: string | null; ultimaTransmissao: string | null; dadosAte: string | null; bateriaV: number | null; leituraAtualM3: number | null } | null;
  mes: { referencia: string; m3: number; kg: number; valor: number | null; projecaoValor: number | null };
  hoje: { m3: number };
  comparacao: { mediaDiaria: number; mediaCondominio: number | null; dias: number; de: string; ate: string } | null;
}

export type Situacao = "normal" | "sem_comunicacao" | "bateria_baixa" | "sem_medidor";

export interface UnidadeAdmin {
  id: string;
  identificacao: string;
  bloco: string;
  tipo: "residencial" | "area_comum";
  moradores: string | null;
  medidor: { idExterno: string; modelo: string | null; ultimaTransmissao: string | null; dadosAte: string | null; bateriaV: number | null } | null;
  m3Mes: number;
  mediaDiariaMes: number | null;
  situacao: Situacao;
  vsMedia: number | null;
}

export interface Painel {
  condominio: { id: string; nome: string; cidade: string | null; fatorM3Kg: number; precoKg: number | null };
  mes: { m3: number; kg: number; valor: number | null };
  medidores: { total: number; semComunicacao: number };
  pendencias: UnidadeAdmin[];
  maiorConsumo: UnidadeAdmin[];
  porDia: { periodo: string; m3: number; medidores: number }[];
}

export interface Moradores {
  ativos: { id: string; nome: string; email: string; desde: string; unidadeId: string; unidade: string }[];
  convitesPendentes: { id: string; nome: string; email: string; tipo: string; expiraEm: string; unidade: string | null }[];
}
