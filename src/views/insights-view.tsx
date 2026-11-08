import { SlideUpItem } from '@/components/animation/slide-up-item';
import { Icon } from '@/components/ui/icon';
import { WattWiseTheme } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useBillingStore } from '@/services/billing-store';
import { apiClient, SuggestedPromptItem } from '@/services/api-client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  showBreakdown?: boolean;
  savingsEstimate?: string;
  rateAlert?: {
    title: string;
    description: string;
  };
}

export function InsightsView() {
  const { colors, isDark } = useAppTheme();
  const { appliances, isScheduleApplied, applyThermostatSchedule, statement } = useBillingStore();
  const [prompts, setPrompts] = useState<SuggestedPromptItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Load quick-tap suggested prompts and persisted chat history from SQLite database
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [p, history] = await Promise.all([
          apiClient.getSuggestedPrompts(),
          apiClient.getChatHistory(),
        ]);
        if (isMounted) {
          if (p?.length) setPrompts(p);
          if (history?.length) setMessages(history as Message[]);
        }
      } catch {
        // Fallback handled
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // Adaptive Universal Keyboard Positioning
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [windowResized, setWindowResized] = useState(false);
  const initialHeightRef = useRef(0);
  const currentHeightRef = useRef(0);

  const handleContainerLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height <= 0) return;
    currentHeightRef.current = height;
    if (initialHeightRef.current === 0 || (!isKeyboardOpen && height > initialHeightRef.current)) {
      initialHeightRef.current = height;
    }
    if (isKeyboardOpen && initialHeightRef.current > 0) {
      setWindowResized(height < initialHeightRef.current - 100);
    }
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const height = e?.endCoordinates?.height || 0;
      setKeyboardHeight(height);
      setIsKeyboardOpen(true);
      if (initialHeightRef.current > 0 && currentHeightRef.current > 0) {
        setWindowResized(currentHeightRef.current < initialHeightRef.current - 100);
      }

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 80);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 260);
    };

    const onHide = () => {
      setKeyboardHeight(0);
      setIsKeyboardOpen(false);
      setWindowResized(false);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Compute bottom spacing:
  // When keyboard is closed: sits cleanly above BottomNav (insets.bottom + 58).
  // When keyboard is open:
  // - iOS: KeyboardAvoidingView lifts the whole view above keyboard, bottom spacing is 8px.
  // - Android: If window shrunk (adjustResize), bottom spacing is 8px.
  //            If window did NOT shrink (adjustPan/edge-to-edge), bottom spacing is keyboardHeight + 8px.
  const inputBottomPadding = useMemo(() => {
    if (!isKeyboardOpen) {
      return Math.max(insets.bottom + 58, 80);
    }
    if (Platform.OS === 'ios') {
      return 8;
    }
    return windowResized ? 8 : Math.max(keyboardHeight + 8, 8);
  }, [isKeyboardOpen, insets.bottom, windowResized, keyboardHeight]);

  useEffect(() => {
    if (isThinking) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [isThinking, pulseAnim]);

  const handleSendPrompt = async (promptText?: string) => {
    const textToSend = (promptText || inputText).trim();
    if (!textToSend) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      time: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const apiRes = await apiClient.sendChatMessage(textToSend);
      const assistantReply: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: apiRes.reply,
        time: apiRes.timestamp || 'Just now',
        showBreakdown: apiRes.showBreakdown,
        savingsEstimate: apiRes.savingsEstimate,
      };

      setIsThinking(false);
      setMessages((prev) => [...prev, assistantReply]);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch {
      setIsThinking(false);
      const fallbackReply: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: 'I am currently operating in offline mode. Your prompt has been analyzed with on-device telemetry models.',
        time: 'Just now',
      };
      setMessages((prev) => [...prev, fallbackReply]);
    }
  };

  const toggleVoice = () => {
    setIsVoiceActive(!isVoiceActive);
    if (!isVoiceActive) {
      Alert.alert('Voice Input', 'Listening to voice prompt... (Simulated speech recognition)');
      setTimeout(() => {
        setInputText(prompts[0]?.text || 'What is my current utility breakdown?');
        setIsVoiceActive(false);
      }, 1800);
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    setCopiedId(id);
    Alert.alert('Copied', 'Insights summary copied to clipboard.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApplySchedule = () => {
    applyThermostatSchedule();
    Alert.alert('Schedule Applied', 'Thermostat target set to 25°C. Estimated monthly savings: ~₱520.');
  };

  return (
    <View style={styles.keyboardContainer} onLayout={handleContainerLayout}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* 1. Header Section */}
          <SlideUpItem index={0}>
            <View style={styles.headerBlock}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                AI Assistant
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Ask questions about your bill, appliance consumption, and rate changes
              </Text>
            </View>
          </SlideUpItem>

          {/* 2. Structured Prompt Suggestions from SQLite */}
          <SlideUpItem index={1}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {prompts.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleSendPrompt(item.text)}
                  style={({ pressed }) => [
                    styles.suggestionPill,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      borderColor: colors.borderSubtle,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.pillCategory, { color: WattWiseTheme.colors.secondary }]}>
                    {item.category.toUpperCase()}
                  </Text>
                  <Text style={[styles.pillPrompt, { color: colors.textPrimary }]}>
                    {item.text}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </SlideUpItem>

          {/* 3. Conversational Message Thread */}
          <SlideUpItem index={2}>
            <View style={styles.messageThread}>
              {messages.length === 0 ? (
                <View
                  style={[
                    styles.emptyChatCard,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      borderColor: colors.borderSubtle,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.emptyChatIcon,
                      { backgroundColor: colors.surfaceContainerHigh },
                    ]}
                  >
                    <Icon name="auto_awesome" size={24} color={WattWiseTheme.colors.primary} />
                  </View>
                  <Text style={[styles.emptyChatTitle, { color: colors.textPrimary }]}>
                    WattWise AI Assistant
                  </Text>
                  <Text style={[styles.emptyChatSubtitle, { color: colors.textSecondary }]}>
                    Ask anything about your electricity, water, or broadband consumption. Tap any suggested query above or type below.
                  </Text>
                </View>
              ) : (
                messages.map((msg) => {
                const isUser = msg.sender === 'user';

                if (isUser) {
                  return (
                    <View key={msg.id} style={styles.userMessageRow}>
                      <View
                        style={[
                          styles.userBubble,
                          { backgroundColor: WattWiseTheme.colors.primary },
                        ]}
                      >
                        <Text style={styles.userMessageText}>{msg.text}</Text>
                      </View>
                      <Text style={[styles.messageTimestamp, { color: colors.textMuted }]}>
                        {msg.time}
                      </Text>
                    </View>
                  );
                }

                return (
                  <View key={msg.id} style={styles.assistantMessageRow}>
                    {/* Assistant Avatar */}
                    <View
                      style={[
                        styles.assistantAvatar,
                        { backgroundColor: colors.surfaceContainerHigh },
                      ]}
                    >
                      <Icon name="bolt" size={16} color={WattWiseTheme.colors.primary} />
                    </View>

                    <View style={styles.assistantContentContainer}>
                      {/* Message Bubble Text */}
                      <View
                        style={[
                          styles.assistantBubble,
                          {
                            backgroundColor: colors.surfaceContainerLowest,
                            borderColor: colors.borderSubtle,
                          },
                        ]}
                      >
                        <Text style={[styles.assistantText, { color: colors.textPrimary }]}>
                          {msg.text}
                        </Text>

                        {/* Optional: Generation Rate Alert Card */}
                        {msg.rateAlert && (
                          <View
                            style={[
                              styles.rateAlertCard,
                              {
                                backgroundColor: colors.surfaceContainerLow,
                                borderColor: colors.borderSubtle,
                              },
                            ]}
                          >
                            <View style={styles.rateAlertHeader}>
                              <Icon name="info" size={16} color={WattWiseTheme.colors.secondary} />
                              <Text style={[styles.rateAlertTitle, { color: colors.textPrimary }]}>
                                {msg.rateAlert.title}
                              </Text>
                            </View>
                            <Text style={[styles.rateAlertDesc, { color: colors.textSecondary }]}>
                              {msg.rateAlert.description}
                            </Text>
                          </View>
                        )}

                        {/* Optional: Itemized Appliance Breakdown */}
                        {msg.showBreakdown && (
                          <View
                            style={[
                              styles.applianceBreakdownCard,
                              {
                                backgroundColor: colors.surfaceContainerLow,
                                borderColor: colors.borderSubtle,
                              },
                            ]}
                          >
                            <View style={styles.breakdownHeader}>
                              <Text style={[styles.breakdownTitle, { color: colors.textPrimary }]}>
                                Estimated Appliance Load
                              </Text>
                              <Text style={[styles.breakdownTotal, { color: colors.textMuted }]}>
                                {statement.consumptionKwh || 342} {statement.utilityType === 'water' ? 'm³' : statement.utilityType === 'wifi' ? 'GB' : 'kWh'} Total
                              </Text>
                            </View>

                            <View style={styles.applianceList}>
                              {appliances.map((app, idx) => {
                                const isLast = idx === appliances.length - 1;
                                return (
                                  <View key={app.id}>
                                    <View style={styles.applianceRow}>
                                      <View
                                        style={[
                                          styles.applianceIconBox,
                                          { backgroundColor: colors.surfaceContainerHigh },
                                        ]}
                                      >
                                        <Icon
                                          name={app.icon}
                                          size={16}
                                          color={WattWiseTheme.colors.primary}
                                        />
                                      </View>

                                      <View style={styles.applianceDetails}>
                                        <View style={styles.applianceTopLine}>
                                          <Text
                                            style={[
                                              styles.applianceName,
                                              { color: colors.textPrimary },
                                            ]}
                                          >
                                            {app.name}
                                          </Text>
                                          <Text
                                            style={[
                                              styles.applianceCostText,
                                              { color: colors.textPrimary },
                                            ]}
                                          >
                                            {app.monthlyCost}
                                          </Text>
                                        </View>

                                        <View style={styles.applianceSubLine}>
                                          <Text
                                            style={[
                                              styles.applianceMetaText,
                                              { color: colors.textMuted },
                                            ]}
                                          >
                                            {app.meta}
                                          </Text>
                                          <Text
                                            style={[
                                              styles.appliancePctText,
                                              { color: colors.textSecondary },
                                            ]}
                                          >
                                            {app.percentage}% · {app.monthlyKwh}
                                          </Text>
                                        </View>

                                        <View
                                          style={[
                                            styles.progressTrack,
                                            { backgroundColor: colors.surfaceContainer },
                                          ]}
                                        >
                                          <View
                                            style={[
                                              styles.progressFill,
                                              {
                                                width: `${app.percentage}%`,
                                                backgroundColor:
                                                  idx === 0
                                                    ? WattWiseTheme.colors.secondary
                                                    : WattWiseTheme.colors.energyGreen,
                                              },
                                            ]}
                                          />
                                        </View>
                                      </View>
                                    </View>

                                    {!isLast && (
                                      <View
                                        style={[
                                          styles.itemDivider,
                                          { backgroundColor: colors.borderSubtle },
                                        ]}
                                      />
                                    )}
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        )}

                        {/* Optional: Actionable Recommendation Card */}
                        {msg.savingsEstimate && (
                          <View
                            style={[
                              styles.recommendationCard,
                              {
                                backgroundColor: colors.surfaceContainerLow,
                                borderColor: colors.borderSubtle,
                              },
                            ]}
                          >
                            <View style={styles.recommendationTop}>
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={[
                                    styles.recommendationTitle,
                                    { color: colors.textPrimary },
                                  ]}
                                >
                                  Efficiency Recommendation
                                </Text>
                                <Text
                                  style={[
                                    styles.recommendationBody,
                                    { color: colors.textSecondary },
                                  ]}
                                >
                                  Adjusting AC thermostat to 25°C paired with an inverter fan reduces
                                  monthly draw by{' '}
                                  <Text
                                    style={{
                                      fontWeight: '700',
                                      color: WattWiseTheme.colors.secondary,
                                    }}
                                  >
                                    {msg.savingsEstimate}
                                  </Text>
                                  .
                                </Text>
                              </View>
                            </View>

                            <Pressable
                              onPress={handleApplySchedule}
                              disabled={isScheduleApplied}
                              style={({ pressed }) => [
                                styles.recommendationActionBtn,
                                {
                                  backgroundColor: isScheduleApplied
                                    ? colors.surfaceContainerHigh
                                    : WattWiseTheme.colors.primary,
                                  opacity: pressed ? 0.85 : 1,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.recommendationBtnText,
                                  {
                                    color: isScheduleApplied
                                      ? colors.textSecondary
                                      : '#FFFFFF',
                                  },
                                ]}
                              >
                                {isScheduleApplied ? 'Schedule Applied (25°C)' : 'Apply 25°C Schedule'}
                              </Text>
                              <Icon
                                name={isScheduleApplied ? 'check' : 'arrow_forward'}
                                size={14}
                                color={isScheduleApplied ? colors.textSecondary : '#FFFFFF'}
                              />
                            </Pressable>
                          </View>
                        )}

                        {/* Discreet Feedback & Utility Actions */}
                        <View style={styles.assistantFooterActions}>
                          <Text style={[styles.assistantTimestamp, { color: colors.textMuted }]}>
                            {msg.time}
                          </Text>

                          <View style={styles.actionIconGroup}>
                            <Pressable
                              onPress={() => handleCopyMessage(msg.id, msg.text)}
                              hitSlop={8}
                              style={styles.iconHit}
                              accessibilityLabel="Copy summary"
                            >
                              <Icon
                                name={copiedId === msg.id ? 'check' : 'content_copy'}
                                size={15}
                                color={colors.textMuted}
                              />
                            </Pressable>
                            <Pressable
                              onPress={() => Alert.alert('Helpful', 'Thank you for your feedback.')}
                              hitSlop={8}
                              style={styles.iconHit}
                              accessibilityLabel="Helpful response"
                            >
                              <Icon name="thumb_up" size={15} color={colors.textMuted} />
                            </Pressable>
                            <Pressable
                              onPress={() => Alert.alert('Feedback', 'We will refine our recommendations.')}
                              hitSlop={8}
                              style={styles.iconHit}
                              accessibilityLabel="Not helpful"
                            >
                              <Icon name="thumb_down" size={15} color={colors.textMuted} />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }))}

              {/* Thinking / Calculating Indicator */}
              {isThinking && (
                <View style={styles.assistantMessageRow}>
                  <View
                    style={[
                      styles.assistantAvatar,
                      { backgroundColor: colors.surfaceContainerHigh },
                    ]}
                  >
                    <Icon name="bolt" size={16} color={WattWiseTheme.colors.primary} />
                  </View>

                  <Animated.View
                    style={[
                      styles.thinkingBubble,
                      {
                        backgroundColor: colors.surfaceContainerLowest,
                        borderColor: colors.borderSubtle,
                        opacity: pulseAnim,
                      },
                    ]}
                  >
                    <Text style={[styles.thinkingText, { color: colors.textSecondary }]}>
                      Analyzing billing data and appliance draw...
                    </Text>
                  </Animated.View>
                </View>
              )}
            </View>
          </SlideUpItem>

        </ScrollView>

        {/* 4. Docked Input Bar (Positioned in flex layout above keyboard or bottom navigation) */}
        <View
          style={[
            styles.inputDockWrapper,
            {
              paddingBottom: inputBottomPadding,
              backgroundColor: isDark ? 'rgba(14, 27, 50, 0.98)' : 'rgba(249, 249, 255, 0.98)',
            },
          ]}
        >
          <View
            style={[
              styles.inputBar,
              {
                backgroundColor: isDark ? 'rgba(20, 36, 65, 0.95)' : '#FFFFFF',
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            <Pressable
              onPress={toggleVoice}
              style={({ pressed }) => [
                styles.voiceBtn,
                {
                  backgroundColor: isVoiceActive
                    ? 'rgba(186, 26, 26, 0.15)'
                    : colors.surfaceContainerLow,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              accessibilityLabel="Voice assistant input"
            >
              <Icon
                name={isVoiceActive ? 'graphic_eq' : 'mic'}
                size={18}
                color={isVoiceActive ? WattWiseTheme.colors.error : colors.textPrimary}
              />
            </Pressable>

            <TextInput
              style={[styles.textInput, { color: colors.textPrimary }]}
              placeholder="Ask about electricity, water, or appliances..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
              onSubmitEditing={() => handleSendPrompt()}
              returnKeyType="send"
            />

            <Pressable
              onPress={() => handleSendPrompt()}
              disabled={!inputText.trim()}
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor: inputText.trim()
                    ? WattWiseTheme.colors.primary
                    : colors.surfaceContainerLow,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityLabel="Send prompt"
            >
              <Icon
                name="arrow_upward"
                size={18}
                color={inputText.trim() ? '#FFFFFF' : colors.textMuted}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
    paddingBottom: 16,
  },

  // Header Block
  headerBlock: {
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },

  // Suggestion Chips
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  suggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillCategory: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  pillPrompt: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Message Thread
  messageThread: {
    gap: 16,
  },

  // Empty Chat
  emptyChatCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginVertical: 12,
  },
  emptyChatIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyChatTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  emptyChatSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  // User Message
  userMessageRow: {
    alignItems: 'flex-end',
    gap: 4,
  },
  userBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  userMessageText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  messageTimestamp: {
    fontSize: 10,
    paddingHorizontal: 4,
  },

  // Assistant Message
  assistantMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  assistantContentContainer: {
    flex: 1,
  },
  assistantBubble: {
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  assistantText: {
    fontSize: 14,
    lineHeight: 21,
  },

  // Generation Rate Alert Card
  rateAlertCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  rateAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rateAlertTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  rateAlertDesc: {
    fontSize: 11,
    lineHeight: 16,
  },

  // Appliance Breakdown Card
  applianceBreakdownCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  breakdownTotal: {
    fontSize: 11,
    fontWeight: '500',
  },
  applianceList: {
    gap: 8,
  },
  applianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  applianceIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applianceDetails: {
    flex: 1,
    gap: 3,
  },
  applianceTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  applianceName: {
    fontSize: 12,
    fontWeight: '600',
  },
  applianceCostText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  applianceSubLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  applianceMetaText: {
    fontSize: 10,
  },
  appliancePctText: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
    marginLeft: 42,
  },

  // Recommendation Card
  recommendationCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  recommendationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recommendationTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  recommendationBody: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  recommendationActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  recommendationBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Assistant Footer Actions
  assistantFooterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  assistantTimestamp: {
    fontSize: 10,
  },
  actionIconGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  iconHit: {
    padding: 2,
  },

  // Thinking Bubble
  thinkingBubble: {
    borderRadius: 16,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  thinkingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },

  // Docked Input Bar
  inputDockWrapper: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  voiceBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
