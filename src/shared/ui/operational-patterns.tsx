import { PropsWithChildren, ReactNode } from 'react';
import { Paragraph, Text, XStack, YStack, type YStackProps } from 'tamagui';

import { StatusTone } from '@/shared/theme';
import {
  ActionButton,
  BottomActionPanel,
  FreshnessBadge,
  MapMarkerPill,
  MetricTile,
  OperationalCard,
  ResourceListItem,
  RiskLabel,
  SectionSurface,
  StatusBadge,
} from './operational';

type StatusDescriptor = {
  tone: StatusTone;
  label: string;
  marker?: string;
};

const toneBorder = {
  info: '$info',
  success: '$success',
  warning: '$warning',
  risk: '$risk',
  sos: '$sos',
  stale: '$stale',
  pending: '$pending',
  conflict: '$conflict',
} as const satisfies Record<StatusTone, string>;

const toneSurface = {
  info: '$infoSurface',
  success: '$successSurface',
  warning: '$warningSurface',
  risk: '$riskSurface',
  sos: '$sosSurface',
  stale: '$staleSurface',
  pending: '$pendingSurface',
  conflict: '$conflictSurface',
} as const satisfies Record<StatusTone, string>;

export function OperationalHeader({
  title,
  subtitle,
  leadingIcon,
  status,
  backLabel,
}: {
  title: string;
  subtitle: string;
  leadingIcon?: string;
  status?: StatusDescriptor;
  backLabel?: string;
}) {
  return (
    <XStack items="center" justify="space-between" gap="$3">
      <XStack items="center" gap="$3" grow={1}>
        {backLabel ? (
          <Text color="$text" fontSize="$xl" fontWeight="900">
            ‹
          </Text>
        ) : null}
        {leadingIcon ? (
          <YStack items="center" justify="center" bg="$primarySurface" borderColor="$primary" rounded="$pill" borderWidth={1} height={38} width={38}>
            <Text color="$primary" fontSize="$sm" fontWeight="900">
              {leadingIcon}
            </Text>
          </YStack>
        ) : null}
        <YStack gap="$1" grow={1}>
          <Text color="$text" fontSize="$xl" fontWeight="900">
            {title}
          </Text>
          <Text color="$textMuted" fontSize="$xs" fontWeight="700">
            {subtitle}
          </Text>
        </YStack>
      </XStack>
      {status ? <StatusBadge tone={status.tone} label={status.label} marker={status.marker} /> : null}
    </XStack>
  );
}

export type MapShellMarker = {
  id: string;
  label: string;
  tone: StatusTone;
  x: string;
  y: string;
};

