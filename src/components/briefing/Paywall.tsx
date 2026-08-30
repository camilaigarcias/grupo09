'use client';

import { useEffect, useRef, useState } from 'react';
import { PRECO_BUSCA } from '@/lib/config';

type Fase = 'oferta' | 'processando' | 'aprovado';

const BENEFICIOS = [
  '10+ fornecedores pesquisados em fontes públicas',
  'Evidências clicáveis em cada critério',
  'Relatório em PDF para a política de compras',
  'Resultado reaproveitável por 30 dias',
];

interface PaywallProps {
  cidade: string;
  categoriasLabels: string[];
  onPagar: () => void;
  onVoltar: () => void;
}

// Paywall de demonstração: NÃO existe checkout nesta versão — o clique em
// "Ir para pagamento" simula a aprovação e então libera a pesquisa (onPagar).
export default function Paywall({ cidade, categoriasLabels, onPagar, onVoltar }: PaywallProps) {
  const [fase, setFase] = useState<Fase>('oferta');
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    const pendentes = timers.current;
    return () => pendentes.forEach(clearTimeout);
  }, []);

  function pagar() {
    if (fase !== 'oferta') return;
    setFase('processando');
    timers.current.push(
      setTimeout(() => {
        setFase('aprovado');
        timers.current.push(setTimeout(onPagar, 800));
      }, 1200),
    );
  }

  return (
    <div className="paywall-wrap">
      <section className="paywall-card" aria-busy={fase === 'processando'}>
        <p className="paywall-eyebrow">Pesquisa completa</p>
        <h1 className="paywall-titulo">Desbloqueie a busca</h1>
        <p className="paywall-preco">
          <span className="paywall-valor">{PRECO_BUSCA}</span>
          <span className="paywall-preco-sub">pagamento único por pesquisa</span>
        </p>

        <ul className="paywall-beneficios">
          {BENEFICIOS.map((b) => (
            <li key={b}>
              <span className="ico" aria-hidden="true">✓</span> {b}
            </li>
          ))}
        </ul>

        <p className="paywall-resumo">
          <strong>O que vamos pesquisar:</strong> {categoriasLabels.join(', ')}
          {cidade ? ` · ${cidade}` : ''}
        </p>

        <button
          className="btn btn-primary btn-block paywall-cta"
          onClick={pagar}
          disabled={fase !== 'oferta'}
          aria-live="polite"
        >
          {fase === 'oferta' && 'Ir para pagamento →'}
          {fase === 'processando' && (
            <>
              <span className="spinner" aria-hidden="true" /> Processando pagamento…
            </>
          )}
          {fase === 'aprovado' && '✓ Pagamento aprovado (simulado nesta versão)'}
        </button>
        <button className="btn-link paywall-voltar" onClick={onVoltar} disabled={fase !== 'oferta'}>
          ‹ Voltar e revisar
        </button>

        <p className="paywall-nota">
          Pagamento ilustrativo — o checkout real entra na próxima versão.
        </p>
      </section>
    </div>
  );
}
