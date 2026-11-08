import { apiClient } from '@/services/api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

export interface UserProfile {
  name: string;
  email: string;
  provider: string;
  householdType?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  isOnboarded: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (
    name: string,
    email: string,
    pass: string,
    provider?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetAllAuth: () => Promise<void>;
}

const STORAGE_KEY_ONBOARDED = '@wattwise_is_onboarded';
const STORAGE_KEY_AUTHENTICATED = '@wattwise_is_authenticated';
const STORAGE_KEY_USER = '@wattwise_user_profile';
const STORAGE_KEY_TOKEN = '@wattwise_auth_token';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStoredAuth() {
      try {
        const [onboardedRaw, authRaw, tokenRaw, userRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_ONBOARDED),
          AsyncStorage.getItem(STORAGE_KEY_AUTHENTICATED),
          AsyncStorage.getItem(STORAGE_KEY_TOKEN),
          AsyncStorage.getItem(STORAGE_KEY_USER),
        ]);

        if (!isMounted) return;

        const hasOnboarded = onboardedRaw === 'true';
        const isAuth = authRaw === 'true';

        setIsOnboarded(hasOnboarded);

        if (isAuth && tokenRaw) {
          // Verify live session against SQLite database
          try {
            const liveUser = await apiClient.getMe(tokenRaw);
            if (isMounted) {
              if (liveUser) {
                setUser({
                  name: liveUser.name,
                  email: liveUser.email,
                  provider: liveUser.provider,
                  avatarUrl: liveUser.avatarUrl,
                  householdType: liveUser.householdType,
                });
                setIsAuthenticated(true);
              } else {
                setIsAuthenticated(false);
                setUser(null);
              }
            }
          } catch {
            // Token expired or invalid: clear session
            if (isMounted) {
              setIsAuthenticated(false);
              setUser(null);
              await AsyncStorage.multiRemove([STORAGE_KEY_AUTHENTICATED, STORAGE_KEY_TOKEN, STORAGE_KEY_USER]);
            }
          }
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (e) {
        console.warn('Failed to load auth from storage:', e);
        if (isMounted) {
          setIsOnboarded(false);
          setIsAuthenticated(false);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStoredAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const completeOnboarding = useCallback(async () => {
    setIsOnboarded(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ONBOARDED, 'true');
    } catch (e) {
      console.warn('Failed to persist onboarding state:', e);
    }
  }, []);

  const resetOnboarding = useCallback(async () => {
    setIsOnboarded(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ONBOARDED, 'false');
    } catch (e) {
      console.warn('Failed to reset onboarding state:', e);
    }
  }, []);

  const loginWithEmail = useCallback(async (email: string, pass: string) => {
    const res = await apiClient.login(email, pass);
    const loggedUser: UserProfile = {
      name: res.user.name,
      email: res.user.email,
      householdType: res.user.householdType || 'Single Family',
      provider: res.user.provider || 'Household Account',
      avatarUrl:
        res.user.avatarUrl ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    };
    setUser(loggedUser);
    setIsAuthenticated(true);
    setIsOnboarded(true);
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_ONBOARDED, 'true'),
        AsyncStorage.setItem(STORAGE_KEY_AUTHENTICATED, 'true'),
        AsyncStorage.setItem(STORAGE_KEY_TOKEN, res.token),
        AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(loggedUser)),
      ]);
    } catch (e) {
      console.warn('Failed to persist login state:', e);
    }
  }, []);

  const registerWithEmail = useCallback(
    async (name: string, email: string, pass: string, provider?: string) => {
      const res = await apiClient.register(name, email, pass, provider);
      const newUser: UserProfile = {
        name: res.user.name,
        email: res.user.email,
        householdType: res.user.householdType || 'Single Family',
        provider: res.user.provider || provider || 'Household Account',
        avatarUrl:
          res.user.avatarUrl ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      };
      setUser(newUser);
      setIsAuthenticated(true);
      setIsOnboarded(true);
      try {
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEY_ONBOARDED, 'true'),
          AsyncStorage.setItem(STORAGE_KEY_AUTHENTICATED, 'true'),
          AsyncStorage.setItem(STORAGE_KEY_TOKEN, res.token),
          AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser)),
        ]);
      } catch (e) {
        console.warn('Failed to persist registration state:', e);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEY_TOKEN);
      if (token) {
        await apiClient.logout(token);
      }
    } catch {
      // safe ignore logout network error
    }

    setIsAuthenticated(false);
    setUser(null);
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_AUTHENTICATED, 'false'),
        AsyncStorage.removeItem(STORAGE_KEY_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEY_USER),
      ]);
    } catch (e) {
      console.warn('Failed to persist logout state:', e);
    }
  }, []);

  const resetAllAuth = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEY_TOKEN);
      if (token) {
        await apiClient.logout(token);
      }
    } catch {
      // safe ignore
    }

    setIsOnboarded(false);
    setIsAuthenticated(false);
    setUser(null);
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEY_ONBOARDED,
        STORAGE_KEY_AUTHENTICATED,
        STORAGE_KEY_TOKEN,
        STORAGE_KEY_USER,
      ]);
    } catch (e) {
      console.warn('Failed to reset all auth state:', e);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isOnboarded,
        isAuthenticated,
        isLoading,
        user,
        completeOnboarding,
        resetOnboarding,
        loginWithEmail,
        registerWithEmail,
        logout,
        resetAllAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
