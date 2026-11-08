import { SlideUpItem } from '@/components/animation/slide-up-item';
import { Icon } from '@/components/ui/icon';
import { WattWiseTheme } from '@/constants/theme';
import { useTab } from '@/context/tab-context';
import { useAppTheme } from '@/context/theme-context';
import { useBillingStore, ApplianceTelemetry } from '@/services/billing-store';
import { Image as ExpoImage } from 'expo-image';
import { useState, useEffect, useMemo } from 'react';
import { apiClient, MonthlyConsumptionItem } from '@/services/api-client';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type UtilityType = 'elec' | 'water' | 'wifi';
type PeriodType = 'month' | 'year';

export function HomeView() {
  const { colors, isDark } = useAppTheme();
  const { setTab } = useTab();
  const {
    isScheduleApplied,
    applyThermostatSchedule,
    statement,
    activeUtility,
    selectUtility,
    telemetry,
    monthlyHistory,
    appliances,
  } = useBillingStore();
  const [selectedUtility, setSelectedUtility] = useState<UtilityType>('elec');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('month');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(9);
  const [insightDismissed, setInsightDismissed] = useState(false);

  useEffect(() => {
    const revMap: Record<string, UtilityType> = {
      electricity: 'elec',
      water: 'water',
      wifi: 'wifi',
    };
    if (activeUtility && revMap[activeUtility] && revMap[activeUtility] !== selectedUtility) {
      setSelectedUtility(revMap[activeUtility]);
    }
  }, [activeUtility, selectedUtility]);

  const handleSelectUtility = (u: UtilityType) => {
    setSelectedUtility(u);
    const typeMap: Record<UtilityType, 'electricity' | 'water' | 'wifi'> = {
      elec: 'electricity',
      water: 'water',
      wifi: 'wifi',
    };
    selectUtility(typeMap[u]);
  };

  const currentChartData = useMemo(() => {
    if (monthlyHistory && monthlyHistory[selectedUtility]?.length) {
      return monthlyHistory[selectedUtility];
    }
    return [];
  }, [monthlyHistory, selectedUtility]);

  const gridLevels =
    selectedUtility === 'water'
      ? [30, 20, 15, 10]
      : [400, 300, 200, 100];

  const activeUtil = useMemo(() => {
    if (telemetry && telemetry[selectedUtility]) {
      const t = telemetry[selectedUtility];
      return {
        ...t,
        estBill: statement.amountDue || t.estBill,
        stat: statement.consumptionKwh ? `${statement.consumptionKwh}` : t.stat,
        dueDate: statement.dueDate ? `Due ${statement.dueDate} · Current Cycle` : t.dueDate,
      };
    }

    const consumption = statement?.consumptionKwh ?? 0;
    const days = Math.max(statement?.days || 30, 1);
    const amountNum = statement?.amountDueNumeric ?? 0;
    const isWater = selectedUtility === 'water';
    const isWifi = selectedUtility === 'wifi';
    const unit = isWater ? 'm³' : isWifi ? 'GB' : 'kWh';

    return {
      name: isWater ? 'Water' : isWifi ? 'Wi-Fi' : 'Electricity',
      unit,
      stat: `${consumption}`,
      trend: isWater ? 'Conserved' : isWifi ? 'Fiber Active' : 'Stable Rate',
      estBill: statement?.amountDue || '₱0.00',
      dueDate: statement?.dueDate ? `Due ${statement.dueDate} · Current Cycle` : 'Current Cycle',
      dailyAvg: (consumption / days).toFixed(1),
      dailyUnit: isWater ? 'm³/d' : isWifi ? 'GB/d' : 'kWh/d',
      dailyVs: 'Database Synced',
      forecast: `₱${Math.round(amountNum * 0.95).toLocaleString()}.00`,
      forecastSub: isWater ? 'Water conservation tier' : isWifi ? 'Broadband connection' : 'Household tariff',
      carbon: `${Math.round(consumption * 0.538)}`,
      carbonUnit: 'kg CO₂',
      carbonSub: 'Database Computed',
      cycleLabel: statement?.period || 'Current Cycle',
    };
  }, [telemetry, selectedUtility, statement]);

  const focusedMonth =
    currentChartData[selectedMonthIndex] ||
    currentChartData[currentChartData.length - 1] ||
    { month: 'Current', val2024: 0, val2023: 0, kwh: activeUtil.stat, bill: activeUtil.estBill };

  const handleApplySchedule = () => {
    applyThermostatSchedule();
    Alert.alert(
      'Schedule Activated ✓',
      'Living Room AC will hold 25°C between 1 PM – 4 PM. Estimated monthly savings: ~₱420.',
      [{ text: 'Great!' }]
    );
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Top Utility Segmented Selector */}
      <SlideUpItem index={0}>
        <View
          style={[
            styles.segmentedTrack,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#ECEFF3',
            },
          ]}
        >
          {/* Electricity */}
          <Pressable
            onPress={() => handleSelectUtility('elec')}
            style={[
              styles.segmentedButton,
              selectedUtility === 'elec' && [
                styles.segmentedButtonActive,
                {
                  backgroundColor: isDark ? WattWiseTheme.colors.primaryContainer : '#FFFFFF',
                },
              ],
            ]}
          >
            <ExpoImage
              source={require('../../assets/images/icons/electricity.svg')}
              style={styles.utilityIcon}
              tintColor={
                selectedUtility === 'elec'
                  ? isDark
                    ? '#FFFFFF'
                    : WattWiseTheme.colors.primary
                  : colors.textMuted
              }
              contentFit="contain"
            />
            <Text
              style={[
                styles.segmentedText,
                {
                  color:
                    selectedUtility === 'elec'
                      ? isDark
                        ? '#FFFFFF'
                        : WattWiseTheme.colors.primary
                      : colors.textMuted,
                  fontWeight: selectedUtility === 'elec' ? '600' : '500',
                },
              ]}
            >
              Electricity
            </Text>
          </Pressable>

          {/* Water */}
          <Pressable
            onPress={() => handleSelectUtility('water')}
            style={[
              styles.segmentedButton,
              selectedUtility === 'water' && [
                styles.segmentedButtonActive,
                {
                  backgroundColor: isDark ? WattWiseTheme.colors.primaryContainer : '#FFFFFF',
                },
              ],
            ]}
          >
            <ExpoImage
              source={require('../../assets/images/icons/water.svg')}
              style={styles.utilityIcon}
              tintColor={
                selectedUtility === 'water'
                  ? isDark
                    ? '#FFFFFF'
                    : WattWiseTheme.colors.primary
                  : colors.textMuted
              }
              contentFit="contain"
            />
            <Text
              style={[
                styles.segmentedText,
                {
                  color:
                    selectedUtility === 'water'
                      ? isDark
                        ? '#FFFFFF'
                        : WattWiseTheme.colors.primary
                      : colors.textMuted,
                  fontWeight: selectedUtility === 'water' ? '600' : '500',
                },
              ]}
            >
              Water
            </Text>
          </Pressable>

          {/* Wi-Fi */}
          <Pressable
            onPress={() => handleSelectUtility('wifi')}
            style={[
              styles.segmentedButton,
              selectedUtility === 'wifi' && [
                styles.segmentedButtonActive,
                {
                  backgroundColor: isDark ? WattWiseTheme.colors.primaryContainer : '#FFFFFF',
                },
              ],
            ]}
          >
            <ExpoImage
              source={require('../../assets/images/icons/wifi.svg')}
              style={styles.utilityIcon}
              tintColor={
                selectedUtility === 'wifi'
                  ? isDark
                    ? '#FFFFFF'
                    : WattWiseTheme.colors.primary
                  : colors.textMuted
              }
              contentFit="contain"
            />
            <Text
              style={[
                styles.segmentedText,
                {
                  color:
                    selectedUtility === 'wifi'
                      ? isDark
                        ? '#FFFFFF'
                        : WattWiseTheme.colors.primary
                      : colors.textMuted,
                  fontWeight: selectedUtility === 'wifi' ? '600' : '500',
                },
              ]}
            >
              Wi-Fi
            </Text>
          </Pressable>
        </View>
      </SlideUpItem>

      {/* 2. Hero Consumption & Chart Card */}
      <SlideUpItem index={1}>
        <View
          style={[
            styles.cardContainer,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          {/* Card Top: Stat & Period Selector */}
          <View style={styles.heroHeader}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
                Total {activeUtil.name.toLowerCase()} consumption
              </Text>
              <View style={styles.primaryStatRow}>
                <Text style={[styles.primaryStatValue, { color: colors.textPrimary }]}>
                  {activeUtil.stat}
                </Text>
                <Text style={[styles.primaryStatUnit, { color: colors.textSecondary }]}>
                  {activeUtil.unit}
                </Text>
                <Text style={[styles.trendLabel, { color: WattWiseTheme.colors.secondary }]}>
                  {activeUtil.trend}
                </Text>
              </View>
            </View>

            {/* Embedded Segmented Period Toggle */}
            <View
              style={[
                styles.periodToggleTrack,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F3F5',
                },
              ]}
            >
              {(['month', 'year'] as PeriodType[]).map((p) => {
                const active = selectedPeriod === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setSelectedPeriod(p)}
                    style={[
                      styles.periodToggleBtn,
                      active && [
                        styles.periodToggleBtnActive,
                        {
                          backgroundColor: isDark
                            ? WattWiseTheme.colors.primaryContainer
                            : '#FFFFFF',
                        },
                      ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodToggleText,
                        {
                          color: active
                            ? isDark
                              ? '#FFFFFF'
                              : WattWiseTheme.colors.primary
                            : colors.textMuted,
                          fontWeight: active ? '600' : '400',
                        },
                      ]}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Interactive Bar Chart */}
          <View style={styles.chartWrapper}>
            <View style={styles.chartGridLines}>
              {gridLevels.map((lvl) => (
                <View key={lvl} style={styles.gridLineRow}>
                  <Text style={[styles.gridLineLabel, { color: colors.textMuted }]}>
                    {lvl}
                  </Text>
                  <View
                    style={[
                      styles.gridLineRule,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F0F2F5' },
                    ]}
                  />
                </View>
              ))}
            </View>

            <View style={styles.barsContainer}>
              {currentChartData.map((item: MonthlyConsumptionItem, idx: number) => {
                const isSelected = selectedMonthIndex === idx;
                return (
                  <Pressable
                    key={item.month}
                    onPress={() => setSelectedMonthIndex(idx)}
                    style={styles.barTouchTarget}
                  >
                    <View style={styles.barGroup}>
                      <View
                        style={[
                          styles.singleBar,
                          {
                            height: `${item.val2024 * 0.9}%`,
                            backgroundColor: isSelected
                              ? WattWiseTheme.colors.primary
                              : isDark
                                ? '#3A557E'
                                : '#CBD5E1',
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.monthLabel,
                        {
                          color: isSelected
                            ? WattWiseTheme.colors.primary
                            : colors.textMuted,
                          fontWeight: isSelected ? '700' : '400',
                        },
                      ]}
                    >
                      {item.month}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Focused Cycle Banner */}
          <Pressable
            onPress={() => setTab('breakdown')}
            style={({ pressed }) => [
              styles.cycleBanner,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.04)'
                  : 'rgba(16, 43, 85, 0.03)',
                borderColor: colors.borderSubtle,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={styles.cycleBannerLeft}>
              <Icon name="calendar_today" size={15} color={WattWiseTheme.colors.primary} />
              <Text style={[styles.cycleTitle, { color: colors.textPrimary }]}>
                {focusedMonth.month} 2024 statement: {focusedMonth.bill}
              </Text>
            </View>
            <View style={styles.cycleBannerRight}>
              <Text style={[styles.cycleKwhLabel, { color: colors.textMuted }]}>
                {focusedMonth.kwh} {activeUtil.unit}
              </Text>
              <Icon name="chevron_right" size={14} color={WattWiseTheme.colors.primary} />
            </View>
          </Pressable>
        </View>
      </SlideUpItem>

      {/* 3. Executive Metrics Grid (Clean 2x2 with No Icon Circles or Badge Spam) */}
      <SlideUpItem index={2}>
        <View
          style={[
            styles.cardContainer,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.borderSubtle,
              padding: 0,
            },
          ]}
        >
          <View style={styles.metricRow}>
            {/* Cell 1: Estimated Bill */}
            <Pressable
              onPress={() => setTab('breakdown')}
              style={[
                styles.metricCell,
                {
                  borderRightWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <Text style={[styles.metricCellLabel, { color: colors.textMuted }]}>
                Estimated bill
              </Text>
              <Text style={[styles.metricCellValue, { color: colors.textPrimary }]}>
                {activeUtil.estBill}
              </Text>
              <Text style={[styles.metricCellSub, { color: colors.textSecondary }]}>
                {activeUtil.dueDate}
              </Text>
            </Pressable>

            {/* Cell 2: Daily Average */}
            <View
              style={[
                styles.metricCell,
                {
                  borderBottomWidth: 1,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <Text style={[styles.metricCellLabel, { color: colors.textMuted }]}>
                Daily average
              </Text>
              <View style={styles.metricValUnitRow}>
                <Text style={[styles.metricCellValue, { color: colors.textPrimary }]}>
                  {activeUtil.dailyAvg}
                </Text>
                <Text style={[styles.metricCellUnit, { color: colors.textSecondary }]}>
                  {activeUtil.dailyUnit}
                </Text>
              </View>
              <Text style={[styles.metricCellSub, { color: WattWiseTheme.colors.secondary }]}>
                {activeUtil.dailyVs}
              </Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            {/* Cell 3: Projected Bill */}
            <View
              style={[
                styles.metricCell,
                {
                  borderRightWidth: 1,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <Text style={[styles.metricCellLabel, { color: colors.textMuted }]}>
                Projected total
              </Text>
              <Text style={[styles.metricCellValue, { color: colors.textPrimary }]}>
                {activeUtil.forecast}
              </Text>
              <Text style={[styles.metricCellSub, { color: colors.textSecondary }]}>
                {activeUtil.forecastSub}
              </Text>
            </View>

            {/* Cell 4: Carbon Footprint */}
            <View style={styles.metricCell}>
              <Text style={[styles.metricCellLabel, { color: colors.textMuted }]}>
                Carbon footprint
              </Text>
              <View style={styles.metricValUnitRow}>
                <Text style={[styles.metricCellValue, { color: colors.textPrimary }]}>
                  {activeUtil.carbon}
                </Text>
                <Text style={[styles.metricCellUnit, { color: colors.textSecondary }]}>
                  {activeUtil.carbonUnit}
                </Text>
              </View>
              <Text style={[styles.metricCellSub, { color: colors.textSecondary }]}>
                {activeUtil.carbonSub}
              </Text>
            </View>
          </View>
        </View>
      </SlideUpItem>

      {/* 4. Actionable Recommendation Card */}
      {!insightDismissed && (
        <SlideUpItem index={3}>
          <View
            style={[
              styles.cardContainer,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            <View style={styles.recommendationHeader}>
              <View style={styles.recommendationTitleRow}>
                <Icon name="bolt" size={17} color={WattWiseTheme.colors.primary} />
                <Text style={[styles.recommendationTitle, { color: colors.textPrimary }]}>
                  AI Appliance Breakdown
                </Text>
              </View>
              <Text style={[styles.recommendationSavings, { color: WattWiseTheme.colors.secondary }]}>
                Save ~₱520
              </Text>
            </View>

            <Text style={[styles.recommendationBody, { color: colors.textSecondary }]}>
              Living Room AC accounts for 42% (₱1,724) of monthly draw. Setting target to 25°C lowers bill by ~₱520/month.
            </Text>

            <View style={styles.recommendationActions}>
              <Pressable
                onPress={handleApplySchedule}
                style={[
                  styles.primaryActionButton,
                  {
                    backgroundColor: WattWiseTheme.colors.primary,
                  },
                ]}
              >
                <Text style={styles.primaryActionText}>
                  {isScheduleApplied ? 'Schedule active ✓' : 'Apply 25°C schedule'}
                </Text>
              </Pressable>

              <Pressable onPress={() => setInsightDismissed(true)} hitSlop={10}>
                <Text style={[styles.dismissActionText, { color: colors.textMuted }]}>
                  Dismiss
                </Text>
              </Pressable>
            </View>
          </View>
        </SlideUpItem>
      )}

      {/* 5. Live Appliance Monitor */}
      <SlideUpItem index={4}>
        <View
          style={[
            styles.cardContainer,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          <View style={styles.applianceHeader}>
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
              Live appliance load
            </Text>
            <Text style={[styles.totalWattsText, { color: WattWiseTheme.colors.primary }]}>
              {appliances.length > 0
                ? `${appliances.reduce((acc: number, a: ApplianceTelemetry) => acc + (a.kwhNumeric || 0), 0)} kWh / mo`
                : 'Active Telemetry'}
            </Text>
          </View>

          <View style={styles.applianceList}>
            {appliances.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 13, paddingVertical: 12 }}>
                No appliance telemetry records found.
              </Text>
            ) : (
              appliances.map((app: ApplianceTelemetry) => (
                <View
                  key={app.id}
                  style={[
                    styles.applianceItem,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8F9FB',
                    },
                  ]}
                >
                  <View style={styles.applianceLeft}>
                    <Icon name={app.icon as any || 'bolt'} size={18} color={WattWiseTheme.colors.primary} />
                    <View>
                      <Text style={[styles.applianceTitleText, { color: colors.textPrimary }]}>
                        {app.name}
                      </Text>
                      <Text style={[styles.applianceSubText, { color: app.percentage > 30 ? WattWiseTheme.colors.error : colors.textMuted }]}>
                        {app.meta || `${app.percentage}% of bill`}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.applianceWattsValue, { color: colors.textPrimary }]}>
                    {app.monthlyCost}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </SlideUpItem>

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  segmentedTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 14,
  },
  segmentedButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentedButtonActive: {
    ...Platform.select({
      ios: {
        shadowColor: '#102B55',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 3px rgba(16, 43, 85, 0.08)',
      },
    }),
  },
  segmentedText: {
    fontSize: 13,
  },
  utilityIcon: {
    width: 16,
    height: 16,
  },
  cardContainer: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  primaryStatRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
  },
  primaryStatValue: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  primaryStatUnit: {
    fontSize: 14,
    fontWeight: '500',
  },
  trendLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  periodToggleTrack: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 8,
  },
  periodToggleBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  periodToggleBtnActive: {
    ...Platform.select({
      ios: {
        shadowColor: '#102B55',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 2px rgba(16, 43, 85, 0.06)',
      },
    }),
  },
  periodToggleText: {
    fontSize: 11,
  },
  chartWrapper: {
    height: 140,
    position: 'relative',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  chartGridLines: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 22,
    justifyContent: 'space-between',
  },
  gridLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gridLineLabel: {
    fontSize: 10,
    width: 24,
    textAlign: 'right',
  },
  gridLineRule: {
    flex: 1,
    height: 1,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: 32,
    height: 120,
  },
  barTouchTarget: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    gap: 6,
  },
  barGroup: {
    height: 90,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  singleBar: {
    width: 9,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  monthLabel: {
    fontSize: 10,
  },
  cycleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 2,
  },
  cycleBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cycleTitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  cycleBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cycleKwhLabel: {
    fontSize: 12,
  },
  metricRow: {
    flexDirection: 'row',
  },
  metricCell: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  metricCellLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  metricCellValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  metricValUnitRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricCellUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
  metricCellSub: {
    fontSize: 11,
    marginTop: 3,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  recommendationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recommendationTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  recommendationSavings: {
    fontSize: 12,
    fontWeight: '700',
  },
  recommendationBody: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  recommendationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryActionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissActionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  totalWattsText: {
    fontSize: 13,
    fontWeight: '700',
  },
  applianceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  applianceList: {
    gap: 8,
  },
  applianceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  applianceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  applianceTitleText: {
    fontSize: 13,
    fontWeight: '500',
  },
  applianceSubText: {
    fontSize: 11,
    marginTop: 1,
  },
  applianceWattsValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});
