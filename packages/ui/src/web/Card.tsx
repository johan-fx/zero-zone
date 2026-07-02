import type { ElementType, HTMLAttributes, PropsWithChildren } from 'react';

import type { StatusTone } from '../tokens';

export type CardProps = PropsWithChildren<
  {
    /** Colors the card's left accent border to match a status tone, e.g. sos-critical cards read red at a glance. */
    tone?: StatusTone;
    as?: ElementType;
    className?: string;
  } & HTMLAttributes<HTMLElement>
>;

/**
 * Operational card surface with an optional tone-colored left accent
 * border, mirroring the recommendation cards in docs/mockups/screens/recommendations.png.
 */
export function Card({ tone, as: Component = 'article', className, children, ...rest }: CardProps) {
  const classes = ['zc-card', tone ? `zc-card--${tone}` : null, className].filter(Boolean).join(' ');

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
