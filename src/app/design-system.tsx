import { PropsWithChildren } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Paragraph, ScrollView, Text, XStack, YStack } from 'tamagui';

import { operationalThemePalettes, ThemePreference, useOperationalTheme } from '@/shared/theme';
import {
  ActionButton,
  ActionButtonState,
  ActionButtonTone,
  AvailabilityPanel,
  BottomActionPanel,
  CenterSummaryCard,
  EmergencyActionRow,
  MapMarkerPill,
  MapShell,
  MetricTile,
  OperationalCard,
  OperationalFilterTile,
  OperationalCardVariant,
  OperationalHeader,
  OutboxRow,
  OutboxSummaryPanel,
  RecommendationCard,
  SectionSurface,
  StatusBadge,
  SyncStatePanel,
} from '@/shared/ui';

const themeOptions: ThemePreference[] = ['system', 'day', 'night'];
const cardVariants: OperationalCardVariant[] = ['default', 'elevated', 'muted', 'critical'];
const buttonTones: ActionButtonTone[] = ['primary', 'info', 'success', 'warning', 'risk', 'sos', 'stale'];
const buttonStates: ActionButtonState[] = ['default', 'loading', 'disabled'];
const statusTones = ['info', 'success', 'warning', 'risk', 'sos', 'stale', 'pending', 'conflict'] as const;
const paletteKeys = ['background', 'surface', 'surfaceMuted', 'surfaceElevated', 'primary', 'success', 'warning', 'risk', 'sos'] as const;

function PreviewSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <OperationalCard testID={`design-section-${title.toLowerCase().replaceAll(' ', '-')}`}>
      <YStack gap="$3">
        <Text color="$text" fontSize="$xl" fontWeight="900">
          {title}
        </Text>
        {children}
      </YStack>
    </OperationalCard>
  );
}

function ColorSwatch({ name, value }: { name: string; value: string }) {
  return (
    <XStack items="center" gap="$3" width="48%" minW={150}>
      <YStack borderColor="$borderColor" rounded="$control" borderWidth={1} height={42} width={42} style={{ backgroundColor: value }} />
      <YStack grow={1}>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          {name}
        </Text>
        <Text color="$textMuted" fontFamily="$mono" fontSize="$xs">
          {value}
        </Text>
      </YStack>
    </XStack>
  );
}

