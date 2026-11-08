import { SlideUpItem } from '@/components/animation/slide-up-item';
import { Icon } from '@/components/ui/icon';
import { WattWiseTheme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type AuthMode = 'login' | 'register';

export default function AuthScreen() {
  const { colors, isDark } = useAppTheme();
  const { loginWithEmail, registerWithEmail } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLogin = mode === 'login';

  const handleSwitchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    const cleanName = name.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    if (!isLogin) {
      if (!cleanName) {
        setErrorMessage('Please enter your full name.');
        return;
      }
      if (cleanPassword.length < 8) {
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        await loginWithEmail(cleanEmail, cleanPassword);
      } else {
        await registerWithEmail(cleanName, cleanEmail, cleanPassword);
      }
      router.replace('/');
    } catch (e: any) {
      const msg = e?.message || 'Authentication failed. Please try again.';
      setErrorMessage(msg);
      Alert.alert(isLogin ? 'Sign In Failed' : 'Registration Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. Header */}
          <SlideUpItem index={0} style={styles.brandHeader}>
            <View
              style={[
                styles.brandLogoBox,
                { backgroundColor: WattWiseTheme.colors.primary },
              ]}
            >
              <Icon name="bolt" size={24} color={WattWiseTheme.colors.secondaryContainer} />
            </View>

            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
              <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
                {isLogin
                  ? 'Access your household utility telemetry'
                  : 'Register a new household profile'}
              </Text>
            </View>
          </SlideUpItem>

          {/* 2. Mode Selector */}
          <SlideUpItem index={1}>
            <View
              style={[
                styles.segmentedSwitch,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <Pressable
                onPress={() => handleSwitchMode('login')}
                style={[
                  styles.segmentButton,
                  isLogin && [
                    styles.segmentActiveButton,
                    { backgroundColor: colors.surfaceContainerLowest },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: isLogin ? colors.textPrimary : colors.textMuted,
                      fontWeight: isLogin ? '700' : '500',
                    },
                  ]}
                >
                  Sign In
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleSwitchMode('register')}
                style={[
                  styles.segmentButton,
                  !isLogin && [
                    styles.segmentActiveButton,
                    { backgroundColor: colors.surfaceContainerLowest },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: !isLogin ? colors.textPrimary : colors.textMuted,
                      fontWeight: !isLogin ? '700' : '500',
                    },
                  ]}
                >
                  Register
                </Text>
              </Pressable>
            </View>
          </SlideUpItem>

          {/* Inline Error Notice */}
          {errorMessage && (
            <SlideUpItem index={2}>
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: isDark
                      ? 'rgba(186, 26, 26, 0.15)'
                      : '#FFEDEC',
                    borderColor: WattWiseTheme.colors.error,
                  },
                ]}
              >
                <Icon name="error" size={16} color={WattWiseTheme.colors.error} />
                <Text style={[styles.errorBannerText, { color: WattWiseTheme.colors.error }]}>
                  {errorMessage}
                </Text>
              </View>
            </SlideUpItem>
          )}

          {/* 3. Form Fields */}
          <SlideUpItem index={3} style={styles.formContainer}>
            {/* Full Name (Register Only) */}
            {!isLogin && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Full Name
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      borderColor: colors.borderSubtle,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="Your full name"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  autoCapitalize="words"
                />
              </View>
            )}

            {/* Email Address */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Email Address
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.borderSubtle,
                    color: colors.textPrimary,
                  },
                ]}
                placeholder="email@example.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Password {!isLogin && '(minimum 8 characters)'}
              </Text>
              <View
                style={[
                  styles.passwordContainer,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.borderSubtle,
                  },
                ]}
              >
                <TextInput
                  style={[styles.passwordInput, { color: colors.textPrimary }]}
                  placeholder={isLogin ? 'Enter your password' : 'Create a secure password'}
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={10}
                  style={styles.eyeButton}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon
                    name={showPassword ? 'visibility_off' : 'visibility'}
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
            </View>
          </SlideUpItem>

          {/* 4. Action Button */}
          <SlideUpItem index={4}>
            <Pressable
              onPress={handleSubmit}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.submitButton,
                {
                  backgroundColor: WattWiseTheme.colors.primary,
                  opacity: pressed || isLoading ? 0.85 : 1,
                },
              ]}
              accessibilityLabel={isLogin ? 'Sign in' : 'Create account'}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isLogin ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </Pressable>
          </SlideUpItem>

          {/* 5. Footer & Tour Link */}
          <SlideUpItem index={5} style={styles.footerBlock}>
            <Pressable
              onPress={() => router.replace('/onboarding')}
              hitSlop={10}
              style={({ pressed }) => [
                styles.tourLink,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityLabel="View Onboarding Walkthrough"
            >
              <Text style={[styles.tourLinkText, { color: colors.textSecondary }]}>
                First time using WattWise?{' '}
                <Text style={{ color: WattWiseTheme.colors.primary, fontWeight: '700' }}>
                  View Tour Guide
                </Text>
              </Text>
            </Pressable>

            <View style={styles.securityNote}>
              <Icon name="lock" size={13} color={colors.textMuted} />
              <Text style={[styles.securityNoteText, { color: colors.textMuted }]}>
                Encrypted on-device storage & secure session validation
              </Text>
            </View>
          </SlideUpItem>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 20,
  },
  brandHeader: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  brandLogoBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  segmentedSwitch: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentActiveButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  formContainer: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
  },
  eyeButton: {
    padding: 6,
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footerBlock: {
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
  },
  tourLink: {
    paddingVertical: 4,
  },
  tourLinkText: {
    fontSize: 13,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  securityNoteText: {
    fontSize: 11,
  },
});
