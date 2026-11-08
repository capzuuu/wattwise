import React, { createContext, useContext, useState, ReactNode } from 'react';

export type TabKey = 'home' | 'breakdown' | 'scan' | 'insights' | 'profile';

interface TabContextType {
  currentTab: TabKey;
  setTab: (tab: TabKey, options?: { promptPreset?: string }) => void;
  promptPreset: string | null;
  clearPromptPreset: () => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function TabProvider({ children }: { children: ReactNode }) {
  const [currentTab, setCurrentTab] = useState<TabKey>('home');
  const [promptPreset, setPromptPreset] = useState<string | null>(null);

  const setTab = (tab: TabKey, options?: { promptPreset?: string }) => {
    setCurrentTab(tab);
    if (options?.promptPreset) {
      setPromptPreset(options.promptPreset);
    }
  };

  const clearPromptPreset = () => setPromptPreset(null);

  return (
    <TabContext.Provider value={{ currentTab, setTab, promptPreset, clearPromptPreset }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTab() {
  const context = useContext(TabContext);
  if (!context) {
    return {
      currentTab: 'home' as TabKey,
      setTab: () => {},
      promptPreset: null,
      clearPromptPreset: () => {},
    };
  }
  return context;
}

