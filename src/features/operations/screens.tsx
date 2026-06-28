import { ScrollView, Text, XStack, YStack } from 'tamagui';

import {
  ActionButton,
  AvailabilityPanel,
  CenterSummaryCard,
  EmergencyActionRow,
  FreshnessBadge,
  MapShell,
  MetricTile,
  MockFaithfulBottomPanel,
  OperationalCard,
  OperationalFilterTile,
  OperationalHeader,
  OutboxSummaryPanel,
  RecommendationCard,
  ResourceNeedList,
  RiskLabel,
  SectionSurface,
  StatusBadge,
  SyncStatePanel,
} from '@/shared/ui';
import { centerSummary, outboxRows, recommendationRows } from './mockData';

const operationalMarkers = [
  { id: 'pending', label: 'Pending', tone: 'pending', x: '43%', y: '18%' },
  { id: 'active', label: 'Active', tone: 'success', x: '60%', y: '34%' },
  { id: 'observing', label: 'Observing', tone: 'info', x: '16%', y: '39%' },
  { id: 'sos', label: 'SOS', tone: 'sos', x: '42%', y: '48%' },
  { id: 'shortage', label: 'Shortage', tone: 'risk', x: '16%', y: '70%' },
  { id: 'danger', label: 'Danger', tone: 'warning', x: '64%', y: '70%' },
] as const;

const operationalFilters = [
  { label: 'Critical', marker: '!', tone: 'risk' },
  { label: 'My role', marker: 'ME', tone: 'info' },
  { label: 'SOS', marker: 'SOS', tone: 'sos' },
  { label: 'Stale', marker: 'STALE', tone: 'stale' },
  { label: 'Resources', marker: 'BOX', tone: 'success' },
] as const;

export function OperationalMapScreen() {
  return (
    <YStack gap="$3">
      <OperationalHeader
        title="Zona Cero"
        subtitle="Flood response · Cell A7"
        status={{ tone: 'sos', label: 'Offline · 12 pending', marker: 'OFF' }}
      />
      <XStack gap="$2">
        <FreshnessBadge />
        <StatusBadge tone="success" label="Tracking active" marker="ON" />
      </XStack>
      <MapShell markers={operationalMarkers} variant="operational">
        <OperationalCard l={10} position="absolute" t={10} variant="elevated" px="$3" py="$2">
          <Text color="$text" fontSize="$lg" fontWeight="900">
            A7
          </Text>
          <Text color="$textMuted" fontSize="$xs" fontWeight="700">
            Cell
          </Text>
        </OperationalCard>
      </MapShell>
      <XStack flexWrap="wrap" gap="$2">
        {operationalFilters.map((filter) => (
          <OperationalFilterTile key={filter.label} label={filter.label} marker={filter.marker} tone={filter.tone} />
        ))}
      </XStack>
      <AvailabilityPanel status={{ tone: 'success', label: 'Tracking active', marker: 'ON' }} primaryAction="Create center" secondaryAction="Change status" />
    </YStack>
  );
}

export function SelectedCenterPanel() {
  return (
    <YStack gap="$3">
      <CenterSummaryCard
        name={centerSummary.name}
        type={centerSummary.type}
        status={{ tone: 'success', label: 'Active' }}
        confidence="Confidence: high"
        freshness="Data: recent"
        risk="Risk: precaution"
        missing={centerSummary.missing}
        surplus={centerSummary.surplus}
        roles={centerSummary.roles.map((role, index) => ({ ...role, tone: index === 1 ? 'sos' : index === 2 ? 'info' : index === 3 ? 'warning' : 'success' }))}>
        <OperationalCard variant="default" p="$3">
          <Text color="$primary" fontSize="$sm" fontWeight="900">
            Recommended: medical gap, recent data
          </Text>
        </OperationalCard>
      </CenterSummaryCard>
      <XStack flexWrap="wrap" gap="$2">
        <ActionButton grow={1} label="Check in" />
        <ActionButton grow={1} label="Bring resource" tone="success" />
        <ActionButton grow={1} label="Report need" tone="warning" />
        <ActionButton grow={1} label="Report surplus" tone="success" />
      </XStack>
    </YStack>
  );
}

