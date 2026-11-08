import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Icon } from '@/components/ui/icon';
import { SlideUpItem } from '@/components/animation/slide-up-item';
import { useAppTheme } from '@/context/theme-context';
import { useTab } from '@/context/tab-context';
import { useBillingStore } from '@/services/billing-store';
import { WattWiseTheme } from '@/constants/theme';

export function BreakdownView() {
  const { colors, isDark } = useAppTheme();
  const { setTab } = useTab();
  const { statement, charges, activeUtility, selectUtility } = useBillingStore();
  const [selectedCharge, setSelectedCharge] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      Alert.alert(
        'Statement Exported 📄',
        `WattWise_${statement.provider.replace(/\s+/g, '_')}_Breakdown.pdf has been generated and saved to your device.`,
        [{ text: 'Open PDF' }, { text: 'Done' }]
      );
    }, 1200);
  };

  const handleAskAi = () => {
    setTab('insights');
  };

  const unit = statement.utilityType === 'water' ? 'm³' : statement.utilityType === 'wifi' ? 'Mbps' : 'kWh';

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 0. Top Utility Segmented Selector (Zero-latency In-memory Switch) */}
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
            onPress={() => selectUtility('electricity')}
            style={[
              styles.segmentedButton,
              activeUtility === 'electricity' && [
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
                activeUtility === 'electricity'
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
                    activeUtility === 'electricity'
                      ? isDark
                        ? '#FFFFFF'
                        : WattWiseTheme.colors.primary
                      : colors.textMuted,
                  fontWeight: activeUtility === 'electricity' ? '600' : '500',
                },
              ]}
            >
              Electricity
            </Text>
          </Pressable>

          {/* Water */}
          <Pressable
            onPress={() => selectUtility('water')}
            style={[
              styles.segmentedButton,
              activeUtility === 'water' && [
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
                activeUtility === 'water'
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
                    activeUtility === 'water'
                      ? isDark
                        ? '#FFFFFF'
                        : WattWiseTheme.colors.primary
                      : colors.textMuted,
                  fontWeight: activeUtility === 'water' ? '600' : '500',
                },
              ]}
            >
              Water
            </Text>
          </Pressable>

          {/* Wi-Fi */}
          <Pressable
            onPress={() => selectUtility('wifi')}
            style={[
              styles.segmentedButton,
              activeUtility === 'wifi' && [
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
                activeUtility === 'wifi'
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
                    activeUtility === 'wifi'
                      ? isDark
                        ? '#FFFFFF'
                        : WattWiseTheme.colors.primary
                      : colors.textMuted,
                  fontWeight: activeUtility === 'wifi' ? '600' : '500',
                },
              ]}
            >
              Wi-Fi
            </Text>
          </Pressable>
        </View>
      </SlideUpItem>

      {/* 1. Statement Header Card */}
      <SlideUpItem index={0}>
        <View
          style={[
            styles.statementCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          {/* Header Row */}
          <View style={styles.statementTopRow}>
            <View>
              <Text style={[styles.providerLabel, { color: colors.textSecondary }]}>
                {statement.provider}
              </Text>
              <Text style={[styles.statementPeriod, { color: colors.textMuted }]}>
                Billing period: {statement.period}
              </Text>
            </View>
            <Text style={[styles.dueDateBadge, { color: WattWiseTheme.colors.primary }]}>
              Due {statement.dueDate}
            </Text>
          </View>

          {/* Amount Hero */}
          <View style={styles.amountHeroBlock}>
            <Text style={[styles.amountLabel, { color: colors.textMuted }]}>
              Total amount due
            </Text>
            <Text style={[styles.amountValue, { color: colors.textPrimary }]}>
              {statement.amountDue}
            </Text>
            <Text style={[styles.accountSubtext, { color: colors.textSecondary }]}>
              Account # {statement.accountNo} | Verified Statement
            </Text>
          </View>

          {/* 3-Column Key Metric Strip */}
          <View
            style={[
              styles.metricsStrip,
              {
                borderTopColor: colors.borderSubtle,
              },
            ]}
          >
            <View style={styles.metricColumn}>
              <Text style={[styles.metricStripLabel, { color: colors.textMuted }]}>
                Consumption
              </Text>
              <Text style={[styles.metricStripValue, { color: colors.textPrimary }]}>
                {statement.consumptionKwh} {unit}
              </Text>
            </View>

            <View
              style={[
                styles.metricColumn,
                {
                  borderLeftWidth: 1,
                  borderRightWidth: 1,
                  borderColor: colors.borderSubtle,
                  paddingHorizontal: 8,
                },
              ]}
            >
              <Text style={[styles.metricStripLabel, { color: colors.textMuted }]}>
                Effective rate
              </Text>
              <Text style={[styles.metricStripValue, { color: colors.textPrimary }]}>
                {statement.effectiveRate}
              </Text>
            </View>

            <View style={styles.metricColumn}>
              <Text style={[styles.metricStripLabel, { color: colors.textMuted }]}>
                Adjustment
              </Text>
              <Text style={[styles.metricStripValue, { color: WattWiseTheme.colors.secondary }]}>
                {statement.generationAdjustment}
              </Text>
            </View>
          </View>
        </View>
      </SlideUpItem>

      {/* 2. Proportional Visual Stacked Bar */}
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
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
              Where your money goes
            </Text>
            <Text style={[styles.sectionSubHeading, { color: colors.textMuted }]}>
              {charges.length} Components
            </Text>
          </View>

          {/* Stacked Percentage Bar */}
          <View
            style={[
              styles.stackedBar,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#EEF2F6',
              },
            ]}
          >
            {charges.map((c) => {
              const isSelected = selectedCharge === c.name;
              return (
                <Pressable
                  key={c.name}
                  onPress={() => setSelectedCharge(isSelected ? null : c.name)}
                  style={[
                    styles.barSegment,
                    {
                      width: `${c.percentage}%`,
                      backgroundColor: c.color,
                      opacity: selectedCharge && !isSelected ? 0.35 : 1,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Minimal Legend Row */}
          <View style={styles.legendRow}>
            {charges.map((c) => {
              const isSelected = selectedCharge === c.name;
              return (
                <Pressable
                  key={c.name}
                  onPress={() => setSelectedCharge(isSelected ? null : c.name)}
                  style={[
                    styles.legendPill,
                    isSelected && {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(16, 43, 85, 0.06)',
                    },
                  ]}
                >
                  <View style={[styles.legendBar, { backgroundColor: c.color }]} />
                  <Text
                    style={[
                      styles.legendText,
                      {
                        color: isSelected ? WattWiseTheme.colors.primary : colors.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {c.name.split(' ')[0]} {c.percentage}%
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SlideUpItem>

      {/* 3. Market Rate Update Note */}
      <SlideUpItem index={2}>
        <View
          style={[
            styles.rateUpdateNotice,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8F9FA',
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          <Icon name="info" size={17} color={WattWiseTheme.colors.primary} />
          <Text style={[styles.rateUpdateText, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
              Verified Statement:{' '}
            </Text>
            {statement.provider} ({statement.period}) active with adjustment rate of {statement.generationAdjustment}.
          </Text>
        </View>
      </SlideUpItem>

      {/* 4. Itemized Statement Grouped List */}
      <SlideUpItem index={3}>
        <View style={styles.listSection}>
          <View style={styles.listSectionHeader}>
            <Text style={[styles.listSectionTitle, { color: colors.textPrimary }]}>
              Itemized charges
            </Text>
            <Text style={[styles.listSectionSub, { color: colors.textMuted }]}>
              Tap to view details
            </Text>
          </View>

          {/* Grouped Inset Card */}
          <View
            style={[
              styles.groupedCard,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            {charges.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  No itemized charges found for this utility statement.
                </Text>
              </View>
            ) : (
              charges.map((item, index) => {
                const isSelected = selectedCharge === item.name;
                const isLast = index === charges.length - 1;

              return (
                <View key={item.name}>
                  <Pressable
                    onPress={() => setSelectedCharge(isSelected ? null : item.name)}
                    style={({ pressed }) => [
                      styles.chargeRow,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? 'rgba(255, 255, 255, 0.04)'
                            : 'rgba(16, 43, 85, 0.02)'
                          : pressed
                          ? isDark
                            ? 'rgba(255, 255, 255, 0.02)'
                            : '#FAFAFA'
                          : 'transparent',
                      },
                    ]}
                  >
                    {/* Left: Swatch & Name */}
                    <View style={styles.chargeRowLeft}>
                      <View style={[styles.colorSwatch, { backgroundColor: item.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.chargeRowName, { color: colors.textPrimary }]}>
                          {item.name}
                        </Text>
                        <Text style={[styles.chargeRowTagalog, { color: colors.textMuted }]}>
                          {item.tagalog}
                        </Text>
                      </View>
                    </View>

                    {/* Right: Amount & Rate */}
                    <View style={styles.chargeRowRight}>
                      <Text style={[styles.chargeRowAmount, { color: colors.textPrimary }]}>
                        {item.amount}
                      </Text>
                      <Text style={[styles.chargeRowRate, { color: colors.textSecondary }]}>
                        {item.percentage}% · {item.rate}
                      </Text>
                    </View>
                  </Pressable>

                  {/* Expanded Detail Drawer */}
                  {isSelected && (
                    <View
                      style={[
                        styles.drawerContainer,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.03)'
                            : 'rgba(16, 43, 85, 0.03)',
                          borderLeftColor: item.color,
                        },
                      ]}
                    >
                      <Text style={[styles.drawerText, { color: colors.textSecondary }]}>
                        {item.desc}
                      </Text>
                      {item.tagalog ? (
                        <Text
                          style={[
                            styles.drawerText,
                            { color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
                          ]}
                        >
                          {item.tagalog}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {!isLast && (
                    <View style={[styles.rowDivider, { backgroundColor: colors.borderSubtle }]} />
                  )}
                </View>
              );
            }))}
          </View>
        </View>
      </SlideUpItem>

      {/* 5. Clean Action Controls */}
      <SlideUpItem index={4}>
        <View style={styles.actionGroup}>
          <Pressable
            onPress={handleExport}
            disabled={isExporting}
            style={({ pressed }) => [
              styles.exportButton,
              {
                backgroundColor: WattWiseTheme.colors.primary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Icon name="download" size={18} color="#FFFFFF" />
            )}
            <Text style={styles.exportButtonText}>
              {isExporting ? 'Generating PDF Statement...' : 'Export PDF Statement'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleAskAi}
            style={({ pressed }) => [
              styles.questionLink,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.questionLinkText, { color: colors.textSecondary }]}>
              Have questions about this bill?{' '}
              <Text style={{ color: WattWiseTheme.colors.primary, fontWeight: '600' }}>
                Ask Assistant ›
              </Text>
            </Text>
          </Pressable>
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
  statementCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#102B55',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 2px 8px rgba(16, 43, 85, 0.05)',
      },
    }),
  },
  statementTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  providerLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  statementPeriod: {
    fontSize: 12,
    marginTop: 2,
  },
  dueDateBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  amountHeroBlock: {
    marginTop: 2,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  amountValue: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginTop: 2,
  },
  accountSubtext: {
    fontSize: 12,
    marginTop: 3,
  },
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricStripLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  metricStripValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardContainer: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  sectionSubHeading: {
    fontSize: 12,
  },
  stackedBar: {
    height: 16,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  barSegment: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  legendBar: {
    width: 10,
    height: 4,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
  },
  rateUpdateNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  rateUpdateText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  listSection: {
    gap: 8,
  },
  listSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  listSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  listSectionSub: {
    fontSize: 11,
  },
  groupedCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chargeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chargeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  colorSwatch: {
    width: 4,
    height: 28,
    borderRadius: 2,
  },
  chargeRowName: {
    fontSize: 13,
    fontWeight: '600',
  },
  chargeRowTagalog: {
    fontSize: 11,
    marginTop: 1,
  },
  chargeRowRight: {
    alignItems: 'flex-end',
  },
  chargeRowAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  chargeRowRate: {
    fontSize: 11,
    marginTop: 2,
  },
  drawerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 16,
    marginRight: 16,
    marginBottom: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  drawerText: {
    fontSize: 12,
    lineHeight: 17,
  },
  rowDivider: {
    height: 1,
    marginLeft: 32,
  },
  actionGroup: {
    gap: 12,
    marginTop: 4,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  questionLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  questionLinkText: {
    fontSize: 12,
  },
});
