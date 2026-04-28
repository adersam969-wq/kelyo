import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { withdrawalsApi } from '@/api/withdrawals.api';
import { theme } from '@/theme';

export function SetPinScreen() {
  const nav = useNavigation();
  const qc = useQueryClient();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const setPinMutation = useMutation({
    mutationFn: () => withdrawalsApi.setPin(pin),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hasPin'] });
      Alert.alert('PIN créé', 'Votre code PIN a été enregistré avec succès.', [
        { text: 'OK', onPress: () => nav.goBack() },
      ]);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? 'Erreur lors de la création du PIN';
      Alert.alert('Erreur', String(msg));
    },
  });

  const valid = /^\d{4}$/.test(pin) && pin === confirmPin;
  const mismatch = confirmPin.length === 4 && pin !== confirmPin;

  return (
    <Screen>
      <Text style={styles.title}>Créez votre code PIN</Text>
      <Text style={styles.subtitle}>
        Ce code à 4 chiffres protège vos retraits et vos paiements importants.
      </Text>

      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>⚠️ Important</Text>
        <Text style={styles.warningText}>
          • Ne partagez jamais votre PIN, même avec un agent Kelyo{'\n'}
          • Évitez 1234, 0000 ou des dates de naissance{'\n'}
          • 5 tentatives échouées = blocage 15 minutes
        </Text>
      </View>

      <Input
        label="Nouveau PIN (4 chiffres)"
        placeholder="••••"
        keyboardType="number-pad"
        maxLength={4}
        value={pin}
        onChangeText={setPin}
        secureTextEntry
        textAlign="center"
        style={styles.pinInput}
      />

      <Input
        label="Confirmez le PIN"
        placeholder="••••"
        keyboardType="number-pad"
        maxLength={4}
        value={confirmPin}
        onChangeText={setConfirmPin}
        secureTextEntry
        textAlign="center"
        style={styles.pinInput}
        error={mismatch ? 'Les codes ne correspondent pas' : undefined}
      />

      <View style={{ flex: 1 }} />

      <Button
        label="Créer mon PIN"
        onPress={() => setPinMutation.mutate()}
        disabled={!valid}
        loading={setPinMutation.isPending}
        size="lg"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700', color: theme.colors.neutral[900], marginTop: 16 },
  subtitle: {
    fontSize: 15,
    color: theme.colors.neutral[600],
    marginTop: 6,
    marginBottom: theme.spacing.lg,
    lineHeight: 22,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.lg,
  },
  warningTitle: { fontWeight: '700', color: '#92400E', marginBottom: 6 },
  warningText: { color: '#92400E', fontSize: 13, lineHeight: 20 },
  pinInput: { fontSize: 32, letterSpacing: 16, fontWeight: '700' },
});