export function MapShell({
  variant = 'operational',
  markers,
  children,
  minH = 340,
  ...props
}: PropsWithChildren<
  YStackProps & {
    variant?: 'operational' | 'task' | 'sos';
    markers: readonly MapShellMarker[];
    minH?: number;
  }
>) {
  const isSos = variant === 'sos';
  const isTask = variant === 'task';
  const streets = [
    { top: 52, rotate: '-12deg', opacity: 0.38 },
    { top: 104, rotate: '19deg', opacity: 0.5 },
    { top: 148, rotate: '-22deg', opacity: 0.42 },
    { top: 194, rotate: '8deg', opacity: 0.36 },
    { top: 242, rotate: '-8deg', opacity: 0.4 },
    { top: 292, rotate: '16deg', opacity: 0.32 },
  ] as const;
  const verticals = [
    { left: '18%', rotate: '8deg', opacity: 0.24 },
    { left: '42%', rotate: '-5deg', opacity: 0.2 },
    { left: '68%', rotate: '6deg', opacity: 0.22 },
  ] as const;

  return (
    <YStack bg="$mapBase" borderColor="$borderColor" rounded="$card" borderWidth={1} minH={minH} overflow="hidden" p="$map" {...props}>
      <XStack height={5} bg="$mapWater" l={-26} opacity={0.8} position="absolute" r={-18} t={78} transform={[{ rotate: '-17deg' }]} />
      <XStack height={4} bg="$mapWater" l={-20} opacity={0.46} position="absolute" r={-28} t={206} transform={[{ rotate: '20deg' }]} />
      {streets.map((street) => (
        <XStack
          key={`${street.top}-${street.rotate}`}
          height={2}
          bg="$borderColor"
          l={-22}
          opacity={street.opacity}
          position="absolute"
          r={-22}
          t={street.top}
          transform={[{ rotate: street.rotate }]}
        />
      ))}
      {verticals.map((street) => (
        <YStack
          key={`${street.left}-${street.rotate}`}
          bg="$borderColor"
          b={-24}
          l={street.left}
          opacity={street.opacity}
          position="absolute"
          t={-24}
          transform={[{ rotate: street.rotate }]}
          width={2}
        />
      ))}
      {!isSos ? (
        <>
          <YStack bg="$warningSurface" borderColor="$warning" borderWidth={1} height={116} opacity={0.36} position="absolute" r="9%" rounded="$panel" t="56%" width={120} />
          <YStack bg="$infoSurface" borderColor="$info" borderWidth={1} height={132} l="4%" opacity={0.28} position="absolute" rounded="$panel" t="30%" width={118} />
          <YStack bg="$riskSurface" borderColor="$risk" borderWidth={1} height={86} l="12%" opacity={0.24} position="absolute" rounded="$panel" t="62%" width={104} />
        </>
      ) : null}
      <YStack borderColor="$mapRoute" rounded="$panel" borderStyle="dashed" borderWidth={2} l={18} r={18} t={20} b={20} opacity={0.78} position="absolute" />
      <XStack
        bg={isTask ? '$warning' : '$mapRoute'}
        height={3}
        l="18%"
        opacity={0.95}
        position="absolute"
        r="18%"
        t={isTask ? '46%' : '54%'}
        transform={[{ rotate: isTask ? '-8deg' : '13deg' }]}
      />
      {isSos ? (
        <YStack
          bg="$sosSurface"
          borderColor="$sos"
          rounded="$pill"
          borderWidth={2}
          height={130}
          l="34%"
          opacity={0.72}
          position="absolute"
          t="28%"
          width={130}
        />
      ) : null}
      {markers.map((marker) => (
        <YStack key={marker.id} position="absolute" style={{ left: marker.x, top: marker.y }}>
          <MapMarkerPill tone={marker.tone} label={marker.label} />
        </YStack>
      ))}
      {children}
    </YStack>
  );
}

export function OperationalFilterTile({ marker, label, tone }: { marker: string; label: string; tone: StatusTone }) {
  return (
    <OperationalCard variant="default" px="$3" py="$2" minW={82} grow={1}>
      <YStack items="center" gap="$1">
        <StatusBadge tone={tone} label={marker} marker={marker} />
        <Text color="$text" fontSize="$xs" fontWeight="800" text="center">
          {label}
        </Text>
      </YStack>
    </OperationalCard>
  );
}

export function ResourceNeedList({
  missing,
  surplus,
  resource,
  urgency,
}: {
  missing: string[];
  surplus: string[];
  resource?: { label: string; detail: string; tone?: StatusTone };
  urgency?: StatusDescriptor;
}) {
  return (
    <SectionSurface>
      <XStack gap="$3">
        <YStack grow={1} gap="$2">
          <StatusBadge tone="sos" label="Missing" marker="−" />
          {missing.map((item) => (
            <ResourceListItem key={item}>{item}</ResourceListItem>
          ))}
        </YStack>
        <YStack grow={1} gap="$2">
          <StatusBadge tone="success" label="Surplus" marker="+" />
          {surplus.map((item) => (
            <ResourceListItem key={item}>{item}</ResourceListItem>
          ))}
        </YStack>
      </XStack>
      {resource ? (
        <OperationalCard variant="default" p="$3">
          <XStack items="center" justify="space-between">
            <YStack>
              <Text color="$text" fontSize="$lg" fontWeight="900">
                {resource.label}
              </Text>
              <Text color="$textMuted" fontSize="$xs" fontWeight="700">
                {resource.detail}
              </Text>
            </YStack>
            <StatusBadge tone={resource.tone ?? 'info'} label="Resource" />
          </XStack>
        </OperationalCard>
      ) : null}
      {urgency ? <StatusBadge tone={urgency.tone} label={urgency.label} marker={urgency.marker} /> : null}
    </SectionSurface>
  );
}

