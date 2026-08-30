// MODO DEMONSTRAÇÃO — RN-18: fornecedores 100% FICTÍCIOS (nunca empresas
// reais; o app não fabrica reputação de terceiros). O snapshot é uma função
// PURA de (id, agora): funciona igual em dev local e em serverless frio.
// Importante: o mock também passa pelo motor REAL de score (score.ts) —
// a nota exibida na demo sai do mesmo código auditável da pipeline real.
import seedJson from '../../../seed/fornecedores.json';
import { categoriaLabel } from '../categorias';
import { scoreFornecedor } from '../score';
import type {
  Achado,
  CandidatoResultado,
  CriterioId,
  DadosVerificacao,
  RankingCategoria,
  RankingResponse,
  ScoreResultado,
} from '../types';
import { CRITERIO_LABELS } from '../types';
import { decodeMockId } from './mockId';
import { entre, pick, rngFor, shuffle, type Rng } from './rng';

// ---------- Cronograma simulado (ms desde a criação da busca) ----------
const STAGGER_CATEGORIA = 2500; // categorias começam escalonadas
const DESCOBERTA_MS = 3500;
const ONDA_MS = 7000; // simula pLimit(3): 3 verificadores por onda
const REFINO_MS = 3500;
const N_CANDIDATOS = 10;

// Ordem de preenchimento do checklist na tela 2 (ordem real do Verificador).
const ORDEM_CRITERIOS: CriterioId[] = [
  'cnpj_ativo', 'idade_empresa', 'cnae_compativel', 'sancoes_publicas',
  'reclame_aqui', 'noticias_negativas', 'google_rating', 'teor_avaliacoes',
  'processos_judiciais', 'site_com_cnpj', 'instagram_ativo',
  'contato_consistente', 'diretorios_setor',
];

const DDD: Record<string, string> = {
  curitiba: '41', 'sao paulo': '11', 'são paulo': '11', 'rio de janeiro': '21',
  'belo horizonte': '31', 'porto alegre': '51', 'florianopolis': '48',
  'florianópolis': '48', brasilia: '61', 'brasília': '61', salvador: '71',
};

const SUFIXOS = ['Produções', 'Serviços', 'Eventos', 'Prime', 'Corporativo', '& Cia'];
const FANTASIA = ['Alvorada', 'Meridiano', 'Jacarandá', 'Horizonte', 'Aurora', 'Pinheiral', 'Andaraí', 'Boreal', 'Mirante', 'Encosta', 'Baluarte', 'Vertente'];

