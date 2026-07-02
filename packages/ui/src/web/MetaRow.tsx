import type { ReactNode } from 'react';

import type { StatusTone } from '../tokens';

export type MetaRowItem = {
  key?: string;
  label: string;
  value: ReactNode;
  /** Optional tone tint for this single stat, e.g. risk=critical reads red even inside a neutral row. */
  tone?: StatusTone;
};

export type MetaRowProps = {
  items: MetaRowItem[];
  'aria-label'?: string;
};

/**
 * Compact label/value stat strip for freshness, confidence, risk, and
 * activation state — replaces plain <dl> text dumps with scannable,
 * optionally tone-tinted chips, matching the status-strip pattern in
 * docs/mockups/screens/operational-map.png.
 */
export function MetaRow({ items, ...rest }: MetaRowProps) {
  return (
    <dl className="zc-meta-row" {...rest}>
      {items.map((item, index) => (
        <div
          key={item.key ?? `${item.label}-${index}`}
          className={['zc-meta-row__item', item.tone ? `zc-meta-row__item--${item.tone}` : null].filter(Boolean).join(' ')}
        >
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
