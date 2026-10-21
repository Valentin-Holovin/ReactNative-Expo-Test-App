import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScreenProps = PropsWithChildren<{ title: string }>;

export function Screen({ title, children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.brand}>CashMine</Text>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff', minWidth: 0 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  brand: { fontSize: 16, fontWeight: '600', color: '#555' },
  title: { fontSize: 28, fontWeight: '700', color: '#111', flexShrink: 1 },
});
