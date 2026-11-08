import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { StatementData, ItemizedCharge, ApplianceTelemetry } from './billing-store';

export const STORAGE_KEY_API_URL = '@wattwise_api_url';

// Auto-detect local development server for both emulators and physical devices
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
export const DEFAULT_API_BASE_URL = devHost
  ? `http://${devHost}:8000`
  : Platform.select({
      android: 'http://10.0.2.2:8000',
      default: 'http://localhost:8000',
    });

export interface ApiHealthResponse {
  status: string;
  service: string;
  version: string;
  uptimeSeconds?: number;
  memoryUsageMb?: number;
  timestamp: string;
  supportedUtilities: string[];
}

export interface BillAnalysisResult {
  success: boolean;
  statement: StatementData;
  charges: ItemizedCharge[];
  anomalies: string[];
  coolingLoadEstimate?: string;
  confidenceScore: number;
  processedAt: string;
}

export interface ChatApiResponse {
  reply: string;
  showBreakdown: boolean;
  savingsEstimate?: string;
  suggestions: string[];
  timestamp: string;
}

export interface SuggestedPromptItem {
  id: string;
  text: string;
  category: 'electricity' | 'water' | 'wifi' | 'appliances' | 'history';
}

export interface OnboardingSlideItem {
  id: string;
  badge: string;
  title: string;
  description: string;
  sort_order: number;
  visual_type: string;
}

export interface RecentBillItem {
  id: string;
  provider: string;
  type: 'electricity' | 'water' | 'wifi';
  accountNo: string;
  period: string;
  amount: string;
  metric: string;
  status: 'Due Soon' | 'Paid';
  title?: string;
  date?: string;
}

export interface NotificationItem {
  id: string;
  category: 'bills' | 'usage' | 'appliances';
  title: string;
  body: string;
  timestamp: string;
  section: 'Today' | 'Earlier';
  icon: any;
  read: boolean;
  actionLabel?: string;
  actionTab?: 'breakdown' | 'insights' | 'profile' | 'scan';
}

export interface MonthlyConsumptionItem {
  month: string;
  val2024: number;
  val2023: number;
  kwh: number;
  bill: string;
  isCurrent?: boolean;
}

export interface UtilityTelemetryItem {
  name: string;
  unit: string;
  stat: string;
  trend: string;
  estBill: string;
  dueDate: string;
  dailyAvg: string;
  dailyUnit: string;
  dailyVs: string;
  forecast: string;
  forecastSub: string;
  carbon: string;
  carbonUnit: string;
  carbonSub: string;
  cycleLabel: string;
}

export interface ChatMessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  showBreakdown?: boolean;
  savingsEstimate?: string;
}

export interface UserProfileResponse {
  displayName: string;
  email: string;
  householdType: string;
  targetBudget: string;
  isScheduleApplied: boolean;
}

export interface SQLiteStatus {
  status: string;
  journalMode: string;
  concurrency: string;
  unsyncedItems: number;
  databasePath: string;
  totalStatements?: number;
  totalAppliances?: number;
  totalNotifications?: number;
}

export interface SupabaseStatus {
  configured: boolean;
  connected: boolean;
  cloudProvider: string;
  url: string;
}

export interface DatabaseStatusResponse {
  mode: string;
  sqlite: SQLiteStatus;
  supabase: SupabaseStatus;
  lastSyncedAt: string;
}

export interface DatabaseSyncResponse {
  success: boolean;
  status: string;
  message: string;
  pendingSyncCount: number;
  syncedRecords: number;
  timestamp: string;
}

export interface UserAuthData {
  id: string;
  name: string;
  email: string;
  provider: string;
  householdType: string;
  avatarUrl?: string;
  role: string;
}

