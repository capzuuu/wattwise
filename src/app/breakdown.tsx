import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useTab } from '@/context/tab-context';

export default function BreakdownRoute() {
  const { setTab } = useTab();

  useEffect(() => {
    setTab('breakdown');
    router.replace('/');
  }, [setTab]);

  return null;
}
