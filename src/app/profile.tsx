import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useTab } from '@/context/tab-context';

export default function ProfileRoute() {
  const { setTab } = useTab();

  useEffect(() => {
    setTab('profile');
    router.replace('/');
  }, [setTab]);

  return null;
}