export function CenterSummaryCard({
  name,
  type,
  status,
  confidence,
  freshness,
  risk,
  missing,
  surplus,
  roles,
  compact = false,
  children,
}: PropsWithChildren<{
  name: string;
  type: string;
  status: StatusDescriptor;
  confidence: string;
  freshness: string;
  risk: string;
  missing: string[];
  surplus: string[];
  roles: Array<{ label: string; value: string; tone?: StatusTone }>;
  compact?: boolean;
}>) {
  return (
    <OperationalCard testID="compound-center-summary" p="$3">
      <YStack gap="$3">
        <XStack items="center" justify="space-between" gap="$3">
          <YStack gap="$1" grow={1}>
            <Text color="$text" fontSize={compact ? '$lg' : '$xxl'} fontWeight="900">
              {name}
            </Text>
            <Text color="$textMuted" fontSize="$xs" fontWeight="700">
              {type}
            </Text>
          </YStack>
          <StatusBadge tone={status.tone} label={status.label} marker={status.marker} />
        </XStack>
        <XStack flexWrap="wrap" gap="$2">
          <StatusBadge tone="info" label={confidence} />
          <FreshnessBadge label={freshness} />
          <RiskLabel label={risk} />
        </XStack>
        {!compact ? <ResourceNeedList missing={missing} surplus={surplus} /> : null}
        <XStack gap="$2">
          {roles.map((role) => (
            <MetricTile key={role.label} label={role.label} value={role.value} tone={role.tone ?? 'info'} />
          ))}
        </XStack>
        {children}
      </YStack>
    </OperationalCard>
  );
}

export function RecommendationCard({
  tone,
  title,
  reason,
  distance,
  freshness,
  risk,
  primaryAction,
}: {
  tone: 'success' | 'warning' | 'risk';
  title: string;
  reason: string;
  distance: string;
  freshness: string;
  risk: string;
  primaryAction: string;
}) {
  return (
    <OperationalCard testID="compound-recommendation-card" borderLeftColor={toneBorder[tone]} borderLeftWidth={5} p="$3">
      <YStack gap="$3">
        <XStack items="center" justify="space-between" gap="$3">
          <YStack gap="$1" grow={1}>
            <Text color="$text" fontSize="$lg" fontWeight="900">
              {title}
            </Text>
            <Text color="$textMuted" fontSize="$xs" fontWeight="700">
              {reason}
            </Text>
          </YStack>
          <StatusBadge tone={tone} label={tone === 'success' ? 'Recommended' : tone === 'warning' ? 'Confirm first' : 'Not recommended'} />
        </XStack>
        <XStack gap="$2">
          <StatusBadge tone="info" label={freshness} />
          <StatusBadge tone={tone} label={risk} />
          <StatusBadge tone="stale" label={distance} />
        </XStack>
        <ActionButton label={primaryAction} tone={tone === 'risk' ? 'stale' : tone} />
      </YStack>
    </OperationalCard>
  );
}