export function SosOutboxScreen() {
  return (
    <YStack gap="$3">
      <OperationalCard variant="critical" p="$5">
        <XStack items="center" justify="space-between">
          <YStack>
            <Text color="$textInverse" fontSize="$hero" fontWeight="900">
              SOS raised
            </Text>
            <Text color="$textInverse" fontSize="$md" fontWeight="700">
              Critical alert
            </Text>
          </YStack>
          <StatusBadge tone="sos" label="Active" />
        </XStack>
      </OperationalCard>
      <OperationalCard>
        <XStack gap="$3">
          <YStack grow={1} gap="$3">
            <Text color="$text" fontSize="$lg" fontWeight="900">
              Last known location
            </Text>
            {['10:42 · radius 28 m', 'Center: Escuela Norte', 'Battery: 42%', 'No exact depth'].map((item) => (
              <Text key={item} color="$textMuted" fontSize="$xs" fontWeight="700">
                {item}
              </Text>
            ))}
            <StatusBadge tone="sos" label="Transport: Offline" marker="OFF" />
          </YStack>
          <MapShell markers={[{ id: 'sos', label: 'SOS', tone: 'sos', x: '38%', y: '38%' }]} minH={230} variant="sos" width="45%" />
        </XStack>
      </OperationalCard>
      <OperationalCard>
        <Text color="$text" fontSize="$lg" fontWeight="900">
          Propagation
        </Text>
        {outboxRows.map((row) => (
          <XStack key={row.title} items="center" borderBottomColor="$borderColor" borderBottomWidth={1} gap="$3" py="$3">
            <StatusBadge tone={row.tone} label={row.status} />
            <YStack grow={1} gap="$1">
              <Text color="$text" fontSize="$sm" fontWeight="900">
                {row.title}
              </Text>
              <Text color="$textMuted" fontSize="$xs" fontWeight="700">
                {row.detail}
              </Text>
            </YStack>
          </XStack>
        ))}
      </OperationalCard>
      <EmergencyActionRow
        actions={[
          { label: 'Cancel false alarm', tone: 'sos' },
          { label: 'Mark in response', tone: 'warning' },
          { label: 'View on map', tone: 'primary' },
        ]}
      />
      <OutboxSummaryPanel pending="7 pending" conflict="1 conflict" />
    </YStack>
  );
}

export function CreateWorkCenterScreen() {
  return (
    <YStack gap="$3">
      <OperationalHeader title="Create work center" subtitle="Map check-in · radius 35 m" backLabel="Back" status={{ tone: 'pending', label: 'Starts pending' }} />
      <MapShell markers={[{ id: 'center', label: 'Center', tone: 'pending', x: '44%', y: '38%' }]} minH={220} variant="operational" />
      <SectionSurface>
        <Text color="$text" fontSize="$md" fontWeight="800">
          Approximate location · radius 35 m
        </Text>
        <XStack flexWrap="wrap" gap="$2">
          {['Rescue', 'Medical post', 'Distribution', 'Warehouse', 'Coordination'].map((item) => (
            <StatusBadge key={item} tone="info" label={item} />
          ))}
        </XStack>
        <RiskLabel />
      </SectionSurface>
      <ActionButton label="Create pending center" />
    </YStack>
  );
}

