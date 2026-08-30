'use client';

import { useEffect } from 'react';
import type { Tier } from '@/lib/types';

// Tier sempre com ícone + palavra + cor — nunca só cor (docs/ux.md §7).
export const TIER_INFO: Record<Tier, { icone: string; palavra: string; badge: string }> = {
  VERIFICADO: { icone: '✓', palavra: 'Verificado', badge: 'badge-ok' },
  ATENCAO: { icone: '⚠', palavra: 'Atenção', badge: 'badge-warn' },
  EVITAR: { icone: '✕', palavra: 'Evitar', badge: 'badge-danger' },
};

export function TierBadge({ tier, score }: { tier: Tier; score?: number }) {
  const t = TIER_INFO[tier];
  return (
    <span className={`badge ${t.badge}`}>
      <span aria-hidden="true">{t.icone}</span> {t.palavra}
      {typeof score === 'number' && (
        <span className="score-num">
          {' '}
          · {score}/100
        </span>
      )}
    </span>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

// Toast (DS §4.22): confirmação de ação, auto-dismiss em 5s.
// Quem renderiza controla a montagem: {toast && <Toast … onFechar={…} />}.
export function Toast({ mensagem, onFechar }: { mensagem: string; onFechar: () => void }) {
  useEffect(() => {
    const t = setTimeout(onFechar, 5000);
    return () => clearTimeout(t);
  }, [onFechar]);

  return (
    <div className="toast" role="status">
      <span className="ico" aria-hidden="true">✓</span>
      <span>{mensagem}</span>
      <button type="button" className="toast-fechar" onClick={onFechar} aria-label="Fechar aviso">
        ✕
      </button>
    </div>
  );
}

// EmptyState (DS §4.26): ícone em círculo + título + texto + CTA opcional.
export function EmptyState({
  icone = '🔍',
  titulo,
  children,
  cta,
}: {
  icone?: string;
  titulo: string;
  children?: React.ReactNode;
  cta?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-ico" aria-hidden="true">{icone}</span>
      <h3>{titulo}</h3>
      {children != null && <p>{children}</p>}
      {cta}
    </div>
  );
}
