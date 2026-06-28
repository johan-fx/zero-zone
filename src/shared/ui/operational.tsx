import { PropsWithChildren, ReactNode } from 'react';
import {
  Button,
  Card,
  Paragraph,
  Text,
  XStack,
  YStack,
  styled,
  type ButtonProps,
  type CardProps,
} from 'tamagui';

import { StatusTone, statusToneLabels, statusToneMarkers } from '@/shared/theme';

const toneStyles = {
  info: { surface: '$infoSurface', color: '$info', border: '$info' },
  success: { surface: '$successSurface', color: '$success', border: '$success' },
  warning: { surface: '$warningSurface', color: '$warning', border: '$warning' },
  risk: { surface: '$riskSurface', color: '$risk', border: '$risk' },
  sos: { surface: '$sosSurface', color: '$sos', border: '$sos' },
  stale: { surface: '$staleSurface', color: '$stale', border: '$stale' },
  pending: { surface: '$pendingSurface', color: '$pending', border: '$pending' },
  conflict: { surface: '$conflictSurface', color: '$conflict', border: '$conflict' },
} as const satisfies Record<StatusTone, { surface: string; color: string; border: string }>;

export type OperationalCardVariant = 'default' | 'elevated' | 'critical' | 'muted';
export type ActionButtonTone = 'primary' | 'info' | 'success' | 'warning' | 'risk' | 'sos' | 'stale';
export type ActionButtonState = 'default' | 'loading' | 'disabled';