export function ActiveVolunteerModeScreen() {
  return (
    <YStack gap="$3">
      <OperationalHeader title="Volunteer mode" subtitle="Rio Norte Flood · Cell A7" backLabel="Back" status={{ tone: 'success', label: 'Tracking active', marker: 'ON' }} />
      <OperationalCard borderColor="$success" bg="$successSurface">
        <XStack items="center" justify="space-between">
          <YStack gap="$2">
            <Text color="$success" fontSize="$xxl" fontWeight="900">
              Available
            </Text>
            <StatusBadge tone="success" label="Tracking active" marker="ON" />
          </YStack>
          <StatusBadge tone="info" label="Cell A7" />
        </XStack>
      </OperationalCard>
      <SectionSurface>
        <Text color="$text" fontWeight="800">
          Checked in: Escuela Norte
        </Text>
        <Text color="$textMuted">Heartbeat: every 2 min · Battery: 64%</Text>
      </SectionSurface>
      <XStack gap="$2">
        <ActionButton grow={1} label="Pause tracking" tone="warning" />
        <ActionButton grow={1} label="Check out" />
      </XStack>
      <ActionButton label="Go off-duty" tone="stale" />
    </YStack>
  );
}

export function ResourceReportScreen() {
  return (
    <YStack gap="$3">
      <OperationalHeader title="Report resource" subtitle="Escuela Norte" backLabel="Back" status={{ tone: 'success', label: 'Data: recent' }} />
      <XStack gap="$2">
        <ActionButton grow={1} label="Need" />
        <ActionButton grow={1} label="Surplus" tone="info" />
      </XStack>
      <ResourceNeedList
        missing={['Roles', 'Water', 'Food']}
        surplus={['Vehicles', 'Medical support']}
        resource={{ label: 'Approx. 20-40 L', detail: 'Water · quantity estimate', tone: 'info' }}
        urgency={{ tone: 'sos', label: 'Urgency: Critical' }}
      />
      <ActionButton label="Save signed report" />
    </YStack>
  );
}

export function RecommendationsScreen() {
  return (
    <YStack gap="$3">
      <OperationalHeader title="Where can I help?" subtitle="Rio Norte Flood · Cell A7" backLabel="Back" status={{ tone: 'success', label: 'Data: recent' }} />
      {recommendationRows.map((row) => (
        <RecommendationCard
          key={row.title}
          tone={row.tone}
          title={row.title}
          reason={row.detail}
          distance={row.title === 'Escuela Norte' ? '900 m' : row.title === 'Depot West' ? '1.4 km' : 'Capacity issue'}
          freshness={row.title === 'Depot West' ? 'Data degraded' : 'Recent data'}
          risk={row.title === 'Plaza Sur' ? 'Risk caution' : 'Risk precaution'}
          primaryAction={row.title === 'Escuela Norte' ? 'View center' : row.title === 'Depot West' ? 'Confirm before going' : 'See why'}
        />
      ))}
      <StatusBadge tone="info" label="Suggestions are not orders. Decide based on field safety." />
    </YStack>
  );
}

export function LogisticsTaskScreen() {
  return (
    <YStack gap="$3">
      <OperationalHeader title="Logistics task" subtitle="Rio Norte Flood · Cell A7" backLabel="Back" status={{ tone: 'sos', label: 'Offline · local pending' }} />
      <OperationalCard>
        <XStack justify="space-between" gap="$3">
          <YStack grow={1}>
            <StatusBadge tone="warning" label="From" />
            <Text color="$text" fontWeight="900">
              Depot West
            </Text>
            <Text color="$textMuted">Surplus · Water</Text>
          </YStack>
          <Text color="$primary" fontSize="$xl" fontWeight="900">
            →
          </Text>
          <YStack grow={1}>
            <StatusBadge tone="sos" label="To" />
            <Text color="$text" fontWeight="900">
              Escuela Norte
            </Text>
            <Text color="$textMuted">Critical need · Water</Text>
          </YStack>
        </XStack>
        <MapShell
          markers={[
            { id: 'from', label: 'Depot', tone: 'warning', x: '16%', y: '40%' },
            { id: 'to', label: 'Need', tone: 'sos', x: '70%', y: '46%' },
          ]}
          minH={190}
          mt="$3"
          variant="task"
        />
      </OperationalCard>
      <ResourceNeedList
        missing={['Water', 'Approx. 20-40 L']}
        surplus={['Depot West has surplus']}
        urgency={{ tone: 'sos', label: 'Urgency: critical' }}
      />
      <ActionButton label="Accept task" />
      <ActionButton label="Mark en route" tone="success" />
    </YStack>
  );
}

