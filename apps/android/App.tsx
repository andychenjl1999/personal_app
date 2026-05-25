import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const sections = [
  {
    title: 'Platform foundation',
    body: 'This Android client is the mobile half of the personal app platform. It stays independent from the web frontend and connects through the shared backend.',
  },
  {
    title: 'Production direction',
    body: 'The initial release target is private Android distribution with real auth, real data, and production environment configuration.',
  },
  {
    title: 'Next step',
    body: 'Define the first real feature, then connect this app to Supabase and replace this foundation screen with a real domain flow.',
  },
];

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Personal App v2</Text>
        <Text style={styles.title}>
          Android foundation for a growing personal platform.
        </Text>
        <Text style={styles.subtitle}>
          Expo provides the private-distribution mobile client. Backend logic
          and shared behavior belong in Supabase, not duplicated app code.
        </Text>
        <View style={styles.cardList}>
          {sections.map((section) => (
            <View key={section.title} style={styles.card}>
              <Text style={styles.cardTitle}>{section.title}</Text>
              <Text style={styles.cardBody}>{section.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f1e8',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
    gap: 18,
  },
  eyebrow: {
    color: '#5d7068',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1f2f2a',
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
  },
  subtitle: {
    color: '#5d7068',
    fontSize: 16,
    lineHeight: 24,
  },
  cardList: {
    gap: 14,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderColor: 'rgba(31,47,42,0.12)',
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  cardTitle: {
    color: '#1f2f2a',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardBody: {
    color: '#5d7068',
    fontSize: 15,
    lineHeight: 22,
  },
});
