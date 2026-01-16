import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ListItemCardProps {
  title: string;
  subtitle?: string;
  details?: Array<{ icon?: React.ReactNode; text: string }>;
  onPress?: () => void;
  leftColor?: string;
  actions?: React.ReactNode;
}

export const ListItemCard: React.FC<ListItemCardProps> = ({
  title,
  subtitle,
  details = [],
  onPress,
  leftColor,
  actions,
}) => {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (onPress) {
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
        friction: 6,
        tension: 40,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 40,
      }).start();
    }
  };

  const CardContent = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        leftColor && { borderLeftWidth: 4, borderLeftColor: leftColor },
      ]}
    >
      <View style={styles.cardContent}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        {details.length > 0 && (
          <View style={styles.detailsContainer}>
            {details.map((detail, index) => (
              <View key={index} style={styles.detailRow}>
                {detail.icon}
                <Text style={[styles.detailText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {detail.text}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      {actions && <View style={styles.actionsContainer}>{actions}</View>}
    </View>
  );

  if (onPress) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
        >
          {CardContent}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return <View>{CardContent}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
  },
  cardContent: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  detailsContainer: {
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
    flex: 1,
  },
  actionsContainer: {
    marginTop: 12,
  },
});
