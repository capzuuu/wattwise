import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, MonthlyConsumptionItem, UtilityTelemetryItem } from './api-client';

export interface ItemizedCharge {
  name: string;
  amount: string;
  amountNumeric: number;
  tagalog: string;
  desc: string;
  percentage: number;
  color: string;
  rate: string;
  category: 'generation' | 'transmission' | 'distribution' | 'system_loss' | 'subsidies';
}

export interface ApplianceTelemetry {
  id: string;
  name: string;
  monthlyCost: string;
  costNumeric: number;
  monthlyKwh: string;
  kwhNumeric: number;
  percentage: number;
  meta: string;
  icon: 'mode_fan' | 'kitchen' | 'payments' | 'bolt' | 'tv';
}

export interface StatementData {
  id: string;
  provider: string;
  accountNo: string;
  period: string;
  days: number;
  dueDate: string;
  amountDue: string;
  amountDueNumeric: number;
  consumptionKwh: number;
  effectiveRate: string;
  rateNumeric: number;
  generationAdjustment: string;
  utilityType?: 'electricity' | 'water' | 'wifi';
}

export type UtilityTypeKey = 'electricity' | 'water' | 'wifi';

export interface UtilityBillingEntry {
  statement: StatementData;
  charges: ItemizedCharge[];
}

const EMPTY_STATEMENT: StatementData = {
  id: '',
  provider: 'Loading Utility...',
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
  utilityType: 'electricity',
};

const STORAGE_KEY_STORE_CACHE = '@wattwise_billing_store_cache';

interface BillingStoreContextType {
  statement: StatementData;
  charges: ItemizedCharge[];
  appliances: ApplianceTelemetry[];
  targetBudget: string;
  isScheduleApplied: boolean;
  isLoading: boolean;
  activeUtility: UtilityTypeKey;
  utilityMap: Record<UtilityTypeKey, UtilityBillingEntry>;
  telemetry: Record<'elec' | 'water' | 'wifi', UtilityTelemetryItem> | null;
  monthlyHistory: Record<'elec' | 'water' | 'wifi', MonthlyConsumptionItem[]> | null;
  setStatement: (stmt: StatementData) => void;
  setCharges: (charges: ItemizedCharge[]) => void;
  setTargetBudget: (budget: string) => void;
  applyThermostatSchedule: () => void;
  resetThermostatSchedule: () => void;
  updateProvider: (providerName: string) => void;
  loadVerifiedBill: (stmt: StatementData, chargesList: ItemizedCharge[]) => void;
  loadStatementByUtility: (type: UtilityTypeKey) => Promise<void>;
  selectUtility: (type: UtilityTypeKey) => void;
  refreshFromDatabase: () => Promise<void>;
}

const BillingStoreContext = createContext<BillingStoreContextType | undefined>(undefined);

