import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Paragraph, ScrollView, Text, XStack, YStack } from 'tamagui';

const productPillars = [
  'Local-first mobile coordination',
  'Incident and geo-cell operating model',
  'Offline map shell prepared',
  'Signed operations deferred to the technical spike',
];

const plannedModules = [
  'Incidents',
  'Work centers',
  'Presence',
  'Resources',
  'SOS',
  'Sync',
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView background="$background">
        <YStack gap="$6" p="$4">
          <Card borderWidth={1} borderColor="$borderColor" p="$6" borderRadius="$10" backgroundColor="$background">
            <YStack gap="$3">
              <Text color="#D9480F" fontSize={12} fontWeight="800" letterSpacing={1}>
                MOBILE APP BOILERPLATE
              </Text>
              <Text color="$color" fontSize={38} fontWeight="800">
                Zona Cero
              </Text>
              <Paragraph color="$color11" fontSize={17} lineHeight={24}>
                A React Native foundation for local-first disaster coordination.
              </Paragraph>
              <Button testID="tamagui-smoke-button" accessibilityLabel="Tamagui smoke check" size="$4">
                Tamagui smoke check
              </Button>
            </YStack>
          </Card>

          <YStack gap="$3">
            <Text color="$color" fontSize={20} fontWeight="700">
              Product direction
            </Text>
            {productPillars.map((item) => (
              <Card key={item} borderWidth={1} borderColor="$borderColor" p="$4" borderRadius="$8" backgroundColor="$background">
                <Text color="$color" fontSize={16} fontWeight="600">
                  {item}
                </Text>
              </Card>
            ))}
          </YStack>

          <YStack gap="$3">
            <Text color="$color" fontSize={20} fontWeight="700">
              Prepared feature areas
            </Text>
            <XStack flexWrap="wrap" gap="$2">
              {plannedModules.map((module) => (
                <Card key={module} borderWidth={1} borderColor="$borderColor" px="$3" py="$2" borderRadius="$10">
                  <Text color="$color" fontSize={14} fontWeight="700">
                    {module}
                  </Text>
                </Card>
              ))}
            </XStack>
          </YStack>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
