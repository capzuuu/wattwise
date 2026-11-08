import { AuthProvider, useAuth } from '@/context/auth-context';
import { TabProvider } from '@/context/tab-context';
import { ThemeProvider, useAppTheme } from '@/context/theme-context';
import { BillingStoreProvider } from '@/services/billing-store';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync().catch(() => { });

function RootNavigator() {
  const { isDark } = useAppTheme();
  const { isOnboarded, isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const currentRoute = segments[0] || 'index';
    const inOnboarding = currentRoute === 'onboarding';
    const inAuth = currentRoute === 'auth';

    if (!isOnboarded) {
      if (!inOnboarding) {
        router.replace('/onboarding');
      }
    } else if (!isAuthenticated) {
      if (!inAuth && !inOnboarding) {
        router.replace('/auth');
      }
    } else {
      if (inAuth) {
        router.replace('/');
      }
    }

    SplashScreen.hideAsync().catch(() => { });
  }, [isLoading, isOnboarded, isAuthenticated, segments, router]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 140,
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="scan" options={{ animation: 'fade' }} />
        <Stack.Screen name="breakdown" options={{ animation: 'fade' }} />
        <Stack.Screen name="insights" options={{ animation: 'fade' }} />
        <Stack.Screen name="profile" options={{ animation: 'fade' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BillingStoreProvider>
          <TabProvider>
            <RootNavigator />
          </TabProvider>
        </BillingStoreProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
