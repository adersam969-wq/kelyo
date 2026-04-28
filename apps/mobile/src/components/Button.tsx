import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { theme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  fullWidth = true,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant].container,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && { opacity: 0.85 },
        isDisabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles[variant].label.color as string} />
      ) : (
        <Text style={[styles.label, sizeLabelStyles[size], variantStyles[variant].label]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.lg,
    flexDirection: 'row',
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.4 },
  label: { fontWeight: '600' },
});

const sizeStyles: Record<Size, ViewStyle> = {
  sm: { paddingVertical: 8, paddingHorizontal: 14, minHeight: 36 },
  md: { paddingVertical: 14, paddingHorizontal: 20, minHeight: 50 },
  lg: { paddingVertical: 18, paddingHorizontal: 24, minHeight: 58 },
};

const sizeLabelStyles: Record<Size, { fontSize: number }> = {
  sm: { fontSize: 14 },
  md: { fontSize: 16 },
  lg: { fontSize: 18 },
};

const variantStyles: Record<Variant, { container: ViewStyle; label: { color: string } }> = {
  primary: {
    container: { backgroundColor: theme.colors.primary[500] },
    label: { color: theme.colors.neutral[0] },
  },
  secondary: {
    container: { backgroundColor: theme.colors.secondary[500] },
    label: { color: theme.colors.neutral[0] },
  },
  outline: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: theme.colors.primary[500],
    },
    label: { color: theme.colors.primary[600] },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    label: { color: theme.colors.primary[600] },
  },
  danger: {
    container: { backgroundColor: theme.colors.danger },
    label: { color: theme.colors.neutral[0] },
  },
};
