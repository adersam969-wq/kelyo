import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import { theme } from '@/theme';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';

type Rt = RouteProp<AuthStackParamList, 'OtpVerify'>;

export function OtpVerifyScreen() {
  const route = useRoute<Rt>();
  const nav = useNavigation();
  const setSession = useAuthStore((s) => s.setSession);
  const { phone, mode } = route.params;

  const [code, setCode] = useState('');

  const verify = useMutation({
    mutationFn: () => authApi.verifyOtp(phone, code, mode),
    onSuccess: async (result) => {
      // Persist tokens, then fetch /users/me to populate user
      const me = await authApi.me().catch(() => null);
      const user = me ?? {
        id: 'unknown',
        phone,
        role: 'USER' as const,
        kycTier: 'TIER_0' as const,
        kycStatus: 'NOT_SUBMITTED' as const,
      };
      await setSession(user, result.accessToken, result.refreshToken);
      // Navigation switches automatically via RootNavigator
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error?.message ?? 'Code invalide';
      Alert.alert('Erreur', String(message));
    },
  });

  const resend = useMutation({
    mutationFn: () => authApi.requestOtp(phone, mode, 'GA'),
    onSuccess: () => Alert.alert('Code envoyé', 'Un nouveau code vous a été envoyé.'),
    onError: () => Alert.alert('Erreur', 'Impossible de renvoyer le code maintenant.'),
  });

  const valid = /^\d{6}$/.test(code);

  return (
    <Screen>
      <Pressable onPress={() => nav.goBack()} style={styles.back}>
        <Text style={styles.backText}>← Retour</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>Vérifiez votre numéro</Text>
        <Text style={styles.subtitle}>
          Code à 6 chiffres envoyé au <Text style={styles.phoneEmphasis}>{phone}</Text>
        </Text>
      </View>

      <Input
        label="Code"
        placeholder="123 456"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        autoFocus
        textAlign="center"
        style={styles.codeInput}
      />

      <Button
        label="Vérifier"
        onPress={() => verify.mutate()}
        disabled={!valid}
        loading={verify.isPending}
      />

      <Pressable
        onPress={() => resend.mutate()}
        disabled={resend.isPending}
        style={styles.resend}
      >
        <Text style={styles.resendText}>
          {resend.isPending ? 'Envoi…' : 'Renvoyer le code'}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingVertical: 8 },
  backText: { fontSize: 16, color: theme.colors.primary[600], fontWeight: '600' },
  header: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.neutral[900] },
  subtitle: {
    marginTop: theme.spacing.xs,
    fontSize: 15,
    color: theme.colors.neutral[600],
    lineHeight: 22,
  },
  phoneEmphasis: { color: theme.colors.neutral[900], fontWeight: '600' },
  codeInput: {
    fontSize: 26,
    letterSpacing: 8,
    fontWeight: '600',
  },
  resend: {
    marginTop: theme.spacing.lg,
    alignSelf: 'center',
    padding: theme.spacing.sm,
  },
  resendText: { color: theme.colors.primary[600], fontWeight: '600', fontSize: 15 },
});
