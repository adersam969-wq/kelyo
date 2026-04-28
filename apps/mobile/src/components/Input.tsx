import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { theme } from '@/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, hint, containerStyle, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        placeholderTextColor={theme.colors.neutral[400]}
        style={[
          styles.input,
          focused && styles.inputFocused,
          !!error && styles.inputError,
          rest.style,
        ]}
      />
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: theme.spacing.md },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.neutral[700],
    marginBottom: 6,
  },
  input: {
    height: 52,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.neutral[0],
    borderWidth: 1.5,
    borderColor: theme.colors.neutral[200],
    borderRadius: theme.radius.md,
    fontSize: 16,
    color: theme.colors.neutral[900],
  },
  inputFocused: { borderColor: theme.colors.primary[500] },
  inputError: { borderColor: theme.colors.danger },
  errorText: {
    color: theme.colors.danger,
    fontSize: 13,
    marginTop: 4,
  },
  hintText: {
    color: theme.colors.neutral[500],
    fontSize: 13,
    marginTop: 4,
  },
});
