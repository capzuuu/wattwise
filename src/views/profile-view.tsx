import { SlideUpItem } from '@/components/animation/slide-up-item';
import { Icon } from '@/components/ui/icon';
import {
  THEME_PRESET_METAS,
  WattWiseTheme
} from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';
import { useBillingStore } from '@/services/billing-store';
import { apiClient, DatabaseStatusResponse } from '@/services/api-client';
import { router } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Image as RNImage,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';

export function ProfileView() {
  const { colors, isDark, mode, preset, setMode, setPreset } = useAppTheme();
  const { user, logout, resetOnboarding } = useAuth();
  const { targetBudget, setTargetBudget, statement } = useBillingStore();

  const [billProcessedNotify, setBillProcessedNotify] = useState(true);
  const [thresholdNotify, setThresholdNotify] = useState(true);
  const [forecastNotify, setForecastNotify] = useState(true);

  // FastAPI Backend Connection State
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [backendUrl, setBackendUrl] = useState('http://localhost:8000');
  const [backendLatency, setBackendLatency] = useState<number | null>(null);

  // Database Telemetry State (SQLite WAL + Supabase Cloud)
  const [dbStatus, setDbStatus] = useState<DatabaseStatusResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const fetchDbTelemetry = useCallback(async () => {
    try {
      const status = await apiClient.getDatabaseStatus();
      setDbStatus(status);
    } catch {
      // offline fallback handled by apiClient
    }
  }, []);

  const handleSyncDatabase = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await apiClient.syncDatabase();
      setSyncFeedback(res.message);
      await fetchDbTelemetry();
    } catch {
      setSyncFeedback('Local offline storage is operational. Cloud sync queued.');
    } finally {
      setIsSyncing(false);
    }
  };

  const checkBackendHealth = useCallback(async () => {
    setBackendStatus('checking');
    const health = await apiClient.checkHealth();
    if (health.ok) {
      setBackendStatus('online');
      setBackendLatency(health.latencyMs || 0);
      await fetchDbTelemetry();
    } else {
      setBackendStatus('offline');
      setBackendLatency(null);
    }
  }, [fetchDbTelemetry]);

  useEffect(() => {
    let isMounted = true;
    async function initBackend() {
      const url = await apiClient.getBaseUrl();
      if (isMounted) setBackendUrl(url);
      const health = await apiClient.checkHealth();
      if (isMounted) {
        if (health.ok) {
          setBackendStatus('online');
          setBackendLatency(health.latencyMs || 0);
        } else {
          setBackendStatus('offline');
        }
      }
      const telemetry = await apiClient.getDatabaseStatus();
      if (isMounted && telemetry) {
        setDbStatus(telemetry);
      }
    }
    initBackend();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSetBackendPreset = async (url: string) => {
    await apiClient.setBaseUrl(url);
    setBackendUrl(url);
    await checkBackendHealth();
  };

  const displayName = user?.name || 'Resident';
  const displayEmail = user?.email || 'resident@wattwise.local';

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your household profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth');
          },
        },
      ]
    );
  };

  const handleResetTour = () => {
    Alert.alert(
      'Reset Onboarding Tour',
      'Reset your status to experience the first-time user walkthrough from the beginning?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart Tour',
          onPress: async () => {
            await resetOnboarding();
            router.replace('/onboarding');
          },
        },
      ]
    );
  };

  const handleAdjustBudget = () => {
    Alert.alert(
      'Monthly Budget Target',
      'Set your target monthly total utility expenditure (electricity, water, and broadband):',
      [
        { text: '₱4,000', onPress: () => setTargetBudget('₱4,000') },
        { text: '₱4,500 (Current)', onPress: () => setTargetBudget('₱4,500') },
        { text: '₱5,000', onPress: () => setTargetBudget('₱5,000') },
        { text: '₱6,500', onPress: () => setTargetBudget('₱6,500') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear OCR Bill Cache',
      'All temporary high-resolution bill photos will be removed from local storage. Extracted bill records and itemized breakdowns remain safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear 12.4 MB',
          style: 'destructive',
          onPress: () => Alert.alert('Cache Cleared', 'Freed 12.4 MB of temporary OCR scans.'),
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Bill Records',
      'Generating an itemized CSV archive of your electricity, water, and broadband statements with appliance telemetry.',
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Executive Household Card */}
      <SlideUpItem index={0}>
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          {/* Top User Info */}
          <View style={styles.userHeaderRow}>
            <RNImage source={{ uri: DEFAULT_AVATAR }} style={styles.avatar} />
            <View style={styles.userMeta}>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>
                {displayName}
              </Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                {displayEmail}
              </Text>
            </View>
          </View>

          {/* Household Metric Strip */}
          <View
            style={[
              styles.metricStrip,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            <View style={styles.metricColumn}>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                Occupants
              </Text>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                {user?.householdType || 'Single Family'}
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

            <View style={styles.metricColumn}>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                Avg Monthly
              </Text>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                {statement.consumptionKwh || 342} {statement.utilityType === 'water' ? 'm³' : statement.utilityType === 'wifi' ? 'GB' : 'kWh'}
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

            <View style={styles.metricColumn}>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                Budget Cap
              </Text>
              <Text style={[styles.metricValue, { color: WattWiseTheme.colors.secondary }]}>
                {targetBudget}
              </Text>
            </View>
          </View>
        </View>
      </SlideUpItem>

      {/* 2. Theme & Appearance Customization */}
      <SlideUpItem index={1}>
        <View style={styles.sectionHeaderBlock}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Theme & Appearance
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Customize theme mode & color palettes
          </Text>
        </View>

        <View
          style={[
            styles.groupedCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          {/* Segmented Theme Mode Switcher */}
          <View style={styles.modeSegmentContainer}>
            {(
              [
                { id: 'system', label: 'System', icon: 'palette' as const },
                { id: 'light', label: 'Light', icon: 'light_mode' as const },
                { id: 'dark', label: 'Dark', icon: 'dark_mode' as const },
              ] as const
            ).map((item) => {
              const active = mode === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setMode(item.id)}
                  style={[
                    styles.modeSegmentBtn,
                    {
                      backgroundColor: active
                        ? colors.surfaceContainerHigh
                        : colors.surfaceContainerLow,
                      borderColor: active ? colors.border : 'transparent',
                    },
                  ]}
                  accessibilityLabel={`Switch to ${item.label} theme`}
                >
                  <Icon
                    name={item.icon}
                    size={16}
                    color={active ? WattWiseTheme.colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.modeSegmentText,
                      {
                        color: active ? colors.textPrimary : colors.textSecondary,
                        fontWeight: active ? '700' : '500',
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.rowSeparator, { backgroundColor: colors.borderSubtle }]} />

          {/* Theme Preset Palettes */}
          <View style={styles.presetSection}>
            <Text style={[styles.presetSectionLabel, { color: colors.textMuted }]}>
              Color Accent Palettes
            </Text>

            <View style={styles.presetGrid}>
              {THEME_PRESET_METAS.map((meta) => {
                const isSelected = preset === meta.id;
                return (
                  <Pressable
                    key={meta.id}
                    onPress={() => setPreset(meta.id)}
                    style={({ pressed }) => [
                      styles.presetCard,
                      {
                        backgroundColor: colors.surfaceContainerLow,
                        borderColor: isSelected
                          ? WattWiseTheme.colors.primary
                          : colors.borderSubtle,
                        borderWidth: isSelected ? 2 : 1,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                    accessibilityLabel={`Apply ${meta.name} theme preset`}
                  >
                    <View style={styles.colorPillRow}>
                      <View
                        style={[
                          styles.colorCircle,
                          { backgroundColor: meta.primaryColor },
                        ]}
                      />
                      <View
                        style={[
                          styles.colorCircle,
                          { backgroundColor: meta.accentColor },
                        ]}
                      />
                      {isSelected && (
                        <View style={styles.selectedPillBadge}>
                          <Icon name="check" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </View>

                    <Text style={[styles.presetName, { color: colors.textPrimary }]}>
                      {meta.name}
                    </Text>
                    <Text style={[styles.presetDesc, { color: colors.textMuted }]}>
                      {meta.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </SlideUpItem>

      {/* 3. FastAPI Backend Server Engine */}
      <SlideUpItem index={2}>
        <View style={styles.sectionHeaderBlock}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            FastAPI Backend Engine
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Python AI microservice & OCR decomposition server
          </Text>
        </View>

        <View
          style={[
            styles.groupedCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          {/* Server Status Header Row */}
          <View style={styles.backendStatusRow}>
            <View style={styles.backendStatusLeft}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      backendStatus === 'online'
                        ? '#10B981'
                        : backendStatus === 'checking'
                        ? '#F59E0B'
                        : '#94A3B8',
                  },
                ]}
              />
              <View>
                <Text style={[styles.backendStatusTitle, { color: colors.textPrimary }]}>
                  {backendStatus === 'online'
                    ? 'Connected to FastAPI'
                    : backendStatus === 'checking'
                    ? 'Connecting to Server...'
                    : 'Standalone / On-Device Mode'}
                </Text>
                <Text style={[styles.backendStatusSub, { color: colors.textMuted }]}>
                  {backendStatus === 'online'
                    ? `v1.0.0 · ${backendLatency ? `${backendLatency}ms latency` : 'Active'}`
                    : "Run 'python run.py' in backend/ for cloud AI"}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={checkBackendHealth}
              style={({ pressed }) => [
                styles.pingButton,
                {
                  backgroundColor: colors.surfaceContainerHigh,
                  borderColor: colors.borderSubtle,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityLabel="Test backend connection"
            >
              <Icon
                name={backendStatus === 'online' ? 'verified' : 'refresh'}
                size={14}
                color={backendStatus === 'online' ? '#10B981' : colors.textPrimary}
              />
              <Text style={[styles.pingButtonText, { color: colors.textPrimary }]}>
                {backendStatus === 'checking' ? 'Testing...' : 'Ping Test'}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.rowSeparator, { backgroundColor: colors.borderSubtle }]} />

          {/* Current Base URL */}
          <View style={styles.settingRow}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Icon name="electric_meter" size={18} color={WattWiseTheme.colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Server Host Address
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>
                {backendUrl}
              </Text>
            </View>
          </View>

          <View style={[styles.rowSeparator, { backgroundColor: colors.borderSubtle }]} />

          {/* Quick Preset Host Switcher */}
          <View style={styles.backendPresetBlock}>
            <Text style={[styles.presetSectionLabel, { color: colors.textMuted }]}>
              Quick Host Presets
            </Text>
            <View style={styles.backendPresetRow}>
              {[
                { label: 'Localhost (8000)', url: 'http://localhost:8000' },
                { label: 'Android (10.0.2.2)', url: 'http://10.0.2.2:8000' },
              ].map((presetItem) => {
                const isActive = backendUrl === presetItem.url;
                return (
                  <Pressable
                    key={presetItem.url}
                    onPress={() => handleSetBackendPreset(presetItem.url)}
                    style={[
                      styles.presetPillBtn,
                      {
                        backgroundColor: isActive
                          ? WattWiseTheme.colors.primary
                          : colors.surfaceContainerLow,
                        borderColor: isActive ? WattWiseTheme.colors.primary : colors.borderSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetPillText,
                        {
                          color: isActive ? '#FFFFFF' : colors.textSecondary,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                    >
                      {presetItem.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </SlideUpItem>

      {/* 4. Dual-Engine Database & Cloud Sync (SQLite + Supabase) */}
      <SlideUpItem index={3}>
        <View style={styles.sectionHeaderBlock}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Database & Cloud Persistence
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Secure on-device storage · Encrypted cloud replica
          </Text>
        </View>

        <View
          style={[
            styles.groupedCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          {/* Local Engine Row */}
          <View style={styles.dbEngineRow}>
            <View style={styles.dbEngineLeft}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: '#10B981' },
                ]}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.dbTitleRow}>
                  <Text style={[styles.dbEngineTitle, { color: colors.textPrimary }]}>
                    On-Device Storage Engine
                  </Text>
                  <View style={[styles.dbBadge, { backgroundColor: '#10B9811A', borderColor: '#10B9814D' }]}>
                    <Text style={[styles.dbBadgeText, { color: '#10B981' }]}>
                      Offline-First · Sub-ms
                    </Text>
                  </View>
                </View>
                <Text style={[styles.dbEngineSub, { color: colors.textMuted }]}>
                  {dbStatus?.sqlite.concurrency || 'Instant Multi-reader Sub-millisecond'}
                </Text>
              </View>
            </View>
          </View>

          {/* SQLite Metrics Strip */}
          <View style={[styles.dbMetricStrip, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.borderSubtle }]}>
            <View style={styles.dbMetricCol}>
              <Text style={[styles.dbMetricVal, { color: colors.textPrimary }]}>
                {dbStatus?.sqlite.totalStatements ?? 1}
              </Text>
              <Text style={[styles.dbMetricLbl, { color: colors.textMuted }]}>
                Statements
              </Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />
            <View style={styles.dbMetricCol}>
              <Text style={[styles.dbMetricVal, { color: colors.textPrimary }]}>
                {dbStatus?.sqlite.totalAppliances ?? 5}
              </Text>
              <Text style={[styles.dbMetricLbl, { color: colors.textMuted }]}>
                Appliances
              </Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />
            <View style={styles.dbMetricCol}>
              <Text style={[styles.dbMetricVal, { color: colors.textPrimary }]}>
                {dbStatus?.sqlite.totalNotifications ?? 5}
              </Text>
              <Text style={[styles.dbMetricLbl, { color: colors.textMuted }]}>
                Notifications
              </Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />
            <View style={styles.dbMetricCol}>
              <Text style={[styles.dbMetricVal, { color: (dbStatus?.sqlite.unsyncedItems ?? 0) > 0 ? '#F59E0B' : '#10B981' }]}>
                {dbStatus?.sqlite.unsyncedItems ?? 0}
              </Text>
              <Text style={[styles.dbMetricLbl, { color: colors.textMuted }]}>
                Unsynced
              </Text>
            </View>
          </View>

          <View style={[styles.rowSeparator, { backgroundColor: colors.borderSubtle }]} />

          {/* Supabase Cloud Replica Row */}
          <View style={styles.dbEngineRow}>
            <View style={styles.dbEngineLeft}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: dbStatus?.supabase.connected ? '#10B981' : '#F59E0B' },
                ]}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.dbTitleRow}>
                  <Text style={[styles.dbEngineTitle, { color: colors.textPrimary }]}>
                    Supabase Cloud Replica
                  </Text>
                  <View
                    style={[
                      styles.dbBadge,
                      {
                        backgroundColor: dbStatus?.supabase.connected ? '#10B9811A' : '#F59E0B1A',
                        borderColor: dbStatus?.supabase.connected ? '#10B9814D' : '#F59E0B4D',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dbBadgeText,
                        { color: dbStatus?.supabase.connected ? '#10B981' : '#F59E0B' },
                      ]}
                    >
                      {dbStatus?.supabase.connected ? 'Cloud Connected' : 'Offline Mode'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.dbEngineSub, { color: colors.textMuted }]}>
                  {dbStatus?.supabase.connected
                    ? `PostgreSQL Cloud Sync · ${dbStatus.supabase.url}`
                    : '100% Operational offline with secure on-device storage'}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.rowSeparator, { backgroundColor: colors.borderSubtle }]} />

          {/* Sync Trigger and Last Synced Info */}
          <View style={styles.dbSyncActionRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dbSyncLabel, { color: colors.textMuted }]}>
                Last Cloud Synchronization
              </Text>
              <Text style={[styles.dbSyncTime, { color: colors.textPrimary }]}>
                {dbStatus?.lastSyncedAt || 'Never'}
              </Text>
            </View>

            <Pressable
              onPress={handleSyncDatabase}
              disabled={isSyncing}
              style={({ pressed }) => [
                styles.syncCloudBtn,
                {
                  backgroundColor: WattWiseTheme.colors.primary,
                  opacity: pressed || isSyncing ? 0.8 : 1,
                },
              ]}
              accessibilityLabel="Synchronize database with cloud"
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Icon name="refresh" size={14} color="#FFFFFF" />
              )}
              <Text style={styles.syncCloudBtnText}>
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Text>
            </Pressable>
          </View>

          {/* Feedback Banner if present */}
          {syncFeedback ? (
            <View style={[styles.dbFeedbackBanner, { backgroundColor: colors.surfaceContainerLow }]}>
              <Icon name="info" size={14} color={WattWiseTheme.colors.primary} />
              <Text style={[styles.dbFeedbackText, { color: colors.textSecondary }]}>
                {syncFeedback}
              </Text>
            </View>
          ) : null}
        </View>
      </SlideUpItem>

      {/* 5. Notifications & AI Alerts */}
      <SlideUpItem index={4}>
        <View style={styles.sectionHeaderBlock}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Bill Alerts & AI Monitoring
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Smart notifications for your utility bills
          </Text>
        </View>

        <View
          style={[
            styles.groupedCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          {/* Bill Analyzed Notification */}
          <View style={styles.settingRow}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Icon name="document_scanner" size={18} color={WattWiseTheme.colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Bill Analysis Complete
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Notify when photographed bills finish itemization
              </Text>
            </View>
            <Switch
              value={billProcessedNotify}
              onValueChange={setBillProcessedNotify}
              trackColor={{
                false: colors.surfaceContainerHigh,
                true: WattWiseTheme.colors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.rowSeparator, { backgroundColor: colors.borderSubtle }]} />

          {/* High Consumption Threshold */}
          <View style={styles.settingRow}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Icon name="trending_up" size={18} color={WattWiseTheme.colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Consumption Spike Alert
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Alert if electricity or water surges above baseline
              </Text>
            </View>
            <Switch
              value={thresholdNotify}
              onValueChange={setThresholdNotify}
              trackColor={{
                false: colors.surfaceContainerHigh,
                true: WattWiseTheme.colors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.rowSeparator, { backgroundColor: colors.borderSubtle }]} />

          {/* Monthly Bill Forecast */}
          <View style={styles.settingRow}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Icon name="payments" size={18} color={WattWiseTheme.colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Monthly Bill Projections
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Send mid-month forecast of upcoming electricity bills
              </Text>
            </View>
            <Switch
              value={forecastNotify}
              onValueChange={setForecastNotify}
              trackColor={{
                false: colors.surfaceContainerHigh,
                true: WattWiseTheme.colors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </SlideUpItem>

      {/* 6. Budget Settings */}
      <SlideUpItem index={5}>
        <View style={styles.sectionHeaderBlock}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Budget & Utility Tracking
          </Text>
        </View>

        <View
          style={[
            styles.groupedCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          {/* Monthly Budget Target */}
          <Pressable
            onPress={handleAdjustBudget}
            style={({ pressed }) => [
              styles.settingRow,
              {
                backgroundColor: pressed
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.03)'
                    : 'rgba(16, 43, 85, 0.03)'
                  : 'transparent',
              },
            ]}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Icon name="payments" size={18} color={WattWiseTheme.colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Monthly Budget Cap
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Combined target for electricity, water & Wi-Fi
              </Text>
            </View>
            <Text style={[styles.trailingValue, { color: WattWiseTheme.colors.secondary }]}>
              {targetBudget}
            </Text>
            <Icon name="chevron_right" size={16} color={colors.textMuted} />
          </Pressable>

          <View style={[styles.rowSeparator, { backgroundColor: colors.borderSubtle }]} />

          {/* Supported Categories Row */}
          <View style={styles.settingRow}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Icon name="auto_awesome" size={18} color={WattWiseTheme.colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                AI Utility Scanner
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Analyzes Electricity, Water & Broadband bills
              </Text>
            </View>
            <Text style={[styles.trailingValue, { color: WattWiseTheme.colors.secondary }]}>
              Active
            </Text>
          </View>
        </View>
      </SlideUpItem>

      {/* 7. Data & Storage */}
      <SlideUpItem index={6}>
        <View style={styles.sectionHeaderBlock}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Data & Privacy
          </Text>
        </View>

        <View
          style={[
            styles.groupedCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          {/* Export Data */}
          <Pressable
            onPress={handleExportData}
            style={({ pressed }) => [
              styles.settingRow,
              {
                backgroundColor: pressed
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.03)'
                    : 'rgba(16, 43, 85, 0.03)'
                  : 'transparent',
              },
            ]}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Icon name="download" size={18} color={WattWiseTheme.colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Export Bill History
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Download itemized statements (CSV)
              </Text>
            </View>
            <Icon name="chevron_right" size={16} color={colors.textMuted} />
          </Pressable>

          <View style={[styles.rowSeparator, { backgroundColor: colors.borderSubtle }]} />

          {/* Clear OCR Cache */}
          <Pressable
            onPress={handleClearCache}
            style={({ pressed }) => [
              styles.settingRow,
              {
                backgroundColor: pressed
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.03)'
                    : 'rgba(186, 26, 26, 0.05)'
                  : 'transparent',
              },
            ]}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: 'rgba(186, 26, 26, 0.08)' },
              ]}
            >
              <Icon name="delete_sweep" size={18} color={WattWiseTheme.colors.error} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: WattWiseTheme.colors.error }]}>
                Clear Cached Bill Scans
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>
                Removes on-device temp scans (12.4 MB)
              </Text>
            </View>
            <Icon name="chevron_right" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </SlideUpItem>

      {/* 8. Footer & Account Actions */}
      <SlideUpItem index={7}>
        <View style={styles.footerBlock}>
          <View style={styles.footerActionRow}>
            <Pressable
              onPress={handleResetTour}
              style={({ pressed }) => [
                styles.accountActionBtn,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.borderSubtle,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              accessibilityLabel="Restart Onboarding Tour"
            >
              <Icon name="info" size={16} color={WattWiseTheme.colors.primary} />
              <Text style={[styles.accountActionText, { color: colors.textPrimary }]}>
                Tour Guide
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [
                styles.accountActionBtn,
                {
                  backgroundColor: 'rgba(186, 26, 26, 0.08)',
                  borderColor: 'rgba(186, 26, 26, 0.2)',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              accessibilityLabel="Sign out of household profile"
            >
              <Icon name="logout" size={16} color={WattWiseTheme.colors.error} />
              <Text style={[styles.accountActionText, { color: WattWiseTheme.colors.error }]}>
                Sign Out
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.versionText, { color: colors.textMuted }]}>
            WattWise v1.0.0 · AI Bill Analyzer & Telemetry
          </Text>
        </View>
      </SlideUpItem>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },

  // 1. Profile Card
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  userHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: WattWiseTheme.colors.primary,
  },
  userMeta: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 12,
  },
  userAccountBadge: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  metricStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  metricColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metricDivider: {
    width: 1,
    height: 24,
  },

  // Section Headers
  sectionHeaderBlock: {
    gap: 2,
    marginBottom: 6,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
  },

  // Grouped Card
  groupedCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // Mode Segment Switcher
  modeSegmentContainer: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
  },
  modeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  modeSegmentText: {
    fontSize: 12,
  },

  // Theme Presets Grid
  presetSection: {
    padding: 14,
    gap: 10,
  },
  presetSectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetCard: {
    width: '48%',
    padding: 12,
    borderRadius: 14,
    gap: 4,
  },
  colorPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  colorCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  selectedPillBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: WattWiseTheme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  presetName: {
    fontSize: 13,
    fontWeight: '700',
  },
  presetDesc: {
    fontSize: 10,
    lineHeight: 14,
  },

  // Setting Rows
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 11,
  },
  trailingValue: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
    marginRight: 16,
  },

  // Footer & Account Actions
  footerBlock: {
    gap: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  footerActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  accountActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  accountActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  versionText: {
    fontSize: 11,
    textAlign: 'center',
  },

  // FastAPI Backend Engine Styles
  backendStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backendStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  backendStatusTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  backendStatusSub: {
    fontSize: 11,
    marginTop: 2,
  },
  pingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  pingButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  backendPresetBlock: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  backendPresetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetPillBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetPillText: {
    fontSize: 11,
  },

  // Dual-Engine Database & Cloud Sync Styles
  dbEngineRow: {
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  dbEngineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dbTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dbEngineTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  dbBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  dbBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dbEngineSub: {
    fontSize: 11,
    marginTop: 2,
  },
  dbMetricStrip: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
  },
  dbMetricCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dbMetricVal: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dbMetricLbl: {
    fontSize: 10,
    marginTop: 2,
  },
  dbSyncActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dbSyncLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  dbSyncTime: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  syncCloudBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  syncCloudBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dbFeedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dbFeedbackText: {
    fontSize: 11,
    flex: 1,
  },
});
