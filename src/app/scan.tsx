import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useTab } from '@/context/tab-context';

export default function ScanRoute() {
  const { setTab } = useTab();

  useEffect(() => {
    setTab('scan');
    router.replace('/');
  }, [setTab]);

  return null;
}