export function SyncConflictScreen() {
  return (
    <YStack gap="$3">
      <OperationalHeader title="Sync conflict" subtitle="Rio Norte Flood · Cell A7" backLabel="Back" status={{ tone: 'warning', label: 'Partial network' }} />
      <SyncStatePanel
        local={{ title: 'Local operation', detail: 'Mark resolved · changed locally', tone: 'success' }}
        network={{ title: 'Network state', detail: 'Still active · newer evidence', tone: 'info' }}
        status={{ tone: 'conflict', label: 'Conflict needs review' }}
        actions={[
          { label: 'Keep local note', tone: 'info' },
          { label: 'Open center', tone: 'primary' },
          { label: 'Retry sync', tone: 'success' },
          { label: 'Coordinator review', tone: 'warning' },
        ]}
      />
    </YStack>
  );
}

export function ReportCenterIssueScreen() {
  return (
    <YStack gap="$3">
      <OperationalHeader title="Report center" subtitle="Help keep information accurate and safe." backLabel="Back" />
      <CenterSummaryCard
        compact
        name={centerSummary.name}
        type="Work center"
        status={{ tone: 'success', label: 'Active' }}
        confidence="Confidence: high"
        freshness="Data: recent"
        risk="Risk: precaution"
        missing={centerSummary.missing}
        surplus={centerSummary.surplus}
        roles={centerSummary.roles.slice(0, 3)}
      />
      <XStack flexWrap="wrap" gap="$2">
        {(['Duplicate', 'False center', 'Dangerous', 'Resolved'] as const).map((item) => (
          <StatusBadge key={item} tone={item === 'Dangerous' ? 'risk' : item === 'Resolved' ? 'success' : 'info'} label={item} />
        ))}
      </XStack>
      <SectionSurface>
        <RiskLabel label="This flags the center for review, not immediate closure" />
        <Text color="$text" fontWeight="800">
          Possible match: Escuela Norte Annex · 120 m
        </Text>
        <Text color="$textMuted">Signed report · local pending</Text>
      </SectionSurface>
      <ActionButton label="Submit signed report" />
    </YStack>
  );
}

export function OperationalScreensGallery() {
  const sections = [
    ['Operational map', <OperationalMapScreen key="operational-map" />],
    ['Selected center', <SelectedCenterPanel key="selected-center" />],
    ['SOS and outbox', <SosOutboxScreen key="sos-outbox" />],
    ['Create center', <CreateWorkCenterScreen key="create-center" />],
    ['Volunteer mode', <ActiveVolunteerModeScreen key="volunteer-mode" />],
    ['Resource report', <ResourceReportScreen key="resource-report" />],
    ['Recommendations', <RecommendationsScreen key="recommendations" />],
    ['Logistics task', <LogisticsTaskScreen key="logistics-task" />],
    ['Sync conflict', <SyncConflictScreen key="sync-conflict" />],
    ['Report center', <ReportCenterIssueScreen key="report-center" />],
  ] as const;

  return (
    <ScrollView bg="$background">
      <YStack gap="$6" p="$4">
        {sections.map(([title, content]) => (
          <OperationalCard key={title} testID={`screen-${title.toLowerCase().replaceAll(' ', '-')}`}>
            <YStack gap="$4">
              <Text color="$text" fontSize="$xl" fontWeight="900">
                {title}
              </Text>
              {content}
            </YStack>
          </OperationalCard>
        ))}
      </YStack>
    </ScrollView>
  );
}
