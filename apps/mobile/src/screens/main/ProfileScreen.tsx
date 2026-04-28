import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/api/auth.api';
import { theme } from '@/theme';

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  const initials =
    (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || (user?.phone?.slice(-2) ?? '?');

  const onLogout = () => {
    Alert.alert('Déconnexion', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: async () => {
          await authApi.logout();
          await clearSession();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar + identity */}
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>
            {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}` : 'Profil Kelyo'}
          </Text>
          <Text style={styles.phone}>{user?.phone}</Text>
        </View>

        {/* KYC card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vérification d'identité</Text>
          <KycCard tier={user?.kycTier ?? 'TIER_0'} status={user?.kycStatus ?? 'NOT_SUBMITTED'} />
        </View>

        {/* Settings list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paramètres</Text>
          <SettingRow icon="lock-closed-outline" label="Code PIN" comingSoon />
          <SettingRow icon="finger-print-outline" label="Authentification biométrique" comingSoon />
          <SettingRow icon="notifications-outline" label="Notifications" comingSoon />
          <SettingRow icon="language-outline" label="Langue" valueText="Français" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <SettingRow icon="help-circle-outline" label="Centre d'aide" comingSoon />
          <SettingRow icon="document-text-outline" label="Conditions d'utilisation" comingSoon />
          <SettingRow icon="shield-checkmark-outline" label="Confidentialité" comingSoon />
        </View>

        <Pressable onPress={onLogout} style={styles.logout}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>

        <Text style={styles.version}>Kelyo v0.1.0 · MVP</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function KycCard({ tier, status }: { tier: string; status: string }) {
  const tierLabels: Record<string, { label: string; color: string }> = {
    TIER_0: { label: 'Niveau 0 — Plafond limité', color: theme.colors.warning },
    TIER_1: { label: 'Niveau 1 — Identité vérifiée', color: theme.colors.success },
    TIER_2: { label: 'Niveau 2 — Vérification complète', color: theme.colors.success },
  };
  const info = tierLabels[tier] ?? tierLabels.TIER_0;

  return (
    <Pressable style={styles.kycCard}>
      <View style={[styles.kycDot, { backgroundColor: info.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.kycTitle}>{info.label}</Text>
        <Text style={styles.kycStatus}>
          {status === 'PENDING' && 'En cours de vérification'}
          {status === 'APPROVED' && 'Approuvé'}
          {status === 'REJECTED' && 'Rejeté — soumettre à nouveau'}
          {status === 'NOT_SUBMITTED' && 'Compléter pour augmenter vos plafonds'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.neutral[400]} />
    </Pressable>
  );
}

function SettingRow({
  icon,
  label,
  valueText,
  comingSoon,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  valueText?: string;
  comingSoon?: boolean;
}) {
  return (
    <Pressable style={styles.row}>
      <Ionicons name={icon} size={20} color={theme.colors.neutral[600]} />
      <Text style={styles.rowLabel}>{label}</Text>
      {valueText ? <Text style={styles.rowValue}>{valueText}</Text> : null}
      {comingSoon ? <Text style={styles.soonTag}>Bientôt</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={theme.colors.neutral[300]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  identity: { alignItems: 'center', marginBottom: theme.spacing.lg },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  avatarText: { color: theme.colors.neutral[0], fontSize: 30, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '700', color: theme.colors.neutral[900] },
  phone: { color: theme.colors.neutral[500], marginTop: 2 },
  section: { marginTop: theme.spacing.lg },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
    marginLeft: 4,
  },
  kycCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[0],
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    gap: theme.spacing.sm,
  },
  kycDot: { width: 10, height: 10, borderRadius: 5 },
  kycTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.neutral[900] },
  kycStatus: { fontSize: 13, color: theme.colors.neutral[600], marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[0],
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: 6,
    gap: theme.spacing.sm,
  },
  rowLabel: { flex: 1, fontSize: 15, color: theme.colors.neutral[800] },
  rowValue: { fontSize: 14, color: theme.colors.neutral[500] },
  soonTag: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.neutral[500],
    backgroundColor: theme.colors.neutral[100],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: theme.spacing.xl,
    padding: theme.spacing.md,
  },
  logoutText: { color: theme.colors.danger, fontSize: 15, fontWeight: '600' },
  version: {
    textAlign: 'center',
    color: theme.colors.neutral[400],
    fontSize: 12,
    marginTop: theme.spacing.lg,
  },
});
