import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { Icon, IconName } from '@/components/ui/icon';
import { WattWiseTheme } from '@/constants/theme';
import { TabKey, useTab } from '@/context/tab-context';
import { useAppTheme } from '@/context/theme-context';

interface NavItem {
  key: TabKey;
  label: string;
  icon: IconName;
  isCenter?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'breakdown', label: 'Usage', icon: 'bar_chart' },
  { key: 'scan', label: 'Scan', icon: 'document_scanner', isCenter: true },
  { key: 'insights', label: 'Insights', icon: 'auto_awesome' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];

const PILL_WIDTH = 54;
const PILL_HEIGHT = 40;

const TAB_INDEX_MAP: Record<TabKey, number> = {
  home: 0,
  breakdown: 1,
  scan: 2,
  insights: 3,
  profile: 4,
};

export function BottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { currentTab, setTab } = useTab();

  const [dockWidth, setDockWidth] = useState(0);
  const [tabLayouts, setTabLayouts] = useState<Partial<Record<TabKey, { x: number; width: number }>>>({});
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(currentTab === 'scan' ? 0 : 1)).current;
  const isInitialized = useRef(false);

  const getTargetX = (key: TabKey) => {
    const layout = tabLayouts[key];
    if (layout) {
      return layout.x + (layout.width - PILL_WIDTH) / 2;
    }
    const idx = TAB_INDEX_MAP[key];
    const availableWidth = dockWidth > 0 ? dockWidth - 16 : 360;
    const colWidth = availableWidth / 5;
    return 8 + idx * colWidth + (colWidth - PILL_WIDTH) / 2;
  };

  useEffect(() => {
    const targetX = getTargetX(currentTab);
    const isScan = currentTab === 'scan';

    if (!isInitialized.current) {
      if (dockWidth > 0 || tabLayouts[currentTab]) {
        slideAnim.setValue(targetX);
        opacityAnim.setValue(isScan ? 0 : 1);
        isInitialized.current = true;
      }
      return;
    }

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: targetX,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: isScan ? 0 : 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentTab, tabLayouts, dockWidth]);

  const handleDockLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - dockWidth) > 1) {
      setDockWidth(w);
    }
  };

  const handleTabLayout = (key: TabKey, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setTabLayouts((prev) => {
      const cur = prev[key];
      if (cur && Math.abs(cur.x - x) < 0.5 && Math.abs(cur.width - width) < 0.5) {
        return prev;
      }
      return { ...prev, [key]: { x, width } };
    });
  };

  const handleTabPress = (key: TabKey) => {
    if (pathname !== '/' && pathname !== '') {
      router.replace('/');
    }
    setTab(key);
  };

  const activeColor = isDark ? WattWiseTheme.colors.secondaryContainer : WattWiseTheme.colors.primary;
  const inactiveColor = colors.textMuted;

  return (
    <View
      style={[
        styles.outerContainer,
        {
          paddingBottom: Math.max(insets.bottom, 12),
          display: isKeyboardVisible ? 'none' : 'flex',
        },
      ]}
      pointerEvents={isKeyboardVisible ? 'none' : 'box-none'}
    >
      <View
        onLayout={handleDockLayout}
        style={[
          styles.dockBar,
          {
            backgroundColor: isDark ? 'rgba(16, 30, 56, 0.94)' : 'rgba(255, 255, 255, 0.96)',
            borderColor: isDark ? 'rgba(43, 75, 130, 0.4)' : 'rgba(16, 43, 85, 0.08)',
          },
        ]}
      >
        {/* Animated Sliding Grey Switch Pill */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slidingPill,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#ECEFF3',
              opacity: opacityAnim,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        />

        {NAV_ITEMS.map((item) => {
          const active = currentTab === item.key;

          if (item.isCenter) {
            return (
              <View
                key={item.key}
                onLayout={(e) => handleTabLayout(item.key, e)}
                style={styles.centerButtonWrapper}
              >
                <Pressable
                  onPress={() => handleTabPress('scan')}
                  style={({ pressed }) => [
                    styles.centerButton,
                    {
                      backgroundColor: WattWiseTheme.colors.primary,
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                      borderColor: isDark ? '#101E38' : '#FFFFFF',
                    },
                  ]}
                  accessibilityLabel="Scan Electric Bill"
                >
                  <Icon name="document_scanner" size={24} color={WattWiseTheme.colors.secondaryContainer} />
                </Pressable>
              </View>
            );
          }

          return (
            <Pressable
              key={item.key}
              onLayout={(e) => handleTabLayout(item.key, e)}
              onPress={() => handleTabPress(item.key)}
              style={({ pressed }) => [
                styles.navTab,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityLabel={item.label}
            >
              {item.key === 'home' ? (
                <ExpoImage
                  source={require('../../../assets/images/tabIcons/home.svg')}
                  style={styles.customNavIcon}
                  tintColor={active ? activeColor : inactiveColor}
                  contentFit="contain"
                />
              ) : item.key === 'breakdown' ? (
                <ExpoImage
                  source={require('../../../assets/images/tabIcons/usage.svg')}
                  style={styles.customNavIcon}
                  tintColor={active ? activeColor : inactiveColor}
                  contentFit="contain"
                />
              ) : item.key === 'insights' ? (
                <ExpoImage
                  source={require('../../../assets/images/tabIcons/insights.svg')}
                  style={styles.customNavIcon}
                  tintColor={active ? activeColor : inactiveColor}
                  contentFit="contain"
                />
              ) : item.key === 'profile' ? (
                <ExpoImage
                  source={require('../../../assets/images/tabIcons/profile.svg')}
                  style={styles.customNavIcon}
                  tintColor={active ? activeColor : inactiveColor}
                  contentFit="contain"
                />
              ) : (
                <Icon
                  name={item.icon}
                  size={24}
                  color={active ? activeColor : inactiveColor}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 99,
  },
  dockBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 480,
    height: 60,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 8,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#102B55',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 8px 24px -4px rgba(16, 43, 85, 0.12)',
        backdropFilter: 'blur(12px)',
      },
    }),
  },
  slidingPill: {
    position: 'absolute',
    left: 0,
    top: 10,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    zIndex: 0,
  },
  navTab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  centerButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    flex: 1,
    zIndex: 2,
  },
  centerButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    ...Platform.select({
      ios: {
        shadowColor: '#001638',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 6px 16px rgba(0, 22, 56, 0.35)',
      },
    }),
  },
  customNavIcon: {
    width: 24,
    height: 24,
  },
});
