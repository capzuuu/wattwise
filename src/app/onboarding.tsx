import { SlideUpItem } from '@/components/animation/slide-up-item';
import { Icon } from '@/components/ui/icon';
import { WattWiseTheme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';
import { apiClient, OnboardingSlideItem } from '@/services/api-client';
import { useBillingStore } from '@/services/billing-store';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  const { colors, isDark } = useAppTheme();
  const { completeOnboarding, isAuthenticated } = useAuth();
  const { statement, appliances } = useBillingStore();
  const [slides, setSlides] = useState<OnboardingSlideItem[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  // Load onboarding slides dynamically from SQLite database
  useEffect(() => {
    let isMounted = true;
    async function loadSlides() {
      try {
        const fetched = await apiClient.getOnboardingSlides();
        if (isMounted && fetched?.length) {
          setSlides(fetched);
        }
      } catch {
        // Handled via local replica
      }
    }
    loadSlides();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeSlide = slides[currentStep] || slides[0] || {
    id: 'ocr',
    badge: 'On-Device Document Scanner',
    title: 'Scan Utility Statements in Seconds',
    description: 'Point your camera at your electric, water, or broadband bill. WattWise extracts account figures, kWh consumption, and fuel adjustments securely on-device.',
    sort_order: 0,
    visual_type: 'ocr',
  };

  const isLast = slides.length > 0 ? currentStep === slides.length - 1 : false;

  const handleNext = async () => {
    if (isLast) {
      await completeOnboarding();
      if (isAuthenticated) {
        router.replace('/');
      } else {
        router.replace('/auth');
      }
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
    if (isAuthenticated) {
      router.replace('/');
    } else {
      router.replace('/auth');
    }
  };

  const renderVisual = (type: string) => {
    if (type === 'breakdown' || type === 'disaggregation') {
      const topApps = appliances.length > 0 ? appliances.slice(0, 3) : [
        { id: '1', name: 'Cooling & AC', monthlyCost: '₱1,724', percentage: 42 },
        { id: '2', name: 'Refrigeration', monthlyCost: '₱739', percentage: 18 },
        { id: '3', name: 'Lighting & Electronics', monthlyCost: '₱615', percentage: 15 },
      ];

      return (
        <View
          style={[
            styles.visualCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          <View style={styles.applianceMockHeader}>
            <Text style={[styles.applianceMockTitle, { color: colors.textPrimary }]}>
              Top Household Consumers
            </Text>
            <Text style={[styles.applianceMockTotal, { color: colors.textMuted }]}>
              {statement?.consumptionKwh ? `${statement.consumptionKwh} kWh Total` : 'Active Telemetry'}
            </Text>
          </View>

          <View style={styles.applianceMockList}>
            {topApps.map((app, idx) => (
              <View key={app.id || idx} style={styles.applianceMockRow}>
                <View style={styles.applianceMockMeta}>
                  <Text style={[styles.applianceMockName, { color: colors.textPrimary }]}>
                    {app.name}
                  </Text>
                  <Text style={[styles.applianceMockPrice, { color: colors.textPrimary }]}>
                    {app.monthlyCost}{' '}
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>({app.percentage}%)</Text>
                  </Text>
                </View>
                <View
                  style={[
                    styles.applianceMockTrack,
                    { backgroundColor: colors.surfaceContainer },
                  ]}
                >
                  <View
                    style={[
                      styles.applianceMockFill,
                      {
                        width: `${Math.min(app.percentage, 100)}%`,
                        backgroundColor: idx === 0 ? WattWiseTheme.colors.secondary : WattWiseTheme.colors.energyGreen,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (type === 'copilot' || type === 'ai-assistant') {
      return (
        <View
          style={[
            styles.visualCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          <View style={styles.aiChatPreview}>
            <View style={styles.userBubblePreview}>
              <Text style={styles.userBubbleText}>
                How much does our 1.5HP AC cost per day?
              </Text>
            </View>

            <View
              style={[
                styles.assistantBubblePreview,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Icon name="bolt" size={14} color={WattWiseTheme.colors.primary} />
                <Text style={[styles.assistantBubbleTitle, { color: colors.textPrimary }]}>
                  WattWise AI Assistant
                </Text>
              </View>
              <Text style={[styles.assistantBubbleBody, { color: colors.textSecondary }]}>
                ₱57.40/day (~4.8 kWh). Setting thermostat to 25°C saves ~₱520/month.
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.budgetMockStrip,
              { backgroundColor: colors.surfaceContainerLow },
            ]}
          >
            <View>
              <Text style={[styles.billMockLabel, { color: colors.textMuted }]}>
                Utilities Monitored
              </Text>
              <Text style={[styles.budgetMockAmount, { color: colors.textPrimary }]}>
                3 Active
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.billMockLabel, { color: colors.textMuted }]}>
                Power · Water · Wi-Fi
              </Text>
              <Text style={[styles.budgetMockStatus, { color: WattWiseTheme.colors.secondary }]}>
                All Broken Down
              </Text>
            </View>
          </View>
        </View>
      );
    }

    // Default to OCR document visual
    return (
      <View
        style={[
          styles.visualCard,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.borderSubtle,
          },
        ]}
      >
        <View style={styles.billMockHeader}>
          <View style={styles.billMockBrand}>
            <View
              style={[
                styles.billMockLogo,
                { backgroundColor: WattWiseTheme.colors.primary },
              ]}
            >
              <Icon name="bolt" size={14} color={WattWiseTheme.colors.secondaryContainer} />
            </View>
            <View>
              <Text style={[styles.billMockProvider, { color: colors.textPrimary }]}>
                {statement?.provider || 'Electricity Statement'}
              </Text>
              <Text style={[styles.billMockSub, { color: colors.textMuted }]}>
                {statement?.period ? `Billing Cycle: ${statement.period}` : 'Active Billing Statement'}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.billMockVerifiedBadge,
              { backgroundColor: WattWiseTheme.colors.primaryFixed },
            ]}
          >
            <Text
              style={[
                styles.billMockVerifiedText,
                { color: WattWiseTheme.colors.primaryDark },
              ]}
            >
              Verified
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.billMockHighlight,
            { backgroundColor: colors.surfaceContainerLow },
          ]}
        >
          <View>
            <Text style={[styles.billMockLabel, { color: colors.textMuted }]}>
              Total Amount Due
            </Text>
            <Text style={[styles.billMockAmount, { color: colors.textPrimary }]}>
              {statement?.amountDue || '₱0.00'}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.billMockLabel, { color: colors.textMuted }]}>
              Consumption
            </Text>
            <Text style={[styles.billMockKwh, { color: WattWiseTheme.colors.secondary }]}>
              {statement?.consumptionKwh ? `${statement.consumptionKwh} kWh` : '0 kWh'}
            </Text>
          </View>
        </View>

        <View style={styles.billMockFooter}>
          <Text style={[styles.billMockFooterText, { color: colors.textSecondary }]}>
            {statement?.dueDate ? `Due ${statement.dueDate} · Verified Statement` : 'On-Device Statement Verification'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      {/* Top Navigation & Step Progress Bars */}
      <View style={styles.topNav}>
        <View style={styles.navActionRow}>
          {currentStep > 0 ? (
            <Pressable
              onPress={handleBack}
              hitSlop={10}
              style={({ pressed }) => [
                styles.navBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              accessibilityLabel="Go back"
            >
              <Icon name="arrow_back" size={20} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <View style={styles.navPlaceholder} />
          )}

          <Pressable
            onPress={handleSkip}
            hitSlop={10}
            style={({ pressed }) => [
              styles.skipBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            accessibilityLabel="Skip onboarding"
          >
            <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
          </Pressable>
        </View>

        {/* Step Indicators */}
        <View style={styles.progressRow}>
          {(slides.length > 0 ? slides : [0, 1, 2]).map((_, idx) => {
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            return (
              <View
                key={idx}
                style={[
                  styles.progressTrack,
                  {
                    backgroundColor: isActive
                      ? WattWiseTheme.colors.primary
                      : isCompleted
                      ? WattWiseTheme.colors.primaryDark
                      : colors.surfaceContainerHigh,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Main Content Card with Visual Preview */}
      <View style={styles.contentContainer}>
        {/* Dynamic Interactive Visual Component */}
        <SlideUpItem index={currentStep * 2}>
          <View style={styles.visualContainer}>
            {renderVisual(activeSlide.visual_type || activeSlide.id)}
          </View>
        </SlideUpItem>

        {/* Text Information Section */}
        <SlideUpItem index={currentStep * 2 + 1}>
          <View style={styles.copyContainer}>
            <View
              style={[
                styles.badgePill,
                {
                  backgroundColor: isDark
                    ? 'rgba(0, 109, 56, 0.22)'
                    : 'rgba(0, 109, 56, 0.12)',
                  borderColor: WattWiseTheme.colors.primary,
                },
              ]}
            >
              <Icon name="auto_awesome" size={12} color={WattWiseTheme.colors.primary} />
              <Text
                style={[
                  styles.badgePillText,
                  { color: WattWiseTheme.colors.primary },
                ]}
              >
                {activeSlide.badge}
              </Text>
            </View>

            <Text style={[styles.titleText, { color: colors.textPrimary }]}>
              {activeSlide.title}
            </Text>

            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
              {activeSlide.description}
            </Text>
          </View>
        </SlideUpItem>
      </View>

      {/* Bottom CTA Button */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.ctaButton,
            {
              backgroundColor: WattWiseTheme.colors.primary,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
          accessibilityLabel={isLast ? 'Get started' : 'Continue'}
        >
          <Text style={styles.ctaButtonText}>
            {isLast ? 'Get Started' : 'Continue'}
          </Text>
          <Icon name="arrow_forward" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topNav: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  navActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 40,
    marginBottom: 16,
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
  },
  navPlaceholder: {
    width: 32,
  },
  skipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  visualContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  visualCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  copyContainer: {
    alignItems: 'flex-start',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
  },
  badgePillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '400',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  ctaButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  billMockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  billMockBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  billMockLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billMockProvider: {
    fontSize: 14,
    fontWeight: '700',
  },
  billMockSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  billMockVerifiedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  billMockVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  billMockHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  billMockLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  billMockAmount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  billMockKwh: {
    fontSize: 18,
    fontWeight: '700',
  },
  billMockFooter: {
    alignItems: 'center',
  },
  billMockFooterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  applianceMockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  applianceMockTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  applianceMockTotal: {
    fontSize: 12,
    fontWeight: '600',
  },
  applianceMockList: {
    gap: 10,
  },
  applianceMockRow: {
    gap: 6,
  },
  applianceMockMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  applianceMockName: {
    fontSize: 13,
    fontWeight: '600',
  },
  applianceMockPrice: {
    fontSize: 13,
    fontWeight: '700',
  },
  applianceMockTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  applianceMockFill: {
    height: '100%',
    borderRadius: 3,
  },
  aiChatPreview: {
    gap: 8,
    marginBottom: 12,
  },
  userBubblePreview: {
    alignSelf: 'flex-end',
    backgroundColor: WattWiseTheme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderBottomRightRadius: 2,
    maxWidth: '85%',
  },
  userBubbleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  assistantBubblePreview: {
    alignSelf: 'flex-start',
    padding: 10,
    borderRadius: 14,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    maxWidth: '90%',
  },
  assistantBubbleTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  assistantBubbleBody: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  budgetMockStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  budgetMockAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  budgetMockStatus: {
    fontSize: 12,
    fontWeight: '700',
  },
});
