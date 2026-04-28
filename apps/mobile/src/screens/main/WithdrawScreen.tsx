import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { withdrawalsApi, WithdrawalChannel } from '@/api/withdrawals.api';
import { walletApi } from '@/api/wallet.api';
import { parseAmount, formatXAF } from '@/utils/money';
import { theme } from '@/theme';

const CHANNELS: { value: WithdrawalChannel; label: string }[] = [
  { value: 'AIRTEL_MONEY', label: 'Airtel Money' },
  { value: 'MOOV_MONEY', label: 'Moov Money' },
];

export function WithdrawScreen() {
  const nav = useNavigation();
  const qc = useQueryClient();

  // Step state machine: 'form' → 'pin' → done
  const [step, setStep] = useState<'form' | 'pin'>('form');

  const [phone, setPhone] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [channel, setChannel] = useState<WithdrawalChannel>('AIRTEL_MONEY');
  const [pin, setPin] = useState('');
  const [withdrawalId, setWithdrawalId] = useState<string | null>(null);
  const [feeQuoted, setFeeQuoted] = useState(0);

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.getMine });
  const pinStatus = useQuery({ queryKey: ['hasPin'], queryFn: withdrawalsApi.hasPin });

  const initiate = useMutation({
    mutationFn: () => {
      const amount = parseAmount(amountRaw)!;
      const e164 = phone.startsWith('+') ? phone : `+241${phone.replace(/^0/, '').replace(/\s/g, '')}`;
      return withdrawalsApi.initiate({
        amount,
        channel,
        recipientPhone: e164,
      });
    },
    onSuccess: ({ withdrawalId, fee }) => {
      setWithdrawalId(withdrawalId);
      setFeeQuoted(fee);
      setStep('pin');
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error?.message;
      if (code === 'PIN_NOT_SET') {
        Alert.alert(
          'PIN requis',
          'Vous devez d\'abord créer un code PIN à 4 chiffres pour effectuer un retrait.',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Créer un PIN', onPress: () => (nav as any).navigate('SetPin') },
          ],
        );
        return;
      }
      Alert.alert('Erreur', String(code ?? 'Erreur lors du retrait'));
    },
  });

  const confirm = useMutation({
    mutationFn: () => withdrawalsApi.confirm(withdrawalId!, pin),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['recent-transactions'] });
      Alert.alert(
        'Retrait en cours',
        'Le transfert a été initié. Vous recevrez les fonds dans quelques minutes sur votre Mobile Money.',
        [{ text: 'OK', onPress: () => nav.goBack() }],
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? 'PIN invalide';
      Alert.alert('Erreur', String(msg));
      setPin('');
    },
  });

  const amount = parseAmount(amountRaw);
  const phoneOk = /^(\+\d{8,15}|\d{8,12})$/.test(phone.replace(/\s/g, ''));
  const formValid = phoneOk && amount && amount >= 500;
  const pinValid = /^\d{4}$/.test(pin);

  if (step === 'pin') {
    return (
      <Screen>
        <Pressable onPress={() => setStep('form')} style={styles.back}>
          <Text style={styles.backText}>← Retour</Text>
        </Pressable>

        <Text style={styles.title}>Confirmez avec votre PIN</Text>
        <Text style={styles.subtitle}>
          Vous retirez <Text style={styles.bold}>{formatXAF(amount!)}</Text> vers{' '}
          <Text style={styles.bold}>{phone}</Text>
        </Text>

        {feeQuoted > 0 && (
          <View style={styles.feeBox}>
            <Text style={styles.feeText}>Frais : {formatXAF(feeQuoted)}</Text>
            <Text style={styles.feeText}>Total débité : {formatXAF(amount! + feeQuoted)}</Text>
          </View>
        )}

        <Input
          label="Code PIN (4 chiffres)"
          placeholder="••••"
          keyboardType="number-pad"
          maxLength={4}
          value={pin}
          onChangeText={setPin}
          autoFocus
          secureTextEntry
          textAlign="center"
          style={styles.pinInput}
        />

        <Button
          label="Confirmer le retrait"
          onPress={() => confirm.mutate()}
          disabled={!pinValid}
          loading={confirm.isPending}
          size="lg"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {wallet.data && (
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>Solde disponible</Text>
          <Text style={styles.balanceAmount}>{formatXAF(wallet.data.availableBalance)}</Text>
        </View>
      )}

      <Text style={styles.label}>Vers (numéro Mobile Money)</Text>
      <Input
        placeholder="07 12 34 56"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        hint="Le numéro qui recevra l'argent"
      />

      <Text style={styles.label}>Source</Text>
      <View style={styles.channels}>
        {CHANNELS.map((c) => (
          <Pressable
            key={c.value}
            onPress={() => setChannel(c.value)}
            style={[styles.channel, channel === c.value && styles.channelSelected]}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={20}
              color={channel === c.value ? theme.colors.primary[600] : theme.colors.neutral[500]}
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

      <Text style={styles.label}>Montant</Text>
      <Input
        placeholder="0"
        keyboardType="number-pad"
        value={amountRaw}
        onChangeText={setAmountRaw}
        style={styles.amountInput}
        hint="Minimum 500 XAF · 1% de frais au-delà de 10 000 XAF (max 500 XAF)"
      />

      {pinStatus.data === false && (
        <View style={styles.warning}>
          <Ionicons name="alert-circle" size={18} color={theme.colors.warning} />
          <Text style={styles.warningText}>
            Vous devez créer un PIN avant votre premier retrait.
          </Text>
        </View>
      )}

      <View style={{ flex: 1 }} />

      <Button
        label="Continuer"
        onPress={() => initiate.mutate()}
        disabled={!formValid}
        loading={initiate.isPending}
        size="lg"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingVertical: 8, marginBottom: 8 },
  backText: { fontSize: 16, color: theme.colors.primary[600], fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: theme.colors.neutral[900], marginBottom: 6 },
  subtitle: { fontSize: 15, color: theme.colors.neutral[600], marginBottom: theme.spacing.lg, lineHeight: 22 },
  bold: { fontWeight: '700', color: theme.colors.neutral[900] },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.neutral[700], marginBottom: 6 },
  amountInput: { fontSize: 22, fontWeight: '700' },
  pinInput: { fontSize: 32, letterSpacing: 16, fontWeight: '700' },
  balanceBox: {
    backgroundColor: theme.colors.primary[50],
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.lg,
  },
  balanceLabel: { fontSize: 12, color: theme.colors.primary[700], fontWeight: '600' },
  balanceAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.primary[800],
    marginTop: 2,
  },
  channels: { gap: 8, marginBottom: theme.spacing.md },
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
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    marginTop: theme.spacing.sm,
  },
  warningText: { flex: 1, fontSize: 13, color: '#92400E' },
  feeBox: {
    backgroundColor: theme.colors.neutral[100],
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.md,
  },
  feeText: { fontSize: 13, color: theme.colors.neutral[700] },
});