function gs(q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function slug(nome: string): string {
  return nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function nomesPara(categoriaId: string, rng: Rng): string[] {
  const seed = (seedJson as Record<string, unknown>)[categoriaId];
  if (Array.isArray(seed)) return shuffle(rng, seed as string[]).slice(0, N_CANDIDATOS);
  // Gerador determinístico para categorias fora do seed.
  const chave = categoriaLabel(categoriaId).split(/[\s/(]+/)[0];
  const nomes = new Set<string>();
  while (nomes.size < N_CANDIDATOS) {
    nomes.add(`${chave} ${pick(rng, FANTASIA)} ${pick(rng, SUFIXOS)}`);
  }
  return [...nomes];
}

// ---------- Perfis de desfecho (mix da demo) ----------
type Perfil =
  | 'cache_verificado' | 'cache_atencao' | 'verificado_forte' | 'verificado'
  | 'atencao_pegada_baixa' | 'atencao_cnae' | 'sem_cnpj' | 'borda_refino'
  | 'evitar_eliminatoria' | 'falha';

const PERFIS: Perfil[] = [
  'cache_verificado', 'cache_atencao', 'verificado_forte', 'verificado',
  'atencao_pegada_baixa', 'atencao_cnae', 'sem_cnpj', 'borda_refino',
  'evitar_eliminatoria', 'falha',
];

interface PerfilMontado {
  dados: DadosVerificacao;
  achados: Achado[];
  // Para o caso de borda: estado após a auditoria adversarial do Refinador.
  refino?: { dados: DadosVerificacao; achados: Achado[]; flagsExtra: string[] };
}

function cnpjFicticio(rng: Rng): string {
  const d = () => Math.floor(rng() * 10);
  // Faixa 99.9xx — fora dos intervalos atribuídos; reforça que é fictício.
  return `99.9${d()}${d()}.${d()}${d()}${d()}/0001-${d()}${d()}`;
}

function mk(
  criterio: CriterioId, valor: string, url: string | null, conf: number,
  status: Achado['status'] = 'ok', inferencia = false,
): Achado {
  return { criterio, valor, evidenciaUrl: url, confianca: conf, status, inferencia };
}

function naoVerif(criterio: CriterioId): Achado {
  return mk(criterio, 'Não encontrado em fontes públicas', null, 0, 'nao_verificavel');
}

function montarPerfil(perfil: Perfil, nome: string, cidade: string, rng: Rng): PerfilMontado {
  const q = `"${nome}" ${cidade}`;
  const anoAbertura = 2026 - Math.round(entre(rng, 3, 9));
  const base: DadosVerificacao = {
    cnpj: {
      numero: cnpjFicticio(rng),
      situacao: 'ATIVA',
      aberturaISO: `${anoAbertura}-0${1 + Math.floor(rng() * 8)}-15`,
      idadeAnos: 2026 - anoAbertura,
      cnae: '5620-1/02',
      cnaeCompativel: true,
      evidenciaUrl: gs(`CNPJ ${q}`),
    },
    sancoes: { encontradas: false },
    google: { nota: null, numAvaliacoes: null },
    negativasGraves: 0,
    reclameAqui: { status: 'sem_pagina' },
    noticiaGolpe: { confirmada: false },
    processos: { volumeAlto: false },
    siteComCnpjBatendo: null,
    instagramAtivo60d: null,
    contatoConsistente: null,
    emDiretoriosSetor: null,
    flags: [],
  };

  const achadosBase = (d: DadosVerificacao): Achado[] => [
    d.cnpj
      ? mk('cnpj_ativo', `CNPJ ${d.cnpj.numero} — situação ${d.cnpj.situacao} na Receita Federal`, d.cnpj.evidenciaUrl, 0.95, d.cnpj.situacao === 'ATIVA' ? 'ok' : 'eliminatorio')
      : naoVerif('cnpj_ativo'),
    d.cnpj
      ? mk('idade_empresa', `Empresa aberta em ${d.cnpj.aberturaISO.slice(0, 4)} (${d.cnpj.idadeAnos} anos)`, d.cnpj.evidenciaUrl, 0.95, d.cnpj.idadeAnos >= 2 ? 'ok' : 'atencao')
      : naoVerif('idade_empresa'),
    d.cnpj
      ? mk('cnae_compativel', d.cnpj.cnaeCompativel ? `CNAE ${d.cnpj.cnae} compatível com o serviço` : `CNAE ${d.cnpj.cnae} de outra atividade`, d.cnpj.evidenciaUrl, 0.9, d.cnpj.cnaeCompativel ? 'ok' : 'atencao')
      : naoVerif('cnae_compativel'),
    mk('sancoes_publicas', d.sancoes.encontradas ? (d.sancoes.detalhe ?? 'Sanção pública registrada') : 'Nenhuma sanção no CEIS/CNEP', d.sancoes.evidenciaUrl ?? gs(`CEIS CNEP ${q}`), 0.85, d.sancoes.encontradas ? 'eliminatorio' : 'ok'),
    d.reclameAqui.status === 'sem_pagina'
      ? mk('reclame_aqui', 'Sem página no Reclame Aqui (neutro)', gs(`site:reclameaqui.com.br ${q}`), 0.7)
      : mk('reclame_aqui', d.reclameAqui.status === 'nao_recomendada' ? 'Status "Não recomendada" no Reclame Aqui' : `Nota ${d.reclameAqui.nota?.toFixed(1)} no Reclame Aqui, reclamações respondidas`, d.reclameAqui.evidenciaUrl ?? gs(`site:reclameaqui.com.br ${q}`), 0.85, d.reclameAqui.status === 'nao_recomendada' ? 'eliminatorio' : 'ok'),
    mk('noticias_negativas', d.noticiaGolpe.confirmada ? (d.noticiaGolpe.teor ?? 'Notícia de golpe com evidência') : 'Nenhuma notícia de golpe/calote encontrada', d.noticiaGolpe.evidenciaUrl ?? gs(`${q} golpe OR estelionato OR calote`), 0.8, d.noticiaGolpe.confirmada ? 'eliminatorio' : 'ok'),
    d.google.nota != null
      ? mk('google_rating', `Nota ${d.google.nota.toFixed(1)} · ${d.google.numAvaliacoes} avaliações no Google`, d.google.evidenciaUrl ?? gs(q), 0.9)
      : naoVerif('google_rating'),
    d.google.nota != null
      ? mk('teor_avaliacoes', d.negativasGraves > 0.1 ? 'Negativas recentes incluem atraso de entrega' : 'Negativas raras, sem padrão de "não entregou/sumiu"', gs(`${q} avaliações`), 0.7, d.negativasGraves > 0.1 ? 'atencao' : 'ok', true)
      : naoVerif('teor_avaliacoes'),
    mk('processos_judiciais', d.processos.volumeAlto ? 'Volume alto de processos visíveis (dado parcial)' : 'Sem volume relevante de processos visíveis', d.processos.evidenciaUrl ?? gs(`site:jusbrasil.com.br ${q}`), 0.6, d.processos.volumeAlto ? 'atencao' : 'ok'),
    d.siteComCnpjBatendo == null
      ? naoVerif('site_com_cnpj')
      : mk('site_com_cnpj', d.siteComCnpjBatendo ? 'Site próprio com CNPJ no rodapé, batendo com a Receita' : 'Site sem CNPJ divulgado', d.siteComCnpjBatendo ? `https://www.example.com/${slug(nome)}` : gs(q), 0.85, d.siteComCnpjBatendo ? 'ok' : 'atencao'),
    d.instagramAtivo60d == null
      ? naoVerif('instagram_ativo')
      : mk('instagram_ativo', d.instagramAtivo60d ? 'Instagram ativo, posts nos últimos 30 dias' : 'Instagram sem posts recentes', gs(`instagram ${q}`), 0.75, d.instagramAtivo60d ? 'ok' : 'atencao', true),
    d.contatoConsistente == null
      ? naoVerif('contato_consistente')
      : mk('contato_consistente', d.contatoConsistente ? 'Mesmo telefone no site, no Google e no Instagram' : 'Telefones divergentes entre canais', gs(`${q} telefone`), 0.8, d.contatoConsistente ? 'ok' : 'atencao'),
    d.emDiretoriosSetor == null
      ? naoVerif('diretorios_setor')
      : mk('diretorios_setor', d.emDiretoriosSetor ? 'Presente em diretórios do setor com avaliações' : 'Não encontrado em diretórios do setor', gs(`${q} diretório eventos`), 0.7),
  ];

  const d = base;
  switch (perfil) {
    case 'cache_verificado':
    case 'verificado_forte':
      d.google = { nota: 4.8, numAvaliacoes: 320, evidenciaUrl: gs(q) };
      d.negativasGraves = 0.05;
      d.reclameAqui = { status: 'ok', nota: 8.4, evidenciaUrl: gs(`site:reclameaqui.com.br ${q}`) };
      d.siteComCnpjBatendo = true; d.instagramAtivo60d = true;
      d.contatoConsistente = true; d.emDiretoriosSetor = true;
      break;
    case 'verificado':
      d.google = { nota: 4.4, numAvaliacoes: 120, evidenciaUrl: gs(q) };
      d.reclameAqui = { status: 'ok', nota: 8.0, evidenciaUrl: gs(`site:reclameaqui.com.br ${q}`) };
      d.siteComCnpjBatendo = true; d.instagramAtivo60d = true;
      d.contatoConsistente = true; d.emDiretoriosSetor = true;
      break;
    case 'cache_atencao':
    case 'atencao_cnae':
      if (d.cnpj) { d.cnpj.cnaeCompativel = false; d.cnpj.cnae = '4712-1/00'; }
      d.google = { nota: 3.9, numAvaliacoes: 25, evidenciaUrl: gs(q) };
      d.negativasGraves = 0.15;
      d.instagramAtivo60d = true; d.contatoConsistente = true;
      d.emDiretoriosSetor = false; d.siteComCnpjBatendo = null;
      break;
    case 'atencao_pegada_baixa':
      // O bom fornecedor invisível: regra de justiça em ação.
      d.siteComCnpjBatendo = null; d.instagramAtivo60d = null;
      d.contatoConsistente = null; d.emDiretoriosSetor = null;
      break;
    case 'sem_cnpj':
      d.cnpj = null;
      d.google = { nota: 4.7, numAvaliacoes: 150, evidenciaUrl: gs(q) };
      d.reclameAqui = { status: 'ok', nota: 7.8, evidenciaUrl: gs(`site:reclameaqui.com.br ${q}`) };
      d.instagramAtivo60d = true; d.contatoConsistente = true; d.emDiretoriosSetor = true;
      break;
    case 'borda_refino':
      d.google = { nota: 4.6, numAvaliacoes: 85, evidenciaUrl: gs(q) };
      d.negativasGraves = 0.08;
      d.reclameAqui = { status: 'ok', nota: 7.2, evidenciaUrl: gs(`site:reclameaqui.com.br ${q}`) };
      d.siteComCnpjBatendo = true; d.instagramAtivo60d = true;
      d.contatoConsistente = null; d.emDiretoriosSetor = false;
      break;
    case 'evitar_eliminatoria':
      if (d.cnpj) { d.cnpj.situacao = 'BAIXADA'; d.cnpj.idadeAnos = 1; }
      d.google = { nota: 4.0, numAvaliacoes: 12, evidenciaUrl: gs(q) };
      break;
    case 'falha':
      break;
  }

  const achados = achadosBase(d);

  if (perfil === 'borda_refino') {
    // Refinador confirma a consistência de contato com nova evidência.
    const dRef: DadosVerificacao = { ...d, contatoConsistente: true, flags: [...d.flags] };
    const aRef = achadosBase(dRef);
    return { dados: d, achados, refino: { dados: dRef, achados: aRef, flagsExtra: ['refino_confirmou_contato'] } };
  }
  return { dados: d, achados };
}

function justificativaPara(nome: string, dados: DadosVerificacao, score: ScoreResultado): string {
  if (score.eliminatoria) {
    return `Critério eliminatório não atendido: ${score.eliminatoria.motivo}. Evidência registrada na fonte citada.`;
  }
  const partes: string[] = [];
  if (dados.cnpj) partes.push(`CNPJ ativo desde ${dados.cnpj.aberturaISO.slice(0, 4)}`);
  if (dados.google.nota != null) partes.push(`nota ${dados.google.nota.toFixed(1)} em ${dados.google.numAvaliacoes} avaliações no Google`);
  if (dados.reclameAqui.status === 'ok' && dados.reclameAqui.nota != null) partes.push(`Reclame Aqui ${dados.reclameAqui.nota.toFixed(1)} com reclamações respondidas`);
  if (dados.contatoConsistente) partes.push('contato consistente entre canais');
  if (partes.length === 0) partes.push('poucos dados públicos verificáveis — reputação não pôde ser medida em volume');
  return partes.join('; ') + '.';
}

// ---------- Montagem do snapshot ----------
interface CandidatoTimeline {
  final: CandidatoResultado;
  preRefino?: CandidatoResultado;
  apareceEm: number;
  verInicio: number;
  verFim: number;
  fimTotal: number; // inclui refino, quando houver
  perfil: Perfil;
}

function montarCandidato(
  buscaId: string, categoriaId: string, cidade: string, i: number, nome: string, discFim: number,
): CandidatoTimeline {
  const rng = rngFor(buscaId, categoriaId, i);
  const perfil = PERFIS[i % PERFIS.length];
  const m = montarPerfil(perfil, nome, cidade, rng);

  const ddd = DDD[cidade.trim().toLowerCase()] ?? '41';
  const tel = `(${ddd}) 5555-0${100 + Math.floor(rng() * 900)}`;
  const doCache = perfil === 'cache_verificado' || perfil === 'cache_atencao';

  const idxOnda = Math.max(0, i - 2); // i 0–1 são cache (instantâneos)
  const onda = Math.floor(idxOnda / 3);
  const verInicio = doCache ? discFim : discFim + onda * ONDA_MS + (idxOnda % 3) * 600;
  const verDur = entre(rng, 5500, 7500);
  const verFim = doCache ? discFim : verInicio + verDur;
  const temRefino = perfil === 'borda_refino';
  const fimTotal = temRefino ? verFim + REFINO_MS : verFim;

  const base: CandidatoResultado = {
    id: `${categoriaId}-${i}`,
    nome,
    cidade,
    telefone: tel,
    site: m.dados.siteComCnpjBatendo ? `https://www.example.com/${slug(nome)}` : undefined,
    instagram: m.dados.instagramAtivo60d ? `@${slug(nome).slice(0, 24)} (perfil simulado)` : undefined,
    fonte: pick(rng, ['busca web (simulada)', 'diretório do setor (simulado)', 'lista pública (simulada)']),
    status: 'concluido',
  };

  const concluir = (dados: DadosVerificacao, achados: Achado[], flagsExtra: string[] = []): CandidatoResultado => {
    const score = scoreFornecedor({ ...dados, flags: [...dados.flags, ...flagsExtra] }, achados);
    return {
      ...base,
      status: 'concluido',
      achados,
      score: score.total,
      tier: score.tier,
      pilares: score.pilares,
      eliminatoria: score.eliminatoria,
      flags: score.flags,
      mensagemAcao: score.mensagemAcao,
      naoVerificavel: achados.filter((a) => a.status === 'nao_verificavel').map((a) => CRITERIO_LABELS[a.criterio]),
      justificativa: justificativaPara(nome, dados, score),
      doCache,
      refinado: !!m.refino,
    };
  };

  if (perfil === 'falha') {
    const reveladas = m.achados.slice(0, 5);
    return {
      final: {
        ...base,
        status: 'nao_verificado',
        achados: reveladas,
        naoVerificavel: m.achados.slice(5).map((a) => CRITERIO_LABELS[a.criterio]),
        mensagemAcao: 'A verificação falhou após 1 nova tentativa (timeout simulado). Este fornecedor não entra no ranking — rode a pesquisa novamente para tentar de novo.',
      },
      apareceEm: discFim, verInicio, verFim, fimTotal, perfil,
    };
  }

  const final = m.refino
    ? concluir(m.refino.dados, m.refino.achados, m.refino.flagsExtra)
    : concluir(m.dados, m.achados);
  const preRefino = m.refino
    ? { ...base, status: 'refinando' as const, achados: m.achados }
    : undefined;

  return { final, preRefino, apareceEm: discFim, verInicio, verFim, fimTotal, perfil };
}

function fatiar(t: CandidatoTimeline, decorrido: number): CandidatoResultado | null {
  if (decorrido < t.apareceEm) return null;
  const { final } = t;
  if (final.doCache) return final; // cache: resultado instantâneo (o moat)
  if (decorrido < t.verInicio) {
    return { id: final.id, nome: final.nome, cidade: final.cidade, telefone: final.telefone, site: final.site, instagram: final.instagram, fonte: final.fonte, status: 'aguardando' };
  }
  if (decorrido < t.verFim) {
    const total = (t.final.achados?.length ?? 13) || 13;
    const passo = (t.verFim - t.verInicio) / (total + 1);
    const n = Math.min(total, Math.floor((decorrido - t.verInicio) / passo));
    const achadosCompletos = t.preRefino?.achados ?? final.achados ?? [];
    return {
      id: final.id, nome: final.nome, cidade: final.cidade, telefone: final.telefone, site: final.site, instagram: final.instagram, fonte: final.fonte,
      status: 'verificando',
      achados: achadosCompletos.slice(0, n),
    };
  }
  if (t.preRefino && decorrido < t.fimTotal) return t.preRefino;
  return final;
}

export function mockSnapshot(id: string, agoraMs: number): RankingResponse | null {
  const payload = decodeMockId(id);
  if (!payload) return null;
  const decorrido = Math.max(0, agoraMs - payload.t);

  const categorias: RankingCategoria[] = payload.cats.map((categoriaId, j) => {
    const catInicio = j * STAGGER_CATEGORIA;
    const discFim = catInicio + DESCOBERTA_MS;
    const rngNomes = rngFor(id, categoriaId, 'nomes');
    const nomes = nomesPara(categoriaId, rngNomes);

    if (decorrido < catInicio) {
      return { categoriaId, categoriaLabel: categoriaLabel(categoriaId), status: 'aguardando', candidatos: [] };
    }
    if (decorrido < discFim) {
      return { categoriaId, categoriaLabel: categoriaLabel(categoriaId), status: 'descobrindo', candidatos: [] };
    }

    const timelines = nomes.map((nome, i) =>
      montarCandidato(id, categoriaId, payload.cidade, i, nome, discFim),
    );
    const candidatos = timelines
      .map((t) => fatiar(t, decorrido))
      .filter((c): c is CandidatoResultado => c !== null);
    const terminou = timelines.every((t) => decorrido >= t.fimTotal);

    return {
      categoriaId,
      categoriaLabel: categoriaLabel(categoriaId),
      status: terminou ? 'concluida' : 'verificando',
      candidatos,
    };
  });

  return {
    id,
    cidade: payload.cidade,
    criadoEm: new Date(payload.t).toISOString(),
    mock: true,
    status: categorias.every((c) => c.status === 'concluida') ? 'concluida' : 'rodando',
    categorias,
    avisos: payload.avisos,
  };
}
