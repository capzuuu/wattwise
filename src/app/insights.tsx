import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useTab } from '@/context/tab-context';

export default function InsightsRoute() {
  const { setTab } = useTab();

  useEffect(() => {
    setTab('insights');
    router.replace('/');
  }, [setTab]);

  return null;
}
