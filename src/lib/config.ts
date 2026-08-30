// Configuração central do app.
// A marca/naming chega depois do build inicial: TODO nome exibido sai daqui.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Autopilot de Eventos';
export const APP_TAGLINE =
  'Fornecedores de evento validados por reputação, com evidências.';

export const DEFAULT_CITY = process.env.NEXT_PUBLIC_DEFAULT_CITY ?? 'Curitiba';

export const PRECO_BUSCA = process.env.NEXT_PUBLIC_PRECO_BUSCA ?? 'R$ 20,00';

// Modo demo: sem chave da Anthropic (ou forçado via MOCK_MODE) a pipeline
// roda com dados simulados de fornecedores FICTÍCIOS — mesmo fluxo, sem rede.
export function isMockMode(): boolean {
  if (process.env.MOCK_MODE === 'true') return true;
  return !process.env.ANTHROPIC_API_KEY;
}

export const MODELS = {
  descobridor: process.env.MODEL_DESCOBRIDOR ?? 'claude-haiku-4-5',
  verificador: process.env.MODEL_VERIFICADOR ?? 'claude-sonnet-5',
  refinador: process.env.MODEL_REFINADOR ?? 'claude-sonnet-5',
  justificativas: process.env.MODEL_JUSTIFICATIVAS ?? 'claude-sonnet-5',
};

// Limites do dossiê (P1): buscas por agente, paralelismo e timeouts.
export const LIMITS = {
  buscasDescobridor: 8,
  buscasVerificador: 6,
  buscasRefinador: 4,
  verificadoresParalelos: 3,
  timeoutMs: 60_000,
  retriesPorFornecedor: 1,
  cacheDias: 30,
  candidatosPorCategoria: 10,
};