export interface AuthApiResponse {
  ok: boolean;
  message: string;
  user: UserAuthData;
  token: string;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Persistent on-device cache storage keys for offline-first SQLite synchronization
const CACHE_KEY_BILLS = '@wattwise_cache_bills';
const CACHE_KEY_ALL_UTILITIES = '@wattwise_cache_all_utilities';
const CACHE_KEY_APPLIANCES = '@wattwise_cache_appliances';
const CACHE_KEY_NOTIFICATIONS = '@wattwise_cache_notifications';
const CACHE_KEY_MONTHLY = '@wattwise_cache_monthly';
const CACHE_KEY_TELEMETRY = '@wattwise_cache_telemetry';
const CACHE_KEY_ONBOARDING = '@wattwise_cache_onboarding';
const CACHE_KEY_PROMPTS = '@wattwise_cache_prompts';
const CACHE_KEY_PROFILE = '@wattwise_cache_profile';

class ApiClient {
  private customBaseUrl: string | null = null;
  private healthCache: CacheEntry<{ ok: boolean; data?: ApiHealthResponse; latencyMs?: number }> | null = null;
  private inFlightHealth: Promise<{ ok: boolean; data?: ApiHealthResponse; latencyMs?: number }> | null = null;
  private promptsCache: CacheEntry<SuggestedPromptItem[]> | null = null;
  private billCache = new Map<string, CacheEntry<{ statement: StatementData; charges: ItemizedCharge[] }>>();
  private allUtilitiesCache: CacheEntry<Record<'electricity' | 'water' | 'wifi', { statement: StatementData; charges: ItemizedCharge[] }>> | null = null;

  private async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private async setCachedData<T>(key: string, data: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch {
      // Storage write error
    }
  }

