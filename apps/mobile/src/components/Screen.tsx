import {
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/theme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  background?: string;
  contentStyle?: ViewStyle;
  keyboardAvoiding?: boolean;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  background = theme.colors.neutral[50],
  contentStyle,
  keyboardAvoiding = true,
}: ScreenProps) {
  const Container = scroll ? ScrollView : View;

  const inner = (
    <Container
      style={[{ flex: 1 }]}
      contentContainerStyle={[
        scroll ? { flexGrow: 1 } : null,
        padded && styles.padded,
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </Container>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  padded: { padding: theme.spacing.lg },
});