const OperationalCardFrame = styled(Card, {
  name: 'OperationalCard',
  borderColor: '$borderColor',
  borderWidth: 1,
  overflow: 'hidden',
  p: '$4',
  rounded: '$card',
  shadowColor: '$text',

  variants: {
    variant: {
      default: {
        bg: '$surface',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      elevated: {
        bg: '$surfaceElevated',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
      },
      critical: {
        bg: '$sos',
        borderColor: '$sos',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 22,
      },
      muted: {
        bg: '$surfaceMuted',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
      },
    },
  } as const,

  defaultVariants: {
    variant: 'elevated',
  },
});

export type OperationalCardProps = PropsWithChildren<
  CardProps & {
    variant?: OperationalCardVariant;
    elevated?: boolean;
  }
>;

export function OperationalCard({ children, elevated, variant, ...props }: OperationalCardProps) {
  const resolvedVariant = variant ?? (elevated === false ? 'default' : 'elevated');

  return (
    <OperationalCardFrame variant={resolvedVariant} {...props}>
      {children}
    </OperationalCardFrame>
  );
}

export function SectionSurface({ children }: PropsWithChildren) {
  return (
    <YStack bg="$surfaceMuted" borderColor="$borderColor" rounded="$control" borderWidth={1} p="$section" gap="$3">
      {children}
    </YStack>
  );
}

export function ResourceListItem({ children }: PropsWithChildren) {
  return (
    <Text color="$text" fontSize="$sm" fontWeight="700">
      • {children}
    </Text>
  );
}

type StatusBadgeProps = {
  tone: StatusTone;
  label?: string;
  detail?: string;
  marker?: string;
};

export function StatusBadge({ tone, label = statusToneLabels[tone], detail, marker }: StatusBadgeProps) {
  const style = toneStyles[tone];
  const resolvedMarker = marker ?? statusToneMarkers[tone];

  return (
    <XStack
      items="center"
      self="flex-start"
      bg={style.surface}
      borderColor={style.border}
      rounded="$pill"
      borderWidth={1}
      gap="$2"
      minH={32}
      px="$3">
      <Text color={style.color} fontSize="$xs" fontWeight="900">
        {resolvedMarker}
      </Text>
      <Text color={style.color} fontSize="$xs" fontWeight="800">
        {label}
      </Text>
      {detail ? (
        <Text color="$textMuted" fontSize="$xs" fontWeight="600">
          {detail}
        </Text>
      ) : null}
    </XStack>
  );
}

export function RiskLabel({ label = 'Risk: precaution' }: { label?: string }) {
  return <StatusBadge tone="risk" label={label} marker="!" />;
}

export function FreshnessBadge({ label = 'Data: recent' }: { label?: string }) {
  return <StatusBadge tone="success" label={label} marker="SYNC" />;
}

type ActionButtonProps = Omit<ButtonProps, 'disabled'> & {
  tone?: ActionButtonTone;
  label: string;
  helper?: string;
  state?: ActionButtonState;
  disabled?: boolean;
};

const actionToneStyles = {
  primary: { background: '$primary', foreground: '$textInverse', border: '$primary' },
  info: { background: '$infoSurface', foreground: '$info', border: '$info' },
  success: { background: '$successSurface', foreground: '$success', border: '$success' },
  warning: { background: '$warningSurface', foreground: '$warning', border: '$warning' },
  risk: { background: '$riskSurface', foreground: '$risk', border: '$risk' },
  sos: { background: '$sosSurface', foreground: '$sos', border: '$sos' },
  stale: { background: '$staleSurface', foreground: '$stale', border: '$stale' },
} as const satisfies Record<ActionButtonTone, { background: string; foreground: string; border: string }>;

export function ActionButton({ tone = 'primary', label, helper, state = 'default', disabled, ...props }: ActionButtonProps) {
  const style = actionToneStyles[tone];
  const isUnavailable = disabled || state === 'disabled' || state === 'loading';

  return (
    <Button
      bg={style.background}
      borderColor={style.border}
      rounded="$control"
      borderWidth={1}
      color={style.foreground}
      disabled={isUnavailable}
      opacity={state === 'disabled' ? 0.48 : 1}
      minH="$touch"
      px="$4"
      pressStyle={{ opacity: 0.82 }}
      {...props}>
      <YStack items="center" gap="$1">
        <Text color={style.foreground} fontSize="$md" fontWeight="800">
          {state === 'loading' ? `… ${label}` : label}
        </Text>
        {helper ? (
          <Text color={tone === 'primary' ? '$textInverse' : '$textMuted'} fontSize="$xs" fontWeight="600">
            {helper}
          </Text>
        ) : null}
      </YStack>
    </Button>
  );
}

export function MetricTile({ label, value, tone = 'info' }: { label: string; value: string; tone?: StatusTone }) {
  const style = toneStyles[tone];

  return (
    <YStack items="center" bg="$surface" borderColor="$borderColor" rounded="$control" borderWidth={1} grow={1} gap="$1" p="$3">
      <Text color={style.color} fontSize="$xl" fontWeight="900">
        {value}
      </Text>
      <Text color="$textMuted" fontSize="$xs" fontWeight="700" text="center">
        {label}
      </Text>
    </YStack>
  );
}

export function MapMarkerPill({ tone, label }: { tone: StatusTone; label: string }) {
  const style = toneStyles[tone];

  return (
    <YStack items="center" gap="$1" z="$mapOverlay">
      <YStack items="center" justify="center" bg={style.surface} borderColor={style.border} rounded="$pill" borderWidth={2} height="$marker" width="$marker">
        <Text color={style.color} fontSize="$xs" fontWeight="900">
          {label.slice(0, 3).toUpperCase()}
        </Text>
      </YStack>
      <Text bg="$surfaceElevated" borderColor={style.border} rounded="$2" borderWidth={1} color="$text" fontSize="$xs" fontWeight="800" px="$2" py="$1">
        {label}
      </Text>
    </YStack>
  );
}

export function OutboxRow({ title, detail, tone = 'pending', status }: { title: string; detail: string; tone?: StatusTone; status: string }) {
  return (
    <XStack items="center" borderBottomColor="$borderColor" borderBottomWidth={1} gap="$3" py="$3">
      <StatusBadge tone={tone} label={status} />
      <YStack grow={1} gap="$1">
        <Text color="$text" fontSize="$md" fontWeight="800">
          {title}
        </Text>
        <Paragraph color="$textMuted" fontSize="$xs" lineHeight={16}>
          {detail}
        </Paragraph>
      </YStack>
    </XStack>
  );
}

export function BottomActionPanel({ children }: PropsWithChildren) {
  return (
    <OperationalCard borderBottomLeftRadius={0} borderBottomRightRadius={0} borderTopLeftRadius="$panel" borderTopRightRadius="$panel" p="$panel" z="$bottomSheet">
      {children}
    </OperationalCard>
  );
}

export function ScreenTitle({ eyebrow, title, children }: PropsWithChildren<{ eyebrow: string; title: string }>) {
  return (
    <YStack gap="$2">
      <Text color="$primary" fontSize="$xs" fontWeight="900" letterSpacing={1} textTransform="uppercase">
        {eyebrow}
      </Text>
      <Text color="$text" fontSize="$hero" fontWeight="900" lineHeight={40}>
        {title}
      </Text>
      {children ? (
        <Paragraph color="$textMuted" fontSize="$md" lineHeight={23}>
          {children as ReactNode}
        </Paragraph>
      ) : null}
    </YStack>
  );
}
