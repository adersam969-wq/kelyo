import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '@/screens/auth/WelcomeScreen';
import { PhoneScreen } from '@/screens/auth/PhoneScreen';
import { OtpVerifyScreen } from '@/screens/auth/OtpVerifyScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  Phone: { mode: 'SIGNUP' | 'LOGIN' };
  OtpVerify: { phone: string; mode: 'SIGNUP' | 'LOGIN' };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Phone" component={PhoneScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
    </Stack.Navigator>
  );
}
