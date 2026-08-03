import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Geist-Regular': require('../../assets/fonts/Geist-Regular.ttf'),
    'Geist-Medium': require('../../assets/fonts/Geist-Medium.ttf'),
    'Geist-SemiBold': require('../../assets/fonts/Geist-SemiBold.ttf'),
    'GeistMono-Regular': require('../../assets/fonts/GeistMono-Regular.ttf'),
    'GeistMono-Medium': require('../../assets/fonts/GeistMono-Medium.ttf'),
    'GeistMono-SemiBold': require('../../assets/fonts/GeistMono-SemiBold.ttf'),
    'SchibstedGrotesk-Bold': require('../../assets/fonts/SchibstedGrotesk-Bold.ttf'),
    'SchibstedGrotesk-ExtraBold': require('../../assets/fonts/SchibstedGrotesk-ExtraBold.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}
