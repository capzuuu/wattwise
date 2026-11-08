import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/ui/icon';
import { useAppTheme } from '@/context/theme-context';
import { WattWiseTheme } from '@/constants/theme';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  badge?: string;
  showBrandLogo?: boolean;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
}

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  badge,
  showBrandLogo = false,
  onNotificationPress,
  onProfilePress,
}: AppHeaderProps) {
  const { colors, isDark } = useAppTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={[styles.headerContainer, { backgroundColor: isDark ? 'rgba(14, 27, 50, 0.92)' : 'rgba(249, 249, 255, 0.94)', borderBottomColor: colors.borderSubtle }]}>
      <View style={styles.leftSection}>
        {showBack ? (
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: pressed ? colors.surfaceContainer : 'transparent' },
            ]}
            hitSlop={10}
            accessibilityLabel="Go back"
          >
            <Icon name="arrow_back" size={22} color={colors.textPrimary} />
          </Pressable>
        ) : null}

        {showBrandLogo ? (
          <View style={styles.brandRow}>
            <View style={[styles.logoIconContainer, { backgroundColor: WattWiseTheme.colors.primary }]}>
              <Icon name="bolt" size={18} color={WattWiseTheme.colors.secondaryContainer} />
            </View>
            <View>
              <View style={styles.brandTitleRow}>
                <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>WattWise</Text>
                {badge ? (
                  <View style={[styles.brandBadge, { backgroundColor: colors.badgeBg }]}>
                    <Text style={[styles.brandBadgeText, { color: colors.badgeText }]}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              {subtitle ? (
                <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.titleColumn}>
            {title ? <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>{title}</Text> : null}
            {subtitle ? <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
          </View>
        )}
      </View>

      <View style={styles.rightSection}>
        <Pressable
          onPress={onNotificationPress || (() => router.push('/notifications'))}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: pressed ? colors.surfaceContainer : 'transparent' },
          ]}
          accessibilityLabel="Notifications"
        >
          <Icon name="notifications" size={22} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          onPress={onProfilePress || (() => router.push('/profile'))}
          style={({ pressed }) => [
            styles.avatarButton,
            { opacity: pressed ? 0.8 : 1, borderColor: colors.border },
          ]}
          accessibilityLabel="User Profile"
        >
          <Image
            source={{ uri: DEFAULT_AVATAR }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    zIndex: 10,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: -1,
  },
  brandBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  titleColumn: {
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  screenSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
});

