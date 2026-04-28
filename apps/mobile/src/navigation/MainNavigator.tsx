import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/theme';
import { HomeScreen } from '@/screens/main/HomeScreen';
import { TransactionsScreen } from '@/screens/main/TransactionsScreen';
import { ProfileScreen } from '@/screens/main/ProfileScreen';
import { TopupScreen } from '@/screens/main/TopupScreen';
import { TransferScreen } from '@/screens/main/TransferScreen';
import { WithdrawScreen } from '@/screens/main/WithdrawScreen';
import { SetPinScreen } from '@/screens/main/SetPinScreen';

export type MainTabParamList = {
  Home: undefined;
  Transactions: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  Topup: undefined;
  Transfer: undefined;
  Withdraw: undefined;
  SetPin: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary[500],
        tabBarInactiveTintColor: theme.colors.neutral[400],
        tabBarStyle: {
          backgroundColor: theme.colors.neutral[0],
          borderTopColor: theme.colors.neutral[200],
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          const map: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
            Home: 'wallet-outline',
            Transactions: 'list-outline',
            Profile: 'person-outline',
          };
          return <Ionicons name={map[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Accueil' }} />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ tabBarLabel: 'Historique' }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profil' }} />
    </Tab.Navigator>
  );
}

export function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen
        name="Topup"
        component={TopupScreen}
        options={{ headerShown: true, title: 'Recharger', presentation: 'modal' }}
      />
      <Stack.Screen
        name="Transfer"
        component={TransferScreen}
        options={{ headerShown: true, title: 'Envoyer', presentation: 'modal' }}
      />
      <Stack.Screen
        name="Withdraw"
        component={WithdrawScreen}
        options={{ headerShown: true, title: 'Retirer', presentation: 'modal' }}
      />
      <Stack.Screen
        name="SetPin"
        component={SetPinScreen}
        options={{ headerShown: true, title: 'Code PIN', presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
