import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { walletApi } from '@/api/wallet.api';
import { parseAmount } from '@/utils/money';
import { theme } from '@/theme';

type Channel = 'AIRTEL_MONEY' | 'MOOV_MONEY' | 'CARD_VISA' | 'CARD_MASTERCARD';

const CHANNELS: { value: Channel; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'AIRTEL_MONEY', label: 'Airtel Money', icon: 'phone-portrait-outline' },
  { value: 'MOOV_MONEY', label: 'Moov Money', icon: 'phone-portrait-outline' },
  { value: 'CARD_VISA', label: 'Carte Visa', icon: 'card-outline' },
  { value: 'CARD_MASTERCARD', label: 'Carte Mastercard', icon: 'card-outline' },
];

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000];

export function TopupScreen() {
  const nav = useNavigation();
  const [amountRaw, setAmountRaw] = useState('');
  const [channel, setChannel] = useState<Channel>('AIRTEL_MONEY');

  const initiate = useMutation({
    mutationFn: () => {
      const amount = parseAmount(amountRaw)!;
      if (amount % 5 !== 0) {
        throw new Error('Le montant doit être un multiple de 5 XAF');
      }
      return walletApi.initiateTopup({ amount, channel });
    },
    onSuccess: async ({ checkoutUrl }) => {
      // Open the CinetPay checkout URL in the system browser / WebView
      const can = await Linking.canOpenURL(checkoutUrl);
      if (can) {
        Linking.openURL(checkoutUrl);
        nav.goBack();
        Alert.alert(
          'Paiement en cours',
          'Le solde sera crédité automatiquement après confirmation.',
        );
      } else {
        Alert.alert('Erreur', 'Impossible d\'ouvrir la page de paiement.');
      }
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error?.message ?? err?.message ?? 'Erreur lors de la recharge';
      Alert.alert('Erreur', String(msg));
    },
  });

  const amount = parseAmount(amountRaw);
  const valid = !!amount && amount >= 100 && amount % 5 === 0;

  return (
    <Screen>
      <Text style={styles.label}>Montant</Text>
      <Input
        placeholder="0"
        keyboardType="number-pad"
        value={amountRaw}
        onChangeText={setAmountRaw}
        autoFocus
        style={styles.amountInput}
        hint="Montant minimum 100 XAF, multiple de 5"
      />

      <View style={styles.quickRow}>
        {QUICK_AMOUNTS.map((q) => (
          <Pressable
            key={q}
            onPress={() => setAmountRaw(String(q))}
            style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.quickChipText}>{q.toLocaleString('fr-FR')}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { marginTop: theme.spacing.lg }]}>Source</Text>
      <View style={styles.channels}>
        {CHANNELS.map((c) => (
          <Pressable
            key={c.value}
            onPress={() => setChannel(c.value)}
            style={[
              styles.channel,
              channel === c.value && styles.channelSelected,
            ]}
          >
            <Ionicons
              name={c.icon}
              size={20}
              color={
                channel === c.value ? theme.colors.primary[600] : theme.colors.neutral[500]
              }
            />
            <Text
              style={[
                styles.channelLabel,
                channel === c.value && styles.channelLabelSelected,
              ]}
            >
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <Button
        label="Continuer"
        onPress={() => initiate.mutate()}
        disabled={!valid}
        loading={initiate.isPending}
        size="lg"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.neutral[700], marginBottom: 6 },
  amountInput: { fontSize: 28, fontWeight: '700' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: theme.spacing.sm },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.radius.full,
  },
  quickChipText: { fontSize: 13, fontWeight: '600', color: theme.colors.neutral[700] },
  channels: { gap: 8 },
  channel: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.neutral[0],
    borderWidth: 1.5,
    borderColor: theme.colors.neutral[200],
    borderRadius: theme.radius.md,
    gap: theme.spacing.sm,
  },
  channelSelected: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.primary[50],
  },
  channelLabel: { fontSize: 15, fontWeight: '500', color: theme.colors.neutral[700] },
  channelLabelSelected: { color: theme.colors.primary[700], fontWeight: '600' },
});
