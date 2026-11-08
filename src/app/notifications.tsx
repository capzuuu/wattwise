import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, IconName } from '@/components/ui/icon';
import { SlideUpItem } from '@/components/animation/slide-up-item';
import { useAppTheme } from '@/context/theme-context';
import { useTab } from '@/context/tab-context';
import { WattWiseTheme } from '@/constants/theme';
import { apiClient } from '@/services/api-client';

type NotificationCategory = 'all' | 'bills' | 'usage' | 'appliances';

interface NotificationItem {
  id: string;
  category: 'bills' | 'usage' | 'appliances';
  title: string;
  body: string;
  timestamp: string;
  section: 'Today' | 'Earlier';
  icon: IconName;
  read: boolean;
  actionLabel?: string;
  actionTab?: 'breakdown' | 'insights' | 'profile' | 'scan';
}

export default function NotificationsScreen() {
  const { colors, isDark } = useAppTheme();
  const { setTab } = useTab();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all');

  // Load live notifications from SQLite database
  useEffect(() => {
    let isMounted = true;
    async function loadNotifications() {
      try {
        const notifs = await apiClient.getNotifications();
        if (isMounted && notifs?.length) {
          setNotifications(notifs as NotificationItem[]);
        }
      } catch {
        // Fallback handled
      }
    }
    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await apiClient.markAllNotificationsRead();
    } catch {
      // offline fallback
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Notifications',
      'Are you sure you want to dismiss all notification items?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => setNotifications([]),
        },
      ]
    );
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    // Mark as read in local state
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );

    // Persist to SQLite
    try {
      await apiClient.markNotificationRead(item.id);
    } catch {
      // offline
    }

    // Navigate to relevant tab if applicable
    if (item.actionTab) {
      setTab(item.actionTab);
      router.replace('/');
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    if (activeCategory === 'all') return true;
    return item.category === activeCategory;
  });

  const todayNotifications = filteredNotifications.filter((n) => n.section === 'Today');
  const earlierNotifications = filteredNotifications.filter(
    (n) => n.section === 'Earlier'
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      {/* 1. Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: isDark
              ? 'rgba(14, 27, 50, 0.94)'
              : 'rgba(249, 249, 255, 0.94)',
            borderBottomColor: colors.borderSubtle,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: pressed ? colors.surfaceContainer : 'transparent' },
            ]}
            hitSlop={10}
            accessibilityLabel="Go back"
          >
            <Icon name="arrow_back" size={22} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.titleColumn}>
            <View style={styles.titleRow}>
              <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
                Notifications
              </Text>
              {unreadCount > 0 && (
                <View
                  style={[
                    styles.unreadBadge,
                    { backgroundColor: WattWiseTheme.colors.primaryFixed },
                  ]}
                >
                  <Text
                    style={[
                      styles.unreadBadgeText,
                      { color: WattWiseTheme.colors.primaryDark },
                    ]}
                  >
                    {unreadCount} new
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          {unreadCount > 0 ? (
            <Pressable
              onPress={handleMarkAllRead}
              hitSlop={10}
              style={({ pressed }) => [
                styles.actionLink,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.actionLinkText, { color: WattWiseTheme.colors.primary }]}>
                Mark all read
              </Text>
            </Pressable>
          ) : notifications.length > 0 ? (
            <Pressable
              onPress={handleClearAll}
              hitSlop={10}
              style={({ pressed }) => [
                styles.actionLink,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.actionLinkText, { color: colors.textMuted }]}>
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Filter Pills */}
        <SlideUpItem index={0}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'bills', label: 'Bills' },
                { id: 'appliances', label: 'Appliances' },
                { id: 'usage', label: 'Usage' },
              ] as const
            ).map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setActiveCategory(cat.id)}
                  style={({ pressed }) => [
                    styles.filterPill,
                    {
                      backgroundColor: isSelected
                        ? WattWiseTheme.colors.primary
                        : colors.surfaceContainerLowest,
                      borderColor: isSelected
                        ? WattWiseTheme.colors.primary
                        : colors.borderSubtle,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      {
                        color: isSelected ? '#FFFFFF' : colors.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </SlideUpItem>

        {/* 3. Empty State */}
        {filteredNotifications.length === 0 ? (
          <SlideUpItem index={1}>
            <View
              style={[
                styles.emptyStateCard,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <View
                style={[
                  styles.emptyIconContainer,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <Icon name="check" size={24} color={WattWiseTheme.colors.secondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                All Caught Up
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                No pending advisories or bill alerts in this category. We will notify you if demand spikes or a statement is due.
              </Text>
            </View>
          </SlideUpItem>
        ) : (
          <>
            {/* 4. Today's Notifications */}
            {todayNotifications.length > 0 && (
              <SlideUpItem index={1}>
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                    Today
                  </Text>
                  <View
                    style={[
                      styles.groupedCard,
                      {
                        backgroundColor: colors.surfaceContainerLowest,
                        borderColor: colors.borderSubtle,
                      },
                    ]}
                  >
                    {todayNotifications.map((item, index) => {
                      const isLast = index === todayNotifications.length - 1;
                      return (
                        <View key={item.id}>
                          <Pressable
                            onPress={() => handleNotificationPress(item)}
                            style={({ pressed }) => [
                              styles.notificationRow,
                              {
                                backgroundColor: !item.read
                                  ? isDark
                                    ? 'rgba(16, 43, 85, 0.25)'
                                    : 'rgba(215, 226, 255, 0.22)'
                                  : pressed
                                  ? isDark
                                    ? 'rgba(255, 255, 255, 0.03)'
                                    : 'rgba(16, 43, 85, 0.03)'
                                  : 'transparent',
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.notificationIconWell,
                                {
                                  backgroundColor: !item.read
                                    ? WattWiseTheme.colors.primaryFixed
                                    : colors.surfaceContainerLow,
                                },
                              ]}
                            >
                              <Icon
                                name={item.icon}
                                size={18}
                                color={
                                  !item.read
                                    ? WattWiseTheme.colors.primary
                                    : colors.textSecondary
                                }
                              />
                            </View>

                            <View style={styles.notificationContent}>
                              <View style={styles.titleRow}>
                                <Text
                                  style={[
                                    styles.notificationTitle,
                                    {
                                      color: colors.textPrimary,
                                      fontWeight: !item.read ? '700' : '600',
                                    },
                                  ]}
                                >
                                  {item.title}
                                </Text>
                                <Text style={[styles.timestamp, { color: colors.textMuted }]}>
                                  {item.timestamp}
                                </Text>
                              </View>

                              <Text
                                style={[
                                  styles.notificationBody,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                {item.body}
                              </Text>

                              {item.actionLabel && (
                                <View style={styles.actionRow}>
                                  <Text
                                    style={[
                                      styles.actionLabelText,
                                      { color: WattWiseTheme.colors.primary },
                                    ]}
                                  >
                                    {item.actionLabel}
                                  </Text>
                                  <Icon
                                    name="chevron_right"
                                    size={14}
                                    color={WattWiseTheme.colors.primary}
                                  />
                                </View>
                              )}
                            </View>
                          </Pressable>

                          {!isLast && (
                            <View
                              style={[
                                styles.rowDivider,
                                { backgroundColor: colors.borderSubtle },
                              ]}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              </SlideUpItem>
            )}

            {/* 5. Earlier Notifications */}
            {earlierNotifications.length > 0 && (
              <SlideUpItem index={2}>
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                    Earlier
                  </Text>
                  <View
                    style={[
                      styles.groupedCard,
                      {
                        backgroundColor: colors.surfaceContainerLowest,
                        borderColor: colors.borderSubtle,
                      },
                    ]}
                  >
                    {earlierNotifications.map((item, index) => {
                      const isLast = index === earlierNotifications.length - 1;
                      return (
                        <View key={item.id}>
                          <Pressable
                            onPress={() => handleNotificationPress(item)}
                            style={({ pressed }) => [
                              styles.notificationRow,
                              {
                                backgroundColor: !item.read
                                  ? isDark
                                    ? 'rgba(16, 43, 85, 0.25)'
                                    : 'rgba(215, 226, 255, 0.22)'
                                  : pressed
                                  ? isDark
                                    ? 'rgba(255, 255, 255, 0.03)'
                                    : 'rgba(16, 43, 85, 0.03)'
                                  : 'transparent',
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.notificationIconWell,
                                {
                                  backgroundColor: !item.read
                                    ? WattWiseTheme.colors.primaryFixed
                                    : colors.surfaceContainerLow,
                                },
                              ]}
                            >
                              <Icon
                                name={item.icon}
                                size={18}
                                color={
                                  !item.read
                                    ? WattWiseTheme.colors.primary
                                    : colors.textSecondary
                                }
                              />
                            </View>

                            <View style={styles.notificationContent}>
                              <View style={styles.titleRow}>
                                <Text
                                  style={[
                                    styles.notificationTitle,
                                    {
                                      color: colors.textPrimary,
                                      fontWeight: !item.read ? '700' : '600',
                                    },
                                  ]}
                                >
                                  {item.title}
                                </Text>
                                <Text style={[styles.timestamp, { color: colors.textMuted }]}>
                                  {item.timestamp}
                                </Text>
                              </View>

                              <Text
                                style={[
                                  styles.notificationBody,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                {item.body}
                              </Text>

                              {item.actionLabel && (
                                <View style={styles.actionRow}>
                                  <Text
                                    style={[
                                      styles.actionLabelText,
                                      { color: WattWiseTheme.colors.primary },
                                    ]}
                                  >
                                    {item.actionLabel}
                                  </Text>
                                  <Icon
                                    name="chevron_right"
                                    size={14}
                                    color={WattWiseTheme.colors.primary}
                                  />
                                </View>
                              )}
                            </View>
                          </Pressable>

                          {!isLast && (
                            <View
                              style={[
                                styles.rowDivider,
                                { backgroundColor: colors.borderSubtle },
                              ]}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              </SlideUpItem>
            )}
          </>
        )}

        {/* 6. Notification Settings Shortcut */}
        <SlideUpItem index={3}>
          <Pressable
            onPress={() => {
              setTab('profile');
              router.replace('/');
            }}
            style={({ pressed }) => [
              styles.settingsShortcutRow,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.borderSubtle,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Icon name="tune" size={16} color={WattWiseTheme.colors.primary} />
            <Text style={[styles.settingsShortcutText, { color: colors.textPrimary }]}>
              Customize Alert Schedules in Profile
            </Text>
            <Icon name="chevron_right" size={16} color={colors.textMuted} />
          </Pressable>
        </SlideUpItem>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  unreadBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  actionLink: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  actionLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
  },
  filterPillsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 2,
  },
  groupedCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  notificationIconWell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    fontSize: 14,
    flex: 1,
  },
  timestamp: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  notificationBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  actionLabelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
  emptyStateCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  emptyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 260,
  },
  settingsShortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  settingsShortcutText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 10,
  },
});

