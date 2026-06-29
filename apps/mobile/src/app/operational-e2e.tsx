import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'tamagui';

import { LiveOperationalEntryScreen, resolveLiveOperationsDevScenario } from '@/features/operations/liveOperations';
import { createInMemoryLocalOperationDatabase } from '@/infrastructure/local-db/local-db';

export default function OperationalE2ERoute() {
  const params = useLocalSearchParams<{ scenario?: string }>();
  const database = useMemo(() => createInMemoryLocalOperationDatabase(), []);
  const devScenario = resolveLiveOperationsDevScenario(params.scenario);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView bg="$background" testID="operational-e2e-scroll">
        <LiveOperationalEntryScreen database={database} devScenario={devScenario} />
      </ScrollView>
    </SafeAreaView>
  );
}