export function BillingStoreProvider({ children }: { children: ReactNode }) {
  const [activeUtility, setActiveUtility] = useState<UtilityTypeKey>('electricity');
  const [isLoading, setIsLoading] = useState(true);
  const [utilityMap, setUtilityMap] = useState<Record<UtilityTypeKey, UtilityBillingEntry>>({
    electricity: { statement: EMPTY_STATEMENT, charges: [] },
    water: { statement: { ...EMPTY_STATEMENT, utilityType: 'water', provider: 'Water Utility' }, charges: [] },
    wifi: { statement: { ...EMPTY_STATEMENT, utilityType: 'wifi', provider: 'Fiber Broadband' }, charges: [] },
  });
  const [statement, setStatement] = useState<StatementData>(EMPTY_STATEMENT);
  const [charges, setCharges] = useState<ItemizedCharge[]>([]);
  const [appliances, setAppliances] = useState<ApplianceTelemetry[]>([]);
  const [targetBudget, setTargetBudget] = useState('₱4,500');
  const [isScheduleApplied, setIsScheduleApplied] = useState(false);
  const [telemetry, setTelemetry] = useState<Record<'elec' | 'water' | 'wifi', UtilityTelemetryItem> | null>(null);
  const [monthlyHistory, setMonthlyHistory] = useState<Record<'elec' | 'water' | 'wifi', MonthlyConsumptionItem[]> | null>(null);

  // Load persisted cache on cold boot before network resolution
  useEffect(() => {
    async function loadStoredCache() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY_STORE_CACHE);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached.utilityMap) setUtilityMap(cached.utilityMap);
          if (cached.statement) setStatement(cached.statement);
          if (cached.charges?.length) setCharges(cached.charges);
          if (cached.appliances?.length) setAppliances(cached.appliances);
          if (cached.telemetry) setTelemetry(cached.telemetry);
          if (cached.monthlyHistory) setMonthlyHistory(cached.monthlyHistory);
          if (cached.targetBudget) setTargetBudget(cached.targetBudget);
          if (cached.isScheduleApplied !== undefined) setIsScheduleApplied(cached.isScheduleApplied);
        }
      } catch {
        // Cache read failure
      }
    }
    loadStoredCache();
  }, []);

  // Synchronize store directly with SQLite database
  const refreshFromDatabase = useCallback(async () => {
    try {
      const [allBills, appRes, telemRes, monthlyRes, profRes] = await Promise.all([
        apiClient.getAllUtilityBills(),
        apiClient.getAppliances(),
        apiClient.getUtilityTelemetry(),
        apiClient.getAllMonthlyConsumption(),
        apiClient.getProfile(),
      ]);

      let newMap = utilityMap;
      let newStmt = statement;
      let newCharges = charges;

      if (allBills && (allBills.electricity || allBills.water || allBills.wifi)) {
        newMap = allBills;
        setUtilityMap(allBills);
        const currentActive = allBills[activeUtility] || allBills.electricity;
        if (currentActive?.statement) {
          newStmt = currentActive.statement;
          setStatement(currentActive.statement);
        }
        if (currentActive?.charges?.length) {
          newCharges = currentActive.charges;
          setCharges(currentActive.charges);
        }
      }

      if (appRes && Array.isArray(appRes)) {
        setAppliances(appRes);
      }
      if (telemRes) setTelemetry(telemRes);
      if (monthlyRes) setMonthlyHistory(monthlyRes);
      if (profRes?.targetBudget) setTargetBudget(profRes.targetBudget);
      if (profRes?.isScheduleApplied !== undefined) setIsScheduleApplied(profRes.isScheduleApplied);

      // Persist live SQLite response to on-device AsyncStorage cache
      await AsyncStorage.setItem(
        STORAGE_KEY_STORE_CACHE,
        JSON.stringify({
          utilityMap: newMap,
          statement: newStmt,
          charges: newCharges,
          appliances: appRes || [],
          telemetry: telemRes,
          monthlyHistory: monthlyRes,
          targetBudget: profRes?.targetBudget || '₱4,500',
          isScheduleApplied: profRes?.isScheduleApplied || false,
        })
      );
    } catch {
      // Keep cached state
    } finally {
      setIsLoading(false);
    }
  }, [activeUtility, charges, statement, utilityMap]);

  useEffect(() => {
    refreshFromDatabase();
  }, [refreshFromDatabase]);

  /**
   * Switches active utility statement immediately from database cache.
   * Performs 0 network/API requests to guarantee instantaneous, zero-latency tab switching.
   */
  const selectUtility = useCallback(
    (type: UtilityTypeKey) => {
      setActiveUtility(type);
      const entry = utilityMap[type];
      if (entry && entry.statement?.id) {
        setStatement(entry.statement);
        setCharges(entry.charges || []);
      }
    },
    [utilityMap]
  );

  const loadStatementByUtility = useCallback(
    (type: UtilityTypeKey): Promise<void> => {
      selectUtility(type);
      return Promise.resolve();
    },
    [selectUtility]
  );

  const applyThermostatSchedule = useCallback(async () => {
    setIsScheduleApplied(true);
    try {
      const res = await apiClient.optimizeThermostat(25);
      if (res.updatedAppliances?.length) {
        setAppliances(res.updatedAppliances);
        return;
      }
    } catch {
      // offline
    }
  }, []);

  const resetThermostatSchedule = useCallback(async () => {
    setIsScheduleApplied(false);
    try {
      await apiClient.resetThermostat();
      const apps = await apiClient.getAppliances();
      if (apps?.length) {
        setAppliances(apps);
        return;
      }
    } catch {
      // offline
    }
  }, []);

  const updateProvider = useCallback((providerName: string) => {
    setStatement((prev) => ({
      ...prev,
      provider: providerName,
    }));
  }, []);

  const loadVerifiedBill = useCallback((stmt: StatementData, chargesList: ItemizedCharge[]) => {
    const uType = (stmt.utilityType as UtilityTypeKey) || 'electricity';
    setUtilityMap((prev) => ({
      ...prev,
      [uType]: { statement: stmt, charges: chargesList },
    }));
    setActiveUtility(uType);
    setStatement(stmt);
    setCharges(chargesList);
    apiClient.setCachedBill(uType, { statement: stmt, charges: chargesList });
  }, []);

  const value = useMemo(
    () => ({
      statement,
      charges,
      appliances,
      targetBudget,
      isScheduleApplied,
      isLoading,
      activeUtility,
      utilityMap,
      telemetry,
      monthlyHistory,
      setStatement,
      setCharges,
      setTargetBudget,
      applyThermostatSchedule,
      resetThermostatSchedule,
      updateProvider,
      loadVerifiedBill,
      loadStatementByUtility,
      selectUtility,
      refreshFromDatabase,
    }),
    [
      statement,
      charges,
      appliances,
      targetBudget,
      isScheduleApplied,
      isLoading,
      activeUtility,
      utilityMap,
      telemetry,
      monthlyHistory,
      applyThermostatSchedule,
      resetThermostatSchedule,
      updateProvider,
      loadVerifiedBill,
      loadStatementByUtility,
      selectUtility,
      refreshFromDatabase,
    ]
  );

  return (
    <BillingStoreContext.Provider value={value}>
      {children}
    </BillingStoreContext.Provider>
  );
}

export function useBillingStore() {
  const context = useContext(BillingStoreContext);
  if (!context) {
    throw new Error('useBillingStore must be used within a BillingStoreProvider');
  }
  return context;
}
