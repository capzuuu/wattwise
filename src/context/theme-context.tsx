import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  THEME_PALETTES,
  ThemePreset,
  ThemeMode,
  WattWiseTheme,
} from '@/constants/theme';

export type ThemePalette = {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  surfaceDim: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  onSurface: string;
  onSurfaceVariant: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  card: string;
  navBackground: string;
  tabActive: string;
  tabInactive: string;
  badgeBg: string;
  badgeText: string;
  code: string;
};

interface ThemeContextType {
  mode: ThemeMode;
  preset: ThemePreset;
  isDark: boolean;
  colors: ThemePalette;
  setMode: (mode: ThemeMode) => Promise<void>;
  setPreset: (preset: ThemePreset) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const STORAGE_KEY_MODE = '@wattwise_theme_mode';
const STORAGE_KEY_PRESET = '@wattwise_theme_preset';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const deviceColorScheme = useDeviceColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [preset, setPresetState] = useState<ThemePreset>('cobalt');

  useEffect(() => {
    let isMounted = true;
    async function loadStoredTheme() {
      try {
        const [storedMode, storedPreset] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_MODE),
          AsyncStorage.getItem(STORAGE_KEY_PRESET),
        ]);
        if (!isMounted) return;

        if (storedMode === 'system' || storedMode === 'light' || storedMode === 'dark') {
          setModeState(storedMode);
        } else {
          setModeState('light');
        }
        if (
          storedPreset === 'cobalt' ||
          storedPreset === 'emerald' ||
          storedPreset === 'midnight' ||
          storedPreset === 'amber'
        ) {
          setPresetState(storedPreset);
        } else {
          setPresetState('cobalt');
        }
      } catch (e) {
        console.warn('Failed to load theme preference:', e);
      }
    }
    loadStoredTheme();
    return () => {
      isMounted = false;
    };
  }, []);

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_MODE, newMode);
    } catch (e) {
      console.warn('Failed to persist theme mode:', e);
    }
  }, []);

  const setPreset = useCallback(async (newPreset: ThemePreset) => {
    setPresetState(newPreset);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_PRESET, newPreset);
    } catch (e) {
      console.warn('Failed to persist theme preset:', e);
    }
  }, []);

  const isDark = useMemo(() => {
    if (mode === 'system') {
      return deviceColorScheme === 'dark';
    }
    return mode === 'dark';
  }, [mode, deviceColorScheme]);

  const toggleTheme = useCallback(async () => {
    const nextMode: ThemeMode = isDark ? 'light' : 'dark';
    await setMode(nextMode);
  }, [isDark, setMode]);

  const colors: ThemePalette = useMemo(() => {
    const paletteSet = THEME_PALETTES[preset] || THEME_PALETTES.cobalt;
    return (isDark ? paletteSet.dark : paletteSet.light) as ThemePalette;
  }, [preset, isDark]);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        preset,
        isDark,
        colors,
        setMode,
        setPreset,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      mode: 'system' as ThemeMode,
      preset: 'cobalt' as ThemePreset,
      isDark: false,
      colors: WattWiseTheme.colors.light as ThemePalette,
      setMode: async () => {},
      setPreset: async () => {},
      toggleTheme: async () => {},
    };
  }
  return context;
}
