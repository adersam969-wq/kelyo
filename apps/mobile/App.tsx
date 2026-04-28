import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from '@/navigation/RootNavigator';
import { theme } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30,
    },
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer
          theme={{
            dark: false,
            colors: {
              primary: theme.colors.primary[500],
              background: theme.colors.neutral[50],
              card: theme.colors.neutral[0],
              text: theme.colors.neutral[900],
              border: theme.colors.neutral[200],
              notification: theme.colors.danger,
            },
          }}
        >
          <RootNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
