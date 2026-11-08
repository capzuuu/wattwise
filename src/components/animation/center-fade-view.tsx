import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, ViewStyle } from 'react-native';

interface CenterFadeViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  initialScale?: number;
}

/**
 * CenterFadeView provides an ultra-fast, hardware-accelerated
 * fade and subtle expansion directly from the center of the screen
 * for snappy 60fps/120fps tab transitions.
 */
export function CenterFadeView({
  children,
  style,
  duration = 140,
  initialScale = 0.975,
}: CenterFadeViewProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, duration]);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [initialScale, 1],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
