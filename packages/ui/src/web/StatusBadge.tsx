import { statusToneLabels, statusToneMarkers, type StatusTone } from '../tokens';

export type StatusBadgeProps = {
  tone: StatusTone;
  /** Overrides the default tone label with domain-specific copy (e.g. "Confirmada" instead of "Confirmed"). */
  label?: string;
  /** Overrides the default tone marker glyph. */
  marker?: string;
  className?: string;
};

/**
 * Tone-coded status pill matching the badge language from docs/mockups
 * (operational-map.png, recommendations.png): a short marker plus a label,
 * colored by the same status-tone palette used across mobile and web so
 * "critical" always reads the same regardless of channel.
 */
export function StatusBadge({ tone, label, marker, className }: StatusBadgeProps) {
  const resolvedLabel = label ?? statusToneLabels[tone];
  const resolvedMarker = marker ?? statusToneMarkers[tone];

  return (
    <span className={['zc-status-badge', `zc-status-badge--${tone}`, className].filter(Boolean).join(' ')}>
      <span className="zc-status-badge__marker" aria-hidden="true">
        {resolvedMarker}
      </span>
      <span className="zc-status-badge__label">{resolvedLabel}</span>
    </span>
  );
}
