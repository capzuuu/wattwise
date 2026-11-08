import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { useAuth } from '@/context/auth-context';
import { TabKey, useTab } from '@/context/tab-context';
import { useAppTheme } from '@/context/theme-context';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BreakdownView } from '@/views/breakdown-view';
import { HomeView } from '@/views/home-view';
import { InsightsView } from '@/views/insights-view';
import { ProfileView } from '@/views/profile-view';
import { ScanView } from '@/views/scan-view';

export default function IndexShellScreen() {
  const { colors, isDark } = useAppTheme();
  const { currentTab, setTab } = useTab();
  const { isOnboarded, isAuthenticated, isLoading } = useAuth();

  // Route protection redirect for unauthenticated or first-time users
  useEffect(() => {
    if (!isLoading) {
      if (!isOnboarded) {
        router.replace('/onboarding');
      } else if (!isAuthenticated) {
        router.replace('/auth');
      }
    }
  }, [isLoading, isOnboarded, isAuthenticated]);

  // Android hardware back button: return to Home tab if on a sub-tab
  useEffect(() => {
    const onBackPress = () => {
      if (currentTab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [currentTab, setTab]);

  // Lazy mount tracking: only instantiate a tab component when first visited
  const [visitedTabs, setVisitedTabs] = useState<Record<TabKey, boolean>>({
    home: true,
    scan: false,
    breakdown: false,
    insights: false,
    profile: false,
  });

  useEffect(() => {
    setVisitedTabs((prev) => (prev[currentTab] ? prev : { ...prev, [currentTab]: true }));
  }, [currentTab]);

  const renderHeader = () => {
    switch (currentTab) {
      case 'home':
        return (
          <AppHeader
            showBrandLogo
            badge="Ph"
            onProfilePress={() => setTab('profile')}
          />
        );
      case 'scan':
        return (
          <AppHeader
            title="Scan Bill"
            subtitle="Electricity, Water & Wi-Fi"
            onProfilePress={() => setTab('profile')}
          />
        );
      case 'breakdown':
        return (
          <AppHeader
            title="Bill Breakdown"
            subtitle="Itemized AI Telemetry"
            onProfilePress={() => setTab('profile')}
          />
        );
      case 'insights':
        return (
          <AppHeader
            title="Wattwise AI"
            subtitle="Ask a Question"
            onProfilePress={() => setTab('profile')}
          />
        );
      case 'profile':
        return (
          <AppHeader
            title="Profile"
            subtitle="Theme & Preferences"
            onProfilePress={() => setTab('profile')}
          />
        );
    }
  };

  if (isLoading || !isOnboarded || !isAuthenticated) {
    return (
      <View style={[styles.safeArea, { backgroundColor: colors.background }]} />
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* Persistent App Header */}
      {renderHeader()}

      {/* Preserved Keep-Alive Tab Container (0ms switch latency, zero state loss) */}
      <View style={styles.contentContainer}>
        {visitedTabs.home && (
          <View style={[styles.tabViewWrapper, currentTab !== 'home' && styles.hiddenView]}>
            <HomeView />
          </View>
        )}
        {visitedTabs.scan && (
          <View style={[styles.tabViewWrapper, currentTab !== 'scan' && styles.hiddenView]}>
            <ScanView />
          </View>
        )}
        {visitedTabs.breakdown && (
          <View style={[styles.tabViewWrapper, currentTab !== 'breakdown' && styles.hiddenView]}>
            <BreakdownView />
          </View>
        )}
        {visitedTabs.insights && (
          <View style={[styles.tabViewWrapper, currentTab !== 'insights' && styles.hiddenView]}>
            <InsightsView />
          </View>
        )}
        {visitedTabs.profile && (
          <View style={[styles.tabViewWrapper, currentTab !== 'profile' && styles.hiddenView]}>
            <ProfileView />
          </View>
        )}
      </View>

      {/* Persistent Floating Bottom Dock */}
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  tabViewWrapper: {
    flex: 1,
  },
  hiddenView: {
    display: 'none',
  },
});
