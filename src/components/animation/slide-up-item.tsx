import React, { useEffect, useRef, memo } from 'react';
import { Animated, StyleProp, ViewStyle, Easing } from 'react-native';

interface SlideUpItemProps {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  duration?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * SlideUpItem provides an ultra-fast, hardware-accelerated bottom-to-top
 * entrance animation for cards and details while keeping the screen still.
 * Memoized to prevent redundant renders.
 */
function SlideUpItemBase({
  children,
  index = 0,
  delay,
  duration = 160,
  distance = 18,
  style,
}: SlideUpItemProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;

    const computedDelay = delay !== undefined ? delay : Math.min(index * 20, 100);

    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        hasAnimated.current = true;
      });
    }, computedDelay);

    return () => clearTimeout(timer);
  }, [anim, delay, index, duration]);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [distance, 0],
  });

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export const SlideUpItem = memo(SlideUpItemBase);
