import { useInfiniteQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { walletApi, Transaction } from '@/api/wallet.api';
import { formatXAF } from '@/utils/money';
import { theme } from '@/theme';

export function TransactionsScreen() {
  const query = useInfiniteQuery({
    queryKey: ['transactions'],
    initialPageParam: 1,
    queryFn: ({ pageParam = 1 }) => walletApi.listTransactions(pageParam, 20),
    getNextPageParam: (lastPage, all) => {
      const fetched = all.reduce((acc, p) => acc + p.data.length, 0);
      return fetched < lastPage.meta.total ? all.length + 1 : undefined;
    },
  });

  const items = query.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Historique</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => <TransactionItem tx={item} />}
        contentContainerStyle={styles.list}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={theme.colors.primary[500]} style={{ marginTop: 32 }} />
          ) : (
            <Text style={styles.empty}>Aucune transaction.</Text>
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator color={theme.colors.primary[500]} style={{ marginVertical: 16 }} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function TransactionItem({ tx }: { tx: Transaction }) {
  const credit = ['TOPUP', 'TRANSFER_IN', 'COLLECTION'].includes(tx.type);
  return (
    <View style={styles.row}>
      <View style={[styles.icon, credit ? styles.iconIn : styles.iconOut]}>
        <Ionicons
          name={credit ? 'arrow-down' : 'arrow-up'}
          size={16}
          color={credit ? theme.colors.success : theme.colors.neutral[700]}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>
          {tx.counterpartyName ?? labelFor(tx.type)}
        </Text>
        {tx.description ? <Text style={styles.rowDesc}>{tx.description}</Text> : null}
        <Text style={styles.rowMeta}>
          {new Date(tx.createdAt).toLocaleString('fr-FR')} · {statusLabel(tx.status)}
        </Text>
      </View>
      <Text style={[styles.amount, credit ? styles.amountIn : styles.amountOut]}>
        {credit ? '+' : '−'} {formatXAF(tx.amount)}
      </Text>
    </View>
  );
}

function labelFor(type: string) {
  const map: Record<string, string> = {
    TOPUP: 'Recharge',
    WITHDRAWAL: 'Retrait',
    TRANSFER_OUT: 'Envoi P2P',
    TRANSFER_IN: 'Réception P2P',
    PAYMENT: 'Paiement',
    COLLECTION: 'Encaissement',
    FEE: 'Frais',
    REVERSAL: 'Annulation',
  };
  return map[type] ?? type;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    PENDING: 'En attente',
    PROCESSING: 'En cours',
    COMPLETED: 'Terminé',
    FAILED: 'Échoué',
    CANCELLED: 'Annulé',
    REVERSED: 'Annulé',
  };
  return map[status] ?? status;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.neutral[50] },
  header: { padding: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  title: { fontSize: 24, fontWeight: '700', color: theme.colors.neutral[900] },
  list: { padding: theme.spacing.md, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[0],
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    gap: theme.spacing.sm,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconIn: { backgroundColor: theme.colors.secondary[50] },
  iconOut: { backgroundColor: theme.colors.neutral[100] },
  rowTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.neutral[900] },
  rowDesc: { fontSize: 13, color: theme.colors.neutral[600], marginTop: 2 },
  rowMeta: { fontSize: 11, color: theme.colors.neutral[500], marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
  amountIn: { color: theme.colors.success },
  amountOut: { color: theme.colors.neutral[800] },
  empty: { textAlign: 'center', color: theme.colors.neutral[500], marginTop: 32 },
});
