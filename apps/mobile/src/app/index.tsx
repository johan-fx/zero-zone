import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Paragraph, Text, XStack, YStack } from 'tamagui';

import { LiveOperationalEntryScreen, resolveLiveOperationsDevScenario } from '@/features/operations/liveOperations';
import { createPersistentLocalOperationDatabase, type LocalOperationDatabase } from '@/infrastructure/local-db/local-db';
import { createMobileRuntimeSync } from '@/infrastructure/sync';
import { ThemePreference, useOperationalTheme } from '@/shared/theme';
import { ActionButton, OperationalCard, StatusBadge } from '@/shared/ui';

const themeOptions: ThemePreference[] = ['system', 'day', 'night'];

export default function HomeScreen() {
  const params = useLocalSearchParams<{ scenario?: string }>();
  const router = useRouter();
  const [database, setDatabase] = useState<LocalOperationDatabase | null>(null);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const devScenario = resolveLiveOperationsDevScenario(params.scenario);
  const { preference, setPreference, themeName } = useOperationalTheme();
  const runtimeSync = useMemo(() => (database ? createMobileRuntimeSync({ database }) : null), [database]);

  useEffect(() => {
    let isMounted = true;

    async function openDatabase() {
      try {
        const openedDatabase = await createPersistentLocalOperationDatabase();
        if (isMounted) {
          setDatabase(openedDatabase);
        }
      } catch (error) {
        if (isMounted) {
          setDatabaseError(error instanceof Error ? error.message : 'Unable to open local database');
        }
      }
    }

    void openDatabase();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} contentInsetAdjustmentBehavior="automatic" testID="home-scroll">
      <YStack bg="$background">
        <OperationalCard rounded={0} variant="default" px="$4" py="$3">
          <YStack gap="$3">
            <XStack items="center" justify="space-between">
              <YStack grow={1} gap="$1">
                <Text color="$text" fontSize={28} fontWeight="900">
                  Zona Cero
                </Text>
                <Paragraph color="$textMuted" fontSize={14} lineHeight={19}>
                  Live operational entry with local signed operations
                </Paragraph>
              </YStack>
              <StatusBadge tone={themeName === 'dark' ? 'info' : 'success'} label={`${themeName} theme`} />
            </XStack>

            <XStack flexWrap="wrap" gap="$2">
              {themeOptions.map((option) => (
                <ActionButton
                  key={option}
                  accessibilityLabel={`Set ${option} theme`}
                  label={option}
                  onPress={() => setPreference(option)}
                  size="$3"
                  testID={`theme-${option}`}
                  tone={preference === option ? 'primary' : 'info'}
                />
              ))}
            </XStack>

            <ActionButton testID="tamagui-smoke-button" accessibilityLabel="Tamagui smoke check" label="Tamagui smoke check" />
            <ActionButton
              testID="open-design-system"
              accessibilityLabel="Open design system"
              label="Open design system previews"
              onPress={() => router.push('/design-system')}
              tone="success"
            />
            <ActionButton
              testID="open-visual-audit"
              accessibilityLabel="Open visual audit"
              label="Open visual audit"
              onPress={() => router.push('/visual-audit')}
              tone="info"
            />
          </YStack>
        </OperationalCard>

        {database ? (
          <LiveOperationalEntryScreen database={database} devScenario={devScenario} networkAvailable={runtimeSync?.networkAvailable ?? false} operationalUpdatesService={runtimeSync?.operationalUpdatesService} syncService={runtimeSync?.syncService} syncUnavailableReason={runtimeSync?.syncUnavailableReason} />
        ) : (
          <OperationalCard testID="local-database-status">
            <YStack gap="$2">
              <Text color={databaseError ? '$risk' : '$text'} fontSize="$lg" fontWeight="900">
                {databaseError ? 'Local storage unavailable' : 'Opening device local storage'}
              </Text>
              <Paragraph color="$textMuted" fontSize="$sm" lineHeight={20}>
                {databaseError ?? 'Preparing the durable RxDB + Expo SQLite offline store.'}
              </Paragraph>
            </YStack>
          </OperationalCard>
        )}
      </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
