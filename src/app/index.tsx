import { ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/shared/theme/tokens';

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
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>MOBILE APP BOILERPLATE</Text>
          <Text style={[styles.title, { color: theme.text }]}>Zona Cero</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>A React Native foundation for local-first disaster coordination.</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Product direction</Text>
          {productPillars.map((item) => (
            <View key={item} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.cardText, { color: theme.text }]}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Prepared feature areas</Text>
          <View style={styles.moduleGrid}>
            {plannedModules.map((module) => (
              <View key={module} style={[styles.moduleBadge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.moduleText, { color: theme.text }]}>{module}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.lg,
  },
  hero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 24,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  cardText: {
    fontSize: 16,
    fontWeight: '600',
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  moduleBadge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  moduleText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
