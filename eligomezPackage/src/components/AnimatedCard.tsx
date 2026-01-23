import React, { useRef } from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface AnimatedCardProps {
  title: string;
  icon: React.ReactNode;
  onPress: () => void;
  gradient?: [string, string];
  subtitle?: string;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({ 
  title, 
  icon, 
  onPress, 
  gradient = ['#667eea', '#764ba2'],
  subtitle
}) => {
  const { theme } = useTheme();
  const scale = (size: number) => theme.scale(size);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      friction: 5,
      tension: 40,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 40,
    }).start();
  };

  return (
    <Animated.View style={[{ flex: 1, transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        style={[
          {
            flex: 1,
            backgroundColor: gradient[0],
            borderColor: theme.colors.border,
            borderRadius: scale(20),
            padding: scale(16),
            justifyContent: 'space-between',
            minHeight: scale(140),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 6,
            borderWidth: 1,
            overflow: 'hidden',
          }
        ]}
      >
        <View style={{
          width: scale(48),
          height: scale(48),
          borderRadius: scale(14),
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          {icon}
        </View>
        <Text 
          style={{
            fontSize: scale(14),
            fontWeight: '800',
            color: '#fff',
            letterSpacing: -0.5,
            marginTop: scale(8),
          }} 
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {subtitle && (
          <Text 
            style={{
              fontSize: scale(12),
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.85)',
              letterSpacing: -0.2,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {subtitle}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};
