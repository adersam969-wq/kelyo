import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { theme } from '@/theme';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen() {
  const nav = useNavigation<Nav>();

  return (
    <Screen padded={false} background={theme.colors.primary[500]}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.brand}>Kelyo</Text>
          <Text style={styles.tagline}>Un wallet. Tous vos paiements.</Text>
        </View>

        <View style={styles.features}>
          <FeatureLine emoji="💳" text="Centralisez Mobile Money et cartes bancaires" />
          <FeatureLine emoji="📱" text="Payez partout par QR code ou lien" />
          <FeatureLine emoji="🔒" text="Sécurisé, conforme à la zone CEMAC" />
        </View>

        <View style={styles.actions}>
          <Button
            label="Créer un compte"
            variant="secondary"
            size="lg"
            onPress={() => nav.navigate('Phone', { mode: 'SIGNUP' })}
          />
          <View style={{ height: 12 }} />
          <Button
            label="Se connecter"
            variant="outline"
            size="lg"
            onPress={() => nav.navigate('Phone', { mode: 'LOGIN' })}
            style={{ borderColor: theme.colors.neutral[0] }}
          />
        </View>
      </View>
    </Screen>
  );
}

function FeatureLine({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureEmoji}>{emoji}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.xl,
    justifyContent: 'space-between',
  },
  hero: {
    marginTop: theme.spacing.xxl,
    alignItems: 'center',
  },
  brand: {
    fontSize: 64,
    fontWeight: '800',
    color: theme.colors.neutral[0],
    letterSpacing: -2,
  },
  tagline: {
    marginTop: theme.spacing.xs,
    fontSize: 17,
    color: theme.colors.primary[100],
  },
  features: {
    gap: theme.spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  featureEmoji: {
    fontSize: 24,
    marginRight: theme.spacing.md,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.neutral[0],
    fontWeight: '500',
  },
  actions: {
    paddingBottom: theme.spacing.lg,
  },
});

// Suppress unused import warning
void Image;
