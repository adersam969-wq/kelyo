import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { walletApi } from '@/api/wallet.api';
import { parseAmount, formatXAF } from '@/utils/money';
import { theme } from '@/theme';

export function TransferScreen() {
  const nav = useNavigation();
  const qc = useQueryClient();

  const [phone, setPhone] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [description, setDescription] = useState('');

  const transfer = useMutation({
    mutationFn: () => {
      const amount = parseAmount(amountRaw)!;
      const e164 = phone.startsWith('+') ? phone : `+241${phone.replace(/^0/, '').replace(/\s/g, '')}`;
      return walletApi.transfer({
        toPhone: e164,
        amount,
        description: description.trim() || undefined,
      });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['recent-transactions'] });
      Alert.alert(
        'Envoi réussi',
        `${formatXAF(parseAmount(amountRaw)!)} envoyé.`,
        [{ text: 'OK', onPress: () => nav.goBack() }],
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Échec de l\'envoi';
      Alert.alert('Erreur', String(msg));
    },
  });

  const amount = parseAmount(amountRaw);
  const phoneOk = /^(\+\d{8,15}|\d{8,12})$/.test(phone.replace(/\s/g, ''));
  const valid = phoneOk && amount && amount >= 100;

  return (
    <Screen>
      <Text style={styles.label}>Destinataire</Text>
      <Input
        placeholder="07 12 34 56"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        autoFocus
        hint="Le destinataire doit avoir un compte Kelyo."
      />

      <Text style={styles.label}>Montant</Text>
      <Input
        placeholder="0"
        keyboardType="number-pad"
        value={amountRaw}
        onChangeText={setAmountRaw}
        style={styles.amountInput}
        hint="Minimum 100 XAF"
      />

      <Text style={styles.label}>Note (optionnel)</Text>
      <Input
        placeholder="Restaurant, taxi, cadeau…"
        value={description}
        onChangeText={setDescription}
        maxLength={200}
      />

      {amount && amount > 0 && (
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Vous envoyez</Text>
            <Text style={styles.summaryValue}>{formatXAF(amount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Frais</Text>
            <Text style={styles.summaryValue}>Gratuit</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryLabelBold}>Total</Text>
            <Text style={styles.summaryValueBold}>{formatXAF(amount)}</Text>
          </View>
        </View>
      )}

      <View style={{ flex: 1 }} />

      <Button
        label="Envoyer"
        onPress={() => transfer.mutate()}
        disabled={!valid}
        loading={transfer.isPending}
        size="lg"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.neutral[700], marginBottom: 6 },
  amountInput: { fontSize: 22, fontWeight: '700' },
  summary: {
    backgroundColor: theme.colors.neutral[0],
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    marginTop: theme.spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
    marginTop: 6,
    paddingTop: 10,
  },
  summaryLabel: { color: theme.colors.neutral[600], fontSize: 14 },
  summaryValue: { color: theme.colors.neutral[800], fontSize: 14 },
  summaryLabelBold: { color: theme.colors.neutral[800], fontSize: 15, fontWeight: '700' },
  summaryValueBold: { color: theme.colors.primary[600], fontSize: 16, fontWeight: '700' },
});
