import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, YStack } from 'tamagui';

import { resolveVisualAuditScreenId, resolveVisualAuditThemeId, visualAuditScreenConfigs } from '@/features/operations/visualAudit';
import { useOperationalTheme } from '@/shared/theme';

export default function VisualAuditRoute() {
  const params = useLocalSearchParams<{ screen?: string; theme?: string }>();
  const screenId = resolveVisualAuditScreenId(params.screen);
  const theme = resolveVisualAuditThemeId(params.theme);
  const expectedThemeName = theme === 'night' ? 'dark' : 'light';
  const { colors, setPreference, themeName } = useOperationalTheme();
  const screenConfig = visualAuditScreenConfigs[screenId];

  useEffect(() => {
    setPreference(theme);
  }, [setPreference, theme]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.background, flex: 1 }}>
      <ScrollView bg="$background" testID={`visual-audit-${screenId}-${theme}`}>
        <YStack bg="$background" minH="100%" p="$4">
          <Text color="$primary" fontSize="$sm" fontWeight="900">
            Visual audit: mock-backed {screenId}
          </Text>
          {themeName === expectedThemeName ? screenConfig.render() : null}
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
