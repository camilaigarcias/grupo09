'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { APP_NAME } from '@/lib/config';
import {
  CRITERIO_LABELS,
  type Achado,
  type CandidatoResultado,
  type CriterioId,
  type RankingCategoria,
} from '@/lib/types';
import { Spinner, TierBadge } from '@/components/ui';
import { useRanking } from '@/components/useRanking';

const GRUPOS: Array<{ titulo: string; criterios: CriterioId[] }> = [
  {
    titulo: 'Cadastral (peso 30%)',
    criterios: ['cnpj_ativo', 'idade_empresa', 'cnae_compativel', 'sancoes_publicas'],
  },
  {
    titulo: 'Reputação (peso 40%)',
    criterios: ['google_rating', 'teor_avaliacoes', 'reclame_aqui', 'noticias_negativas', 'processos_judiciais'],
  },
  {
    titulo: 'Presença e consistência (peso 20%)',
    criterios: ['site_com_cnpj', 'instagram_ativo', 'contato_consistente', 'diretorios_setor'],
  },
];

const ICONE_ACHADO: Record<Achado['status'], string> = {
  ok: '✔',
  atencao: '⚠',
  eliminatorio: '✕',
  nao_verificavel: '─',
};

// Flags de transparência (dossiê: "o cliente vê o porquê").
const FLAG_LABELS: Record<string, string> = {
  possivel_homonimo: 'possível homônimo — dados atribuídos com cautela',
  verificacao_inconclusiva: 'verificação inconclusiva',
  pegada_digital_baixa: 'pouca presença digital verificável',
};

export default function RankingView({ id, parcial }: { id: string; parcial: boolean }) {
  const router = useRouter();
  const { data, notFound } = useRanking(id);

  useEffect(() => {
    if (data?.status === 'rodando' && !parcial) {
      router.replace(`/pesquisa/${id}`);
    }
  }, [data?.status, parcial, id, router]);

  if (notFound) {
    return (
      <div className="container">
        <h1>Ranking não encontrado</h1>
        <p className="lede">Este link pode ter expirado.</p>
        <a className="btn btn-primary" href="/">
          Fazer nova pesquisa
        </a>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container">
        <h1>
          <Spinner /> Carregando ranking…
        </h1>
      </div>
    );
  }

  const dataFmt = new Date(data.criadoEm).toLocaleDateString('pt-BR');

  return (
    <div className="container container-wide">
      <h1>Ranking de fornecedores</h1>
      <p className="lede">
        {data.categorias.map((c) => c.categoriaLabel).join(' · ')} · <b>{data.cidade}</b> ·{' '}
        {dataFmt}
      </p>
      <p className="privado">🔒 Relatório privado — só você vê.</p>

      <div className="acoes-topo no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨 Baixar PDF
        </button>
        <a className="btn" href="/">
          Nova pesquisa
        </a>
        {data.status === 'rodando' && (
          <a className="btn" href={`/pesquisa/${id}`}>
            <Spinner /> Ainda verificando — acompanhar
          </a>
        )}
      </div>

      <div className="metodo-box">
        <b>Como pontuamos:</b> Cadastral 30% · Reputação 40% · Presença 20% ·
        Verificabilidade 10%. Nota de corte: ✓ Verificado ≥75 · ⚠ Atenção 50–74 · ✕
        Evitar &lt;50 ou critério eliminatório (CNPJ inapto/baixado, sanção pública,
        indício de golpe com evidência, “não recomendada” no Reclame Aqui). Pouca
        presença digital nunca leva a “Evitar” — vira “Atenção” com o motivo escrito.
        Todo achado aponta para a fonte.
      </div>

      {data.avisos.map((a) => (
        <p key={a} className="note note-warn">
          💡 {a}
        </p>
      ))}

      {data.categorias.map((cat) => (
        <CategoriaRanking key={cat.categoriaId} cat={cat} />
      ))}

      <p className="privado" style={{ marginTop: 24 }}>
        {APP_NAME} · relatório privado — uso interno · gerado em {dataFmt}
        {data.mock && ' · modo demonstração: fornecedores fictícios e dados simulados'}
      </p>
    </div>
  );
}