export function SyncStatePanel({
  local,
  network,
  status,
  actions,
}: {
  local: { title: string; detail: string; tone?: StatusTone };
  network: { title: string; detail: string; tone?: StatusTone };
  status: StatusDescriptor;
  actions: Array<{ label: string; tone: 'primary' | 'info' | 'success' | 'warning' | 'risk' | 'sos' | 'stale' }>;
}) {
  return (
    <OperationalCard testID="compound-sync-state" borderColor={toneBorder[status.tone]} p="$3">
      <YStack gap="$3">
        <XStack items="center" justify="space-between" gap="$3">
          <YStack grow={1}>
            <Text color="$text" fontSize="$xl" fontWeight="900">
              Sync conflict
            </Text>
            <Text color="$textMuted" fontSize="$xs" fontWeight="700">
              Derived state will be recalculated from operations.
            </Text>
          </YStack>
          <StatusBadge tone={status.tone} label={status.label} marker={status.marker} />
        </XStack>
        <XStack items="center" gap="$2">
          {[local, network].map((entry) => (
            <YStack key={entry.title} bg={toneSurface[entry.tone ?? 'info']} borderColor={toneBorder[entry.tone ?? 'info']} rounded="$control" borderWidth={1} grow={1} gap="$1" p="$3">
              <Text color="$text" fontSize="$sm" fontWeight="900">
                {entry.title}
              </Text>
              <Text color="$textMuted" fontSize="$xs" fontWeight="700">
                {entry.detail}
              </Text>
            </YStack>
          ))}
        </XStack>
        <XStack flexWrap="wrap" gap="$2">
          {actions.map((action) => (
            <ActionButton key={action.label} grow={1} label={action.label} tone={action.tone} />
          ))}
        </XStack>
      </YStack>
    </OperationalCard>
  );
}

export function AvailabilityPanel({
  status,
  primaryAction,
  secondaryAction,
}: {
  status: StatusDescriptor;
  primaryAction: string;
  secondaryAction: string;
}) {
  return (
    <MockFaithfulBottomPanel>
      <XStack items="center" gap="$3">
        <XStack items="center" gap="$3" grow={1}>
          <YStack items="center" justify="center" bg="$successSurface" borderColor="$success" rounded="$pill" borderWidth={2} height={54} width={54}>
            <Text color="$success" fontSize="$md" fontWeight="900">
              ON
            </Text>
          </YStack>
          <YStack gap="$1" grow={1}>
            <Text color="$text" fontSize="$xl" fontWeight="900">
              Available
            </Text>
            <StatusBadge tone={status.tone} label={status.label} marker={status.marker} />
          </YStack>
        </XStack>
        <YStack gap="$2" grow={1} minW={0}>
          <ActionButton label={primaryAction} />
          <ActionButton label={secondaryAction} tone="info" priority="normal" />
        </YStack>
      </XStack>
    </MockFaithfulBottomPanel>
  );
}

export function EmergencyActionRow({
  actions,
}: {
  actions: Array<{ label: string; tone: 'primary' | 'info' | 'success' | 'warning' | 'risk' | 'sos' | 'stale' }>;
}) {
  return (
    <XStack gap="$2" width="100%">
      {actions.map((action) => (
        <ActionButton key={action.label} grow={1} label={action.label} minW={0} priority="normal" px="$2" tone={action.tone} />
      ))}
    </XStack>
  );
}

export function OutboxSummaryPanel({
  pending,
  conflict,
}: {
  pending: string;
  conflict: string;
}) {
  return (
    <OperationalCard>
      <YStack gap="$3">
        <XStack items="center" justify="space-between">
          <Text color="$text" fontSize="$lg" fontWeight="900">
            Outbox
          </Text>
          <StatusBadge tone="pending" label="Local queue" />
        </XStack>
        <XStack items="center" gap="$3">
          <StatusBadge tone="pending" label={pending} marker="…" />
          <YStack grow={1}>
            <Text color="$text" fontSize="$sm" fontWeight="900">
              Messages and updates
            </Text>
            <Text color="$textMuted" fontSize="$xs" fontWeight="700">
              Saved locally. Will sync when transport is available.
            </Text>
          </YStack>
        </XStack>
        <XStack items="center" gap="$3">
          <StatusBadge tone="conflict" label={conflict} marker="!" />
          <YStack grow={1}>
            <Text color="$text" fontSize="$sm" fontWeight="900">
              Requires review when online
            </Text>
            <Text color="$textMuted" fontSize="$xs" fontWeight="700">
              Conflict details stay signed on this device.
            </Text>
          </YStack>
        </XStack>
      </YStack>
    </OperationalCard>
  );
}

export function MockFaithfulBottomPanel({ children }: PropsWithChildren) {
  return (
    <BottomActionPanel>
      <YStack gap="$3">{children as ReactNode}</YStack>
    </BottomActionPanel>
  );
}