  async getBaseUrl(): Promise<string> {
    if (this.customBaseUrl) return this.customBaseUrl;
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY_API_URL);
      if (saved && saved.trim()) {
        const clean = saved.trim().replace(/\/$/, '');
        if (/^https?:\/\//i.test(clean)) {
          this.customBaseUrl = clean;
          return clean;
        }
      }
    } catch {
      // Fallback to default
    }
    return DEFAULT_API_BASE_URL;
  }

  async setBaseUrl(url: string): Promise<boolean> {
    const cleanUrl = url.trim().replace(/\/$/, '');
    if (!/^https?:\/\/([a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\])(:[0-9]+)?$/i.test(cleanUrl)) {
      return false;
    }
    this.customBaseUrl = cleanUrl;
    this.healthCache = null;
    await AsyncStorage.setItem(STORAGE_KEY_API_URL, cleanUrl);
    return true;
  }

  async checkHealth(forceRefresh: boolean = false): Promise<{ ok: boolean; data?: ApiHealthResponse; latencyMs?: number }> {
    const now = Date.now();
    if (!forceRefresh && this.healthCache && this.healthCache.expiresAt > now) {
      return this.healthCache.data;
    }

    if (this.inFlightHealth) {
      return this.inFlightHealth;
    }

    this.inFlightHealth = (async () => {
      const start = Date.now();
      try {
        const base = await this.getBaseUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(`${base}/api/health`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const failure = { ok: false };
          this.healthCache = { data: failure, expiresAt: now + 5000 };
          return failure;
        }

        const data: ApiHealthResponse = await res.json();
        const success = { ok: true, data, latencyMs: Date.now() - start };
        this.healthCache = { data: success, expiresAt: now + 10000 };
        return success;
      } catch {
        const failure = { ok: false };
        this.healthCache = { data: failure, expiresAt: now + 5000 };
        return failure;
      } finally {
        this.inFlightHealth = null;
      }
    })();

    return this.inFlightHealth;
  }

  async analyzeBill(
    utilityType: 'electricity' | 'water' | 'wifi' = 'electricity',
    fileUri?: string
  ): Promise<BillAnalysisResult> {
    const base = await this.getBaseUrl();

    try {
      if (fileUri && !fileUri.startsWith('http')) {
        const formData = new FormData();
        const filename = fileUri.split('/').pop() || 'statement.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('file', {
          uri: fileUri,
          name: filename,
          type,
        } as any);
        formData.append('utilityType', utilityType);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

        const res = await fetch(`${base}/api/bills/analyze`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const result = (await res.json()) as BillAnalysisResult;
          this.setCachedBill(utilityType, { statement: result.statement, charges: result.charges });
          return result;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${base}/api/bills/analyze-json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ utilityType }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const result = (await res.json()) as BillAnalysisResult;
        this.setCachedBill(utilityType, { statement: result.statement, charges: result.charges });
        return result;
      }
    } catch {
      // offline fallback to database cache
    }

    // Retrieve from database cache
    const current = await this.getCurrentBill(utilityType);
    return {
      success: true,
      statement: current.statement,
      charges: current.charges,
      anomalies: ['Retrieved from secure on-device storage.'],
      confidenceScore: 0.95,
      processedAt: 'Offline Cached Mode',
    };
  }

  async sendChatMessage(
    message: string,
    utilityFilter: 'all' | 'elec' | 'water' | 'wifi' = 'all'
  ): Promise<ChatApiResponse> {
    const cleanMessage = message.trim().slice(0, 1500);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ message: cleanMessage, utilityFilter }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return (await res.json()) as ChatApiResponse;
      }
    } catch {
      // offline
    }

    return {
      reply: 'WattWise AI Assistant is currently in offline mode. Live telemetries will resume once the server connection is restored.',
      showBreakdown: false,
      suggestions: ['Check storage sync status', 'View stored bills'],
      timestamp: now,
    };
  }

  async getSuggestedPrompts(): Promise<SuggestedPromptItem[]> {
    const now = Date.now();
    if (this.promptsCache && this.promptsCache.expiresAt > now) {
      return this.promptsCache.data;
    }

    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${base}/api/chat/suggested-prompts`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as SuggestedPromptItem[];
        this.promptsCache = { data, expiresAt: now + 600000 };
        await this.setCachedData(CACHE_KEY_PROMPTS, data);
        return data;
      }
    } catch {
      // offline
    }

    const cached = await this.getCachedData<SuggestedPromptItem[]>(CACHE_KEY_PROMPTS);
    return cached || [];
  }

  async getOnboardingSlides(): Promise<OnboardingSlideItem[]> {
    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${base}/api/onboarding`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as OnboardingSlideItem[];
        await this.setCachedData(CACHE_KEY_ONBOARDING, data);
        return data;
      }
    } catch {
      // offline
    }

    const cached = await this.getCachedData<OnboardingSlideItem[]>(CACHE_KEY_ONBOARDING);
    return cached || [];
  }

  async optimizeThermostat(temp: number = 25): Promise<{ success: boolean; isScheduleApplied: boolean; updatedAppliances?: ApplianceTelemetry[] }> {
    try {
      const base = await this.getBaseUrl();
      const res = await fetch(`${base}/api/appliances/thermostat/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ temperatureCelsius: temp }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          isScheduleApplied: true,
          updatedAppliances: data.appliances,
        };
      }
    } catch {
      // offline
    }
    return { success: true, isScheduleApplied: true };
  }

  async resetThermostat(): Promise<{ success: boolean; isScheduleApplied: boolean }> {
    try {
      const base = await this.getBaseUrl();
      const res = await fetch(`${base}/api/appliances/thermostat/reset`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        return { success: true, isScheduleApplied: false };
      }
    } catch {
      // offline
    }
    return { success: true, isScheduleApplied: false };
  }

  async getCurrentBill(
    utilityType?: 'electricity' | 'water' | 'wifi',
    forceRefresh: boolean = false
  ): Promise<{ statement: StatementData; charges: ItemizedCharge[] }> {
    const key = utilityType || 'electricity';
    const now = Date.now();

    if (!forceRefresh) {
      const cached = this.billCache.get(key);
      if (cached && cached.expiresAt > now) {
        return cached.data;
      }
    }

    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const url = utilityType ? `${base}/api/bills/current?utilityType=${utilityType}` : `${base}/api/bills/current`;

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as { statement: StatementData; charges: ItemizedCharge[] };
        this.billCache.set(key, { data, expiresAt: now + 600000 });
        return data;
      }
    } catch {
      // offline
    }

    const all = await this.getAllUtilityBills();
    if (all && all[key]) {
      return all[key];
    }

    return {
      statement: {
        id: '',
        provider: 'Utility Statement',
        accountNo: '',
        period: '',
        days: 30,
        dueDate: '',
        amountDue: '₱0.00',
        amountDueNumeric: 0,
        consumptionKwh: 0,
        effectiveRate: '₱0.00',
        rateNumeric: 0,
        generationAdjustment: '₱0.00',
        utilityType: key,
      },
      charges: [],
    };
  }

  async getAllUtilityBills(
    forceRefresh: boolean = false
  ): Promise<Record<'electricity' | 'water' | 'wifi', { statement: StatementData; charges: ItemizedCharge[] }>> {
    const now = Date.now();
    if (!forceRefresh && this.allUtilitiesCache && this.allUtilitiesCache.expiresAt > now) {
      return this.allUtilitiesCache.data;
    }

    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${base}/api/bills/all-utilities`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as Record<'electricity' | 'water' | 'wifi', { statement: StatementData; charges: ItemizedCharge[] }>;
        for (const [key, val] of Object.entries(data)) {
          this.billCache.set(key, { data: val, expiresAt: now + 600000 });
        }
        this.allUtilitiesCache = { data, expiresAt: now + 600000 };
        await this.setCachedData(CACHE_KEY_ALL_UTILITIES, data);
        return data;
      }
    } catch {
      // offline
    }

    const cached = await this.getCachedData<Record<'electricity' | 'water' | 'wifi', { statement: StatementData; charges: ItemizedCharge[] }>>(
      CACHE_KEY_ALL_UTILITIES
    );
    if (cached) {
      this.allUtilitiesCache = { data: cached, expiresAt: now + 600000 };
      return cached;
    }

    return {} as any;
  }

  setCachedBill(
    utilityType: 'electricity' | 'water' | 'wifi',
    data: { statement: StatementData; charges: ItemizedCharge[] }
  ): void {
    const now = Date.now();
    this.billCache.set(utilityType, { data, expiresAt: now + 600000 });
    if (this.allUtilitiesCache?.data) {
      this.allUtilitiesCache.data[utilityType] = data;
    }
  }

  async getRecentBills(): Promise<RecentBillItem[]> {
    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${base}/api/bills`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as RecentBillItem[];
        await this.setCachedData(CACHE_KEY_BILLS, data);
        return data;
      }
    } catch {
      // offline
    }

    const cached = await this.getCachedData<RecentBillItem[]>(CACHE_KEY_BILLS);
    return cached || [];
  }

  async getAppliances(): Promise<ApplianceTelemetry[]> {
    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${base}/api/appliances`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as ApplianceTelemetry[];
        await this.setCachedData(CACHE_KEY_APPLIANCES, data);
        return data;
      }
    } catch {
      // offline
    }

    const cached = await this.getCachedData<ApplianceTelemetry[]>(CACHE_KEY_APPLIANCES);
    return cached || [];
  }

  async getNotifications(): Promise<NotificationItem[]> {
    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${base}/api/notifications`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as NotificationItem[];
        await this.setCachedData(CACHE_KEY_NOTIFICATIONS, data);
        return data;
      }
    } catch {
      // offline
    }

    const cached = await this.getCachedData<NotificationItem[]>(CACHE_KEY_NOTIFICATIONS);
    return cached || [];
  }

  async markNotificationRead(id: string): Promise<boolean> {
    try {
      const base = await this.getBaseUrl();
      const res = await fetch(`${base}/api/notifications/${id}/read`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      return res.ok;
    } catch {
      return true;
    }
  }

  async markAllNotificationsRead(): Promise<boolean> {
    try {
      const base = await this.getBaseUrl();
      const res = await fetch(`${base}/api/notifications/read-all`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      return res.ok;
    } catch {
      return true;
    }
  }

  async getMonthlyConsumption(utilityType?: string): Promise<MonthlyConsumptionItem[]> {
    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const url = utilityType ? `${base}/api/bills/monthly?utilityType=${utilityType}` : `${base}/api/bills/monthly`;

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return (await res.json()) as MonthlyConsumptionItem[];
      }
    } catch {
      // offline
    }

    const all = await this.getAllMonthlyConsumption();
    const key = utilityType === 'water' ? 'water' : utilityType === 'wifi' ? 'wifi' : 'elec';
    return all[key] || [];
  }

  async getAllMonthlyConsumption(): Promise<Record<'elec' | 'water' | 'wifi', MonthlyConsumptionItem[]>> {
    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${base}/api/bills/all-monthly`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as Record<'elec' | 'water' | 'wifi', MonthlyConsumptionItem[]>;
        await this.setCachedData(CACHE_KEY_MONTHLY, data);
        return data;
      }
    } catch {
      // offline
    }

    const cached = await this.getCachedData<Record<'elec' | 'water' | 'wifi', MonthlyConsumptionItem[]>>(CACHE_KEY_MONTHLY);
    return cached || { elec: [], water: [], wifi: [] };
  }

  async getUtilityTelemetry(): Promise<Record<'elec' | 'water' | 'wifi', UtilityTelemetryItem>> {
    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${base}/api/bills/telemetry`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as Record<'elec' | 'water' | 'wifi', UtilityTelemetryItem>;
        await this.setCachedData(CACHE_KEY_TELEMETRY, data);
        return data;
      }
    } catch {
      // offline
    }

    const cached = await this.getCachedData<Record<'elec' | 'water' | 'wifi', UtilityTelemetryItem>>(CACHE_KEY_TELEMETRY);
    return cached || ({} as any);
  }

  async getChatHistory(limit: number = 50): Promise<ChatMessageItem[]> {
    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${base}/api/chat/history?limit=${limit}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return (await res.json()) as ChatMessageItem[];
      }
    } catch {
      // offline
    }
    return [];
  }

  async getProfile(): Promise<UserProfileResponse | null> {
    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${base}/api/profile`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as UserProfileResponse;
        await this.setCachedData(CACHE_KEY_PROFILE, data);
        return data;
      }
    } catch {
      // offline
    }

    return await this.getCachedData<UserProfileResponse>(CACHE_KEY_PROFILE);
  }

  async getDatabaseStatus(): Promise<DatabaseStatusResponse> {
    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${base}/api/database/status`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return (await res.json()) as DatabaseStatusResponse;
      }
    } catch {
      // offline
    }

    return {
      mode: 'offline_local_cache',
      sqlite: {
        status: 'offline_cache',
        journalMode: 'WAL',
        concurrency: 'Local Replica',
        unsyncedItems: 0,
        databasePath: 'backend/data/wattwise.db',
      },
      supabase: {
        configured: false,
        connected: false,
        cloudProvider: 'Supabase PostgreSQL',
        url: 'Unreachable offline',
      },
      lastSyncedAt: 'Never',
    };
  }

  async syncDatabase(): Promise<DatabaseSyncResponse> {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${base}/api/database/sync`, {
        method: 'POST',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return (await res.json()) as DatabaseSyncResponse;
      }
    } catch {
      // offline
    }

    return {
      success: true,
      status: 'offline_mode',
      message: 'Local offline storage is operational. Cloud sync queued.',
      pendingSyncCount: 0,
      syncedRecords: 0,
      timestamp: now,
    };
  }

  async login(email: string, password: string): Promise<AuthApiResponse> {
    const base = await this.getBaseUrl();
    const cleanEmail = email.trim().toLowerCase();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email: cleanEmail, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return (await res.json()) as AuthApiResponse;
      }

      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'Invalid email or password.');
    } catch (e: any) {
      if (e.message && !e.message.toLowerCase().includes('network') && !e.message.toLowerCase().includes('failed to fetch')) {
        throw e;
      }
      throw new Error(
        `Unable to reach WattWise authentication server at ${base}. Please ensure the backend server is running.`
      );
    }
  }

  async register(name: string, email: string, password: string, householdType?: string): Promise<AuthApiResponse> {
    const base = await this.getBaseUrl();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password,
          householdType: householdType || 'Residential Household',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return (await res.json()) as AuthApiResponse;
      }

      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'Registration failed.');
    } catch (e: any) {
      if (e.message && !e.message.toLowerCase().includes('network') && !e.message.toLowerCase().includes('failed to fetch')) {
        throw e;
      }
      throw new Error(
        `Unable to reach WattWise authentication server at ${base}. Please ensure the backend server is running.`
      );
    }
  }

  async getMe(token: string): Promise<UserAuthData | null> {
    try {
      const base = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${base}/api/auth/me`, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return data.user as UserAuthData;
      }
    } catch {
      // offline
    }
    return null;
  }

  async logout(token: string): Promise<boolean> {
    try {
      const base = await this.getBaseUrl();
      const res = await fetch(`${base}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      return res.ok;
    } catch {
      return true;
    }
  }
}

export const apiClient = new ApiClient();
