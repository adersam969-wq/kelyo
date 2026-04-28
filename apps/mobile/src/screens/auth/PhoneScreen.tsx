import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { authApi } from '@/api/auth.api';
import { theme } from '@/theme';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Phone'>;
type Rt = RouteProp<AuthStackParamList, 'Phone'>;

export function PhoneScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const mode = route.params.mode;

  const [local, setLocal] = useState('');

  const requestOtp = useMutation({
    mutationFn: () => {
      const phone = local.startsWith('+') ? local : `+241${local.replace(/^0/, '')}`;
      return authApi.requestOtp(phone, mode, 'GA').then(() => phone);
    },
    onSuccess: (phone) => {
      nav.navigate('OtpVerify', { phone, mode });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error?.message ?? 'Erreur lors de l\'envoi du code';
      Alert.alert('Erreur', String(message));
    },
  });

  const valid = /^\d{8,12}$/.test(local.replace(/\s/g, ''));

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>
          {mode === 'SIGNUP' ? 'Créer votre compte' : 'Se connecter'}
        </Text>
        <Text style={styles.subtitle}>
          Nous vous enverrons un code par SMS pour vérifier ce numéro.
        </Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Numéro de téléphone"
          placeholder="07 12 34 56"
          keyboardType="phone-pad"
          value={local}
          onChangeText={setLocal}
          autoFocus
          hint="Format Gabon : 07XXXXXX (préfixe +241 ajouté automatiquement)"
        />

        <Button
          label="Recevoir le code"
          onPress={() => requestOtp.mutate()}
          disabled={!valid}
          loading={requestOtp.isPending}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.neutral[900],
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    fontSize: 15,
    color: theme.colors.neutral[600],
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
});
