import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/auth.store';
import { theme } from '@/theme';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user, isHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  if (!isHydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary[500]} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.neutral[50],
  },
});
