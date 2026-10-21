import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScreenProps = PropsWithChildren<{ title: string }>;

export function Screen({ title, children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>CashMine</Text>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <View style={styles.links}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: 24,
    gap: 24,
  },
  brand: { fontSize: 16, fontWeight: '600', color: '#555' },
  title: { fontSize: 32, fontWeight: '700', color: '#111' },
  links: { gap: 20 },
});
