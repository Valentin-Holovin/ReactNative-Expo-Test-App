import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

export function Card({ title, children }: PropsWithChildren<{ title?: string }>) {
  return (
    <View style={ui.card}>
      {title ? <Text accessibilityRole="header" style={ui.heading}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Action({ title, onPress, disabled = false, secondary = false }: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const unavailable = disabled || !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [ui.button, secondary && ui.secondary, unavailable && ui.disabled, pressed && ui.pressed]}>
      <Text style={[ui.buttonText, secondary && ui.secondaryText]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={ui.field}>
      <Text style={ui.label}>{label}</Text>
      <TextInput placeholderTextColor="#666" {...props} accessibilityLabel={label} style={[ui.input, props.style]} />
    </View>
  );
}

export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={ui.detail}>
      <Text style={ui.muted}>{label}</Text>
      <Text selectable style={ui.value}>{value}</Text>
    </View>
  );
}

export const ui = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, gap: 12, minWidth: 0 },
  heading: { fontSize: 18, fontWeight: '600', color: '#111' },
  text: { fontSize: 16, lineHeight: 24, color: '#111', flexShrink: 1 },
  muted: { fontSize: 14, lineHeight: 21, color: '#555', flexShrink: 1 },
  total: { fontSize: 32, fontWeight: '700', color: '#111' },
  field: { gap: 8, minWidth: 0 },
  label: { fontSize: 16, fontWeight: '500', color: '#111' },
  input: { width: '100%', minWidth: 0, minHeight: 48, borderWidth: 1, borderColor: '#888', borderRadius: 6, padding: 12, fontSize: 16, color: '#111', backgroundColor: '#fff' },
  button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 6, backgroundColor: '#1f2937' },
  buttonText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: '#fff', textAlign: 'center', flexShrink: 1 },
  secondary: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#9ca3af' },
  secondaryText: { color: '#111' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  detail: { gap: 4, minWidth: 0 },
  value: { fontSize: 16, lineHeight: 24, color: '#111', flexShrink: 1 },
});
