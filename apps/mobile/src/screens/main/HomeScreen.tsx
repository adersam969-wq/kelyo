import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { walletApi } from '@/api/wallet.api';
import { formatXAF } from '@/utils/money';
import { useAuthStore } from '@/store/auth.store';
import { theme } from '@/theme';
import type { MainStackParamList } from '@/navigation/MainNavigator';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export function HomeScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: walletApi.getMine,
    refetchInterval: 30_000,
  });

  const transactions = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: () => walletApi.listTransactions(1, 5),
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={wallet.isRefetching}
            onRefresh={() => {
              wallet.refetch();
              transactions.refetch();
            }}
          />
        }
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={styles.hello}>Bonjour 👋</Text>
          <Text style={styles.name}>
            {user?.firstName || user?.phone || 'Utilisateur'}
          </Text>
        </View>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Solde disponible</Text>
          <Text style={styles.balanceAmount}>
            {wallet.data ? formatXAF(wallet.data.availableBalance) : '— XAF'}
          </Text>
          {wallet.data && wallet.data.balance !== wallet.data.availableBalance && (
            <Text style={styles.balanceTotal}>
              Total : {formatXAF(wallet.data.balance)}
            </Text>
          )}
        </View>

        {/* Quick actions */}
        <View style={styles.actionsGrid}>
          <ActionTile
            icon="add-circle"
            label="Recharger"
            color={theme.colors.secondary[500]}
            onPress={() => nav.navigate('Topup')}
          />
          <ActionTile
            icon="paper-plane"
            label="Envoyer"
            color={theme.colors.primary[500]}
            onPress={() => nav.navigate('Transfer')}
          />
          <ActionTile
            icon="qr-code"
            label="Scanner"
            color={theme.colors.primary[700]}
            onPress={() => {
              // Phase 4
            }}
          />
          <ActionTile
            icon="arrow-up-circle"
            label="Retirer"
            color={theme.colors.secondary[700]}
            onPress={() => nav.navigate('Withdraw')}
          />
        </View>

        {/* KYC banner */}
        {user && user.kycTier === 'TIER_0' && (
          <Pressable style={styles.kycBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kycTitle}>Vérifiez votre identité</Text>
              <Text style={styles.kycSubtitle}>
                Augmentez vos plafonds en complétant votre KYC.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={theme.colors.primary[600]} />
          </Pressable>
        )}

        {/* Recent transactions preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transactions récentes</Text>
          {transactions.data?.data && transactions.data.data.length > 0 ? (
            transactions.data.data.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={styles.txIcon}>
                  <Ionicons
                    name={txIconFor(tx.type)}
                    size={18}
                    color={theme.colors.primary[600]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txTitle}>
                    {tx.counterpartyName ?? labelFor(tx.type)}
                  </Text>
                  <Text style={styles.txMeta}>
                    {new Date(tx.createdAt).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.txAmount,
                    isCredit(tx.type) ? styles.txAmountIn : styles.txAmountOut,
                  ]}
                >
                  {isCredit(tx.type) ? '+' : '−'} {formatXAF(tx.amount)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Aucune transaction pour le moment.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionTile({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function isCredit(type: string) {
  return ['TOPUP', 'TRANSFER_IN', 'COLLECTION'].includes(type);
}

function labelFor(type: string) {
  const map: Record<string, string> = {
    TOPUP: 'Recharge',
    WITHDRAWAL: 'Retrait',
    TRANSFER_OUT: 'Envoi',
    TRANSFER_IN: 'Réception',
    PAYMENT: 'Paiement',
    COLLECTION: 'Encaissement',
    FEE: 'Frais',
    REVERSAL: 'Annulation',
  };
  return map[type] ?? type;
}

function txIconFor(type: string): keyof typeof Ionicons.glyphMap {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    TOPUP: 'add-circle-outline',
    WITHDRAWAL: 'arrow-up-circle-outline',
    TRANSFER_OUT: 'paper-plane-outline',
    TRANSFER_IN: 'arrow-down-circle-outline',
    PAYMENT: 'card-outline',
    COLLECTION: 'cash-outline',
  };
  return map[type] ?? 'ellipsis-horizontal-circle-outline';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  greeting: { marginBottom: theme.spacing.lg },
  hello: { fontSize: 14, color: theme.colors.neutral[500] },
  name: { fontSize: 22, fontWeight: '700', color: theme.colors.neutral[900], marginTop: 2 },
  balanceCard: {
    backgroundColor: theme.colors.primary[600],
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    marginBottom: theme.spacing.lg,
  },
  balanceLabel: { color: theme.colors.primary[100], fontSize: 14 },
  balanceAmount: {
    color: theme.colors.neutral[0],
    fontSize: 36,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  balanceTotal: {
    color: theme.colors.primary[200],
    fontSize: 13,
    marginTop: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  actionTile: {
    flex: 1,
    backgroundColor: theme.colors.neutral[0],
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.neutral[800],
  },
  kycBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary[50],
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary[100],
  },
  kycTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.primary[700] },
  kycSubtitle: { marginTop: 2, fontSize: 13, color: theme.colors.primary[600] },
  section: { marginTop: theme.spacing.sm },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.neutral[800],
    marginBottom: theme.spacing.sm,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[0],
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: 8,
    gap: theme.spacing.sm,
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.neutral[900] },
  txMeta: { fontSize: 12, color: theme.colors.neutral[500], marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700' },
  txAmountIn: { color: theme.colors.success },
  txAmountOut: { color: theme.colors.neutral[800] },
  emptyText: { color: theme.colors.neutral[500], fontSize: 14, paddingVertical: theme.spacing.md },
});
