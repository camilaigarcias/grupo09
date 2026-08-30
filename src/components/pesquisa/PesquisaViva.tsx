'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CRITERIO_LABELS, type Achado, type CandidatoResultado, type CriterioId, type RankingCategoria } from '@/lib/types';
import { Spinner, TierBadge } from '@/components/ui';
import { useRanking } from '@/components/useRanking';

const ORDEM_CRITERIOS = Object.keys(CRITERIO_LABELS) as CriterioId[];

const ICONE_ACHADO: Record<Achado['status'], string> = {
  ok: '✔',
  atencao: '⚠',
  eliminatorio: '✕',
  nao_verificavel: '─',
};

export default function PesquisaViva({ id }: { id: string }) {
  const router = useRouter();
  const { data, notFound, erroRede } = useRanking(id);
  const jaRedirecionou = useRef(false);

  useEffect(() => {
    if (data?.status === 'concluida' && !jaRedirecionou.current) {
      jaRedirecionou.current = true;
      const t = setTimeout(() => router.push(`/ranking/${id}`), 1500);
      return () => clearTimeout(t);
    }
  }, [data?.status, id, router]);

  if (notFound) {
    return (
      <div className="container">
        <h1>Pesquisa não encontrada</h1>
        <p className="lede">
          Este link pode ter expirado (no modo demonstração as pesquisas não ficam salvas
          para sempre).
        </p>
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
          <Spinner /> Preparando a pesquisa…
        </h1>
        {erroRede && (
          <p className="note note-warn" role="alert">
            Sem resposta do servidor — tentando de novo…
          </p>
        )}
      </div>
    );
  }

  const todosCandidatos = data.categorias.flatMap((c) => c.candidatos);
  const prontos = todosCandidatos.filter(
    (c) => c.status === 'concluido' || c.status === 'nao_verificado',
  ).length;
  const total = todosCandidatos.length;
  const algumaConcluida = data.categorias.some((c) => c.status === 'concluida');

  return (
    <div className="container container-wide">
      <h1>
        {data.status === 'concluida' ? 'Pesquisa concluída' : 'Pesquisando fornecedores…'}
      </h1>
      <p className="lede">
        {data.categorias.map((c) => c.categoriaLabel).join(' · ')} em <b>{data.cidade}</b>
      </p>

      <div className="stepper-top" aria-live="polite" role="status">
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: total > 0 ? `${(prontos / total) * 100}%` : '5%' }}
          />
        </div>
        <span>
          {total > 0 ? `${prontos} de ${total} verificados` : 'descobrindo candidatos…'}
        </span>
      </div>

      {erroRede && (
        <p className="note note-warn" role="alert">
          Sem resposta do servidor — tentando de novo…
        </p>
      )}
      {data.status === 'erro' && (
        <div className="note note-warn" role="alert">
          <p style={{ margin: 0 }}>
            A pesquisa encontrou um erro e não pôde continuar. Suas respostas não se
            perderam.
          </p>
          <a className="btn" href="/" style={{ marginTop: 8 }}>
            Tentar de novo
          </a>
        </div>
      )}

      {data.categorias.map((cat) => (
        <CategoriaSecao key={cat.categoriaId} cat={cat} />
      ))}

      <p className="privado">
        Isso leva de 1 a 3 minutos. Cada verificação consulta Receita Federal, Google,
        Reclame Aqui, notícias e redes sociais{data.mock ? ' (simuladas no modo demonstração)' : ''}.
      </p>

      <div className="acoes-topo">
        {data.status === 'concluida' ? (
          <a className="btn btn-primary btn-block" href={`/ranking/${id}`}>
            Ver ranking →
          </a>
        ) : (
          <a
            className="btn"
            aria-disabled={!algumaConcluida}
            style={!algumaConcluida ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
            href={`/ranking/${id}?parcial=1`}
          >
            Ver ranking parcial →
          </a>
        )}
      </div>
    </div>
  );
}

