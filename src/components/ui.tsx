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
