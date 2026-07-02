import type { ReactNode } from 'react';

export type SectionHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  titleId?: string;
  /** Trailing content aligned to the right, e.g. a live count like "3 online". */
  trailing?: ReactNode;
};

/**
 * Eyebrow + title + trailing-content header used at the top of every
 * operational section (work centers, resources, SOS, dispatch).
 */
export function SectionHeader({ eyebrow, title, titleId, trailing }: SectionHeaderProps) {
  return (
    <div className="zc-section-header">
      <div>
        {eyebrow ? <p className="zc-eyebrow">{eyebrow}</p> : null}
        <h2 id={titleId} className="zc-section-header__title">
          {title}
        </h2>
      </div>
      {trailing ? <div className="zc-section-header__trailing">{trailing}</div> : null}
    </div>
  );
}