function CategoriaSecao({ cat }: { cat: RankingCategoria }) {
  const prontos = cat.candidatos.filter(
    (c) => c.status === 'concluido' || c.status === 'nao_verificado',
  ).length;
  return (
    <section className="categoria-secao">
      <h2>
        {cat.categoriaLabel}{' '}
        <span className="privado">
          {cat.status === 'aguardando' && '· na fila'}
          {cat.status === 'descobrindo' && '· descobrindo candidatos…'}
          {cat.status === 'verificando' && `· ${prontos}/${cat.candidatos.length} verificados`}
          {cat.status === 'concluida' && `· ${cat.candidatos.length} verificados ✓`}
          {cat.status === 'erro' && '· erro nesta categoria'}
        </span>
      </h2>
      {cat.status === 'descobrindo' && cat.candidatos.length === 0 && (
        <p className="note">
          <Spinner /> Buscando empresas reais desta categoria na cidade…
        </p>
      )}
      {cat.status === 'concluida' && cat.candidatos.length === 0 && (
        <p className="note note-warn">
          Não encontramos fornecedores desta categoria na cidade. Tente outra cidade — ou
          rode de novo mais tarde.
        </p>
      )}
      <div className="cards-grid">
        {cat.candidatos.map((c) => (
          <CandidatoVivo key={c.id} c={c} />
        ))}
      </div>
    </section>
  );
}

function CandidatoVivo({ c }: { c: CandidatoResultado }) {
  const achados = c.achados ?? [];
  const feitos = new Set(achados.map((a) => a.criterio));
  const pendentes = ORDEM_CRITERIOS.filter((cr) => !feitos.has(cr));

  return (
    <article className="cand-card" role="status">
      <div className="cand-head">
        <h3>{c.nome}</h3>
        {c.status === 'aguardando' && <span className="badge badge-neutral">na fila</span>}
        {c.status === 'verificando' && (
          <span className="badge badge-accent">
            <Spinner /> {achados.length}/{ORDEM_CRITERIOS.length}
          </span>
        )}
        {c.status === 'refinando' && (
          <span className="badge badge-accent">🔍 auditoria adversarial</span>
        )}
        {c.status === 'nao_verificado' && (
          <span className="badge badge-neutral">não verificado</span>
        )}
        {c.status === 'concluido' && c.tier && <TierBadge tier={c.tier} score={c.score} />}
      </div>
      {c.fonte && <p className="fonte" style={{ margin: '2px 0 0' }}>{c.fonte}</p>}
      {c.doCache && (
        <p style={{ margin: '6px 0 0' }}>
          <span className="badge badge-accent">🔁 validado há menos de 30 dias — reaproveitado</span>
        </p>
      )}

      {c.status === 'nao_verificado' && (
        <p className="privado" style={{ marginTop: 8 }}>
          {c.justificativa ?? 'Tempo esgotado na consulta — não derrubou o restante da pesquisa.'}
        </p>
      )}

      {(c.status === 'verificando' || c.status === 'refinando') && (
        <ul className="checklist-vivo">
          {achados.map((a) => (
            <li key={a.criterio}>
              <span className="ico" aria-hidden="true">
                {ICONE_ACHADO[a.status]}
              </span>
              <span>
                {CRITERIO_LABELS[a.criterio]}
                {a.valor && <span className="valor"> — {a.valor}</span>}
              </span>
            </li>
          ))}
          {c.status === 'verificando' && pendentes.length > 0 && (
            <li>
              <span className="ico">
                <Spinner />
              </span>
              <span>Verificando {CRITERIO_LABELS[pendentes[0]].toLowerCase()}…</span>
            </li>
          )}
          {pendentes.slice(1, 4).map((cr) => (
            <li key={cr} className="pendente">
              <span className="ico" aria-hidden="true">
                ○
              </span>
              <span>{CRITERIO_LABELS[cr]}</span>
            </li>
          ))}
          {pendentes.length > 4 && (
            <li className="pendente">
              <span className="ico" aria-hidden="true">
                ○
              </span>
              <span>+ {pendentes.length - 4} critérios na fila</span>
            </li>
          )}
        </ul>
      )}

      {c.status === 'concluido' && c.justificativa && (
        <p className="privado" style={{ marginTop: 8 }}>{c.justificativa}</p>
      )}
    </article>
  );
}
