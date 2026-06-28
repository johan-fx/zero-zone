import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Paragraph, Text, XStack, YStack } from 'tamagui';

import { OperationalScreensGallery } from '@/features/operations/screens';
import { ThemePreference, useOperationalTheme } from '@/shared/theme';
import { ActionButton, OperationalCard, StatusBadge } from '@/shared/ui';

const themeOptions: ThemePreference[] = ['system', 'day', 'night'];

export default function HomeScreen() {
  const router = useRouter();
  const { preference, setPreference, themeName } = useOperationalTheme();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <YStack bg="$background" grow={1}>
        <OperationalCard rounded={0} variant="default" px="$4" py="$3">
          <YStack gap="$3">
            <XStack items="center" justify="space-between">
              <YStack grow={1} gap="$1">
                <Text color="$text" fontSize={28} fontWeight="900">
                  Zona Cero
                </Text>
                <Paragraph color="$textMuted" fontSize={14} lineHeight={19}>
                  Tamagui operational design system preview
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
              label="Open design system"
              onPress={() => router.push('/design-system')}
              tone="success"
            />
          </YStack>
        </OperationalCard>

        <OperationalScreensGallery />
      </YStack>
    </SafeAreaView>
  );
}