export default function DesignSystemScreen() {
  const { preference, setPreference, themeName } = useOperationalTheme();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView bg="$background">
        <YStack gap="$4" p="$4">
          <OperationalCard>
            <YStack gap="$3">
              <YStack gap="$2">
                <Text color="$primary" fontSize="$xs" fontWeight="900" letterSpacing={1} textTransform="uppercase">
                  Zona Cero UI
                </Text>
                <Text color="$text" fontSize="$hero" fontWeight="900" lineHeight={40}>
                  Design system preview
                </Text>
                <Paragraph color="$textMuted" fontSize="$md" lineHeight={22}>
                  Operational components, semantic tokens, and adaptive day/night themes.
                </Paragraph>
                <StatusBadge tone={themeName === 'dark' ? 'info' : 'success'} label={`${themeName} theme`} />
              </YStack>

              <XStack flexWrap="wrap" gap="$2">
                {themeOptions.map((option) => (
                  <ActionButton
                    key={option}
                    accessibilityLabel={`Set ${option} theme`}
                    label={option}
                    onPress={() => setPreference(option)}
                    size="$3"
                    testID={`design-theme-${option}`}
                    tone={preference === option ? 'primary' : 'info'}
                  />
                ))}
              </XStack>
            </YStack>
          </OperationalCard>

          <PreviewSection title="Compound patterns">
            <YStack gap="$3">
              <OperationalHeader
                title="Operational header"
                subtitle="Rio Norte Flood · Cell A7"
                status={{ tone: 'success', label: 'Tracking active', marker: 'ON' }}
              />
              <MapShell
                markers={[
                  { id: 'preview-sos', label: 'SOS', tone: 'sos', x: '42%', y: '44%' },
                  { id: 'preview-active', label: 'Active', tone: 'success', x: '64%', y: '34%' },
                  { id: 'preview-warning', label: 'Danger', tone: 'warning', x: '58%', y: '68%' },
                ]}
                minH={260}
                variant="operational"
              />
              <XStack flexWrap="wrap" gap="$2">
                <OperationalFilterTile marker="!" label="Critical" tone="risk" />
                <OperationalFilterTile marker="ME" label="My role" tone="info" />
                <OperationalFilterTile marker="SOS" label="SOS" tone="sos" />
              </XStack>
              <AvailabilityPanel
                status={{ tone: 'success', label: 'Tracking active', marker: 'ON' }}
                primaryAction="Create center"
                secondaryAction="Change status"
              />
              <CenterSummaryCard
                name="Center summary"
                type="Work center"
                status={{ tone: 'success', label: 'Active' }}
                confidence="Confidence: high"
                freshness="Data: recent"
                risk="Risk: precaution"
                missing={['3 medics', 'Water', 'Light tools']}
                surplus={['Food', 'Blankets']}
                roles={[
                  { label: 'total', value: '12', tone: 'success' },
                  { label: 'medics', value: '2', tone: 'sos' },
                  { label: 'logistics', value: '4', tone: 'info' },
                ]}
              />
              <RecommendationCard
                tone="success"
                title="Recommendation card"
                reason="Medical gap · Water"
                distance="900 m"
                freshness="Recent data"
                risk="Risk precaution"
                primaryAction="View center"
              />
              <SyncStatePanel
                local={{ title: 'Local operation', detail: 'Mark resolved', tone: 'success' }}
                network={{ title: 'Network state', detail: 'Still active', tone: 'info' }}
                status={{ tone: 'conflict', label: 'Sync state' }}
                actions={[
                  { label: 'Keep note', tone: 'info' },
                  { label: 'Coordinator review', tone: 'warning' },
                ]}
              />
            </YStack>
          </PreviewSection>

          <PreviewSection title="Color tokens">
            {(['light', 'dark'] as const).map((mode) => (
              <SectionSurface key={mode}>
                <Text color="$text" fontSize="$lg" fontWeight="900">
                  {mode} palette
                </Text>
                <XStack flexWrap="wrap" gap="$3">
                  {paletteKeys.map((key) => (
                    <ColorSwatch key={`${mode}-${key}`} name={key} value={operationalThemePalettes[mode][key]} />
                  ))}
                </XStack>
              </SectionSurface>
            ))}
          </PreviewSection>

          <PreviewSection title="Cards">
            <YStack gap="$3">
              {cardVariants.map((variant) => (
                <OperationalCard key={variant} variant={variant}>
                  <Text color={variant === 'critical' ? '$textInverse' : '$text'} fontSize="$md" fontWeight="900">
                    {variant} card
                  </Text>
                </OperationalCard>
              ))}
            </YStack>
          </PreviewSection>

          <PreviewSection title="Buttons">
            <YStack gap="$3">
              {buttonStates.map((state) => (
                <XStack key={state} flexWrap="wrap" gap="$2">
                  {buttonTones.map((tone) => (
                    <ActionButton key={`${tone}-${state}`} label={tone} state={state} tone={tone} />
                  ))}
                </XStack>
              ))}
            </YStack>
          </PreviewSection>

          <PreviewSection title="Badges and markers">
            <XStack flexWrap="wrap" gap="$2">
              {statusTones.map((tone) => (
                <StatusBadge key={tone} tone={tone} />
              ))}
            </XStack>
            <XStack flexWrap="wrap" gap="$4">
              <MapMarkerPill tone="sos" label="SOS" />
              <MapMarkerPill tone="warning" label="Warning" />
              <MapMarkerPill tone="success" label="Active" />
              <MapMarkerPill tone="info" label="Info" />
            </XStack>
          </PreviewSection>

          <PreviewSection title="Operational patterns">
            <XStack gap="$2">
              <MetricTile label="Pending reports" value="12" tone="pending" />
              <MetricTile label="Active centers" value="8" tone="success" />
              <MetricTile label="Critical gaps" value="3" tone="sos" />
            </XStack>
            <SectionSurface>
              <OutboxRow title="Signed resource report" detail="Local first · waiting for network" tone="pending" status="Pending" />
              <OutboxRow title="SOS propagation" detail="Mesh sent · server pending" tone="sos" status="SOS" />
            </SectionSurface>
            <BottomActionPanel>
              <EmergencyActionRow
                actions={[
                  { label: 'Cancel false alarm', tone: 'sos' },
                  { label: 'Mark in response', tone: 'warning' },
                  { label: 'View on map', tone: 'primary' },
                ]}
              />
            </BottomActionPanel>
            <OutboxSummaryPanel pending="7 pending" conflict="1 conflict" />
          </PreviewSection>

        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