function CategoriaRanking({ cat }: { cat: RankingCategoria }) {
  const concluidos = cat.candidatos.filter((c) => c.status === 'concluido');
  const rankeados = concluidos
    .filter((c) => c.tier !== 'EVITAR')
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const evitar = concluidos.filter((c) => c.tier === 'EVITAR');
  const naoVerificados = cat.candidatos.filter((c) => c.status === 'nao_verificado');
  const pendentes = cat.candidatos.filter(
    (c) => c.status !== 'concluido' && c.status !== 'nao_verificado',
  );

  return (
    <section className="categoria-secao">
      <h2>
        {cat.categoriaLabel} <span className="privado">({concluidos.length} verificados)</span>
      </h2>

      {cat.candidatos.length === 0 && cat.status === 'concluida' && (
        <p className="note note-warn">
          Não encontramos fornecedores desta categoria na cidade pesquisada.
        </p>
      )}
      {pendentes.length > 0 && (
        <p className="note">
          <Spinner /> {pendentes.length}{' '}
          {pendentes.length === 1 ? 'fornecedor ainda em verificação' : 'fornecedores ainda em verificação'}
          …
        </p>
      )}

      {rankeados.map((c, i) => (
        <CandidatoRank key={c.id} c={c} pos={i + 1} />
      ))}

      {evitar.length > 0 && (
        <div className="evitar-secao">
          <h3 style={{ marginBottom: 8 }}>
            ✕ Encontramos, mas não recomendamos — veja por quê
          </h3>
          {evitar.map((c) => (
            <CandidatoRank key={c.id} c={c} />
          ))}
        </div>
      )}

      {naoVerificados.length > 0 && (
        <div className="nao-verificavel" style={{ marginTop: 16 }}>
          <b>Não conseguimos verificar:</b>
          <ul>
            {naoVerificados.map((c) => (
              <li key={c.id}>
                {c.nome} — {c.justificativa ?? 'tempo esgotado na consulta'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function CandidatoRank({ c, pos }: { c: CandidatoResultado; pos?: number }) {
  const [aberto, setAberto] = useState(false);
  const achados = c.achados ?? [];
  const porCriterio = new Map(achados.map((a) => [a.criterio, a]));

  return (
    <article className="cand-card rank-card">
      <div className="cand-head">
        <h3>
          {pos != null && <span className="rank-pos">{pos}º · </span>}
          {c.nome}
        </h3>
        {c.tier && <TierBadge tier={c.tier} score={c.score} />}
      </div>

      {(c.telefone || c.site || c.instagram) && (
        <p className="privado" style={{ margin: '4px 0 0' }}>
          {[c.telefone, c.site, c.instagram].filter(Boolean).join(' · ')}
        </p>
      )}
      {c.doCache && (
        <p style={{ margin: '6px 0 0' }}>
          <span className="badge badge-accent">🔁 validado há menos de 30 dias — reaproveitado</span>
        </p>
      )}
      {c.refinado && (
        <p style={{ margin: '6px 0 0' }}>
          <span className="badge badge-neutral">🔍 passou por auditoria adversarial</span>
        </p>
      )}
      {c.flags && c.flags.length > 0 && (
        <p style={{ margin: '6px 0 0' }}>
          {c.flags
            .map((f) => FLAG_LABELS[f])
            .filter(Boolean)
            .map((label) => (
              <span key={label} className="badge badge-warn" style={{ marginRight: 6 }}>
                {label}
              </span>
            ))}
        </p>
      )}

      {c.justificativa && <p style={{ margin: '8px 0 0' }}>{c.justificativa}</p>}

      {c.eliminatoria && (
        <div className="eliminatoria-box">
          <b>Critério eliminatório:</b> {c.eliminatoria.motivo}
          {c.eliminatoria.evidenciaUrl && (
            <>
              {' '}
              (
              <a className="evidencia" href={c.eliminatoria.evidenciaUrl} target="_blank" rel="noopener noreferrer">
                fonte ↗
              </a>
              )
            </>
          )}
        </div>
      )}
      {c.mensagemAcao && <div className="acao-box">→ {c.mensagemAcao}</div>}

      {c.pilares && !c.eliminatoria && (
        <div className="pilares">
          <PilarRow nome="Cadastral" peso={30} valor={c.pilares.cadastral} />
          <PilarRow nome="Reputação" peso={40} valor={c.pilares.reputacao} />
          <PilarRow nome="Presença" peso={20} valor={c.pilares.presenca} />
          <PilarRow nome="Verificabilidade" peso={10} valor={c.pilares.verificabilidade} />
        </div>
      )}

      {achados.length > 0 && (
        <>
          <button
            className="acc-toggle no-print"
            aria-expanded={aberto}
            onClick={() => setAberto(!aberto)}
          >
            {aberto ? '▾ ocultar verificação completa' : '▸ ver verificação completa'}
          </button>
          <div className={`acc-body${aberto ? '' : ' closed'}`}>
            {GRUPOS.map((g) => {
              const doGrupo = g.criterios
                .map((cr) => porCriterio.get(cr))
                .filter((a): a is Achado => a != null && a.status !== 'nao_verificavel');
              if (doGrupo.length === 0) return null;
              return (
                <div key={g.titulo}>
                  <p className="achados-grupo">{g.titulo}</p>
                  {doGrupo.map((a) => (
                    <p key={a.criterio} className="achado-row">
                      <span className="ico" aria-hidden="true">
                        {ICONE_ACHADO[a.status]}
                      </span>
                      <span>
                        {CRITERIO_LABELS[a.criterio]}: {a.valor}
                        {a.evidenciaUrl && (
                          <>
                            {' '}
                            <a
                              className="evidencia"
                              href={a.evidenciaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              fonte ↗
                            </a>
                          </>
                        )}
                        {a.inferencia && <em className="privado"> (inferência)</em>}
                      </span>
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {c.naoVerificavel && c.naoVerificavel.length > 0 && (
        <div className="nao-verificavel">
          <b>O que não conseguimos verificar:</b>
          <ul>
            {c.naoVerificavel.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function PilarRow({ nome, peso, valor }: { nome: string; peso: number; valor: number }) {
  return (
    <div className="pilar-row">
      <span>
        {nome} ({peso}%)
      </span>
      <div className="pilar-bar">
        <span style={{ width: `${Math.round(valor * 100)}%` }} />
      </div>
      <span className="score-num">{Math.round(valor * peso)}</span>
    </div>
  );
}
