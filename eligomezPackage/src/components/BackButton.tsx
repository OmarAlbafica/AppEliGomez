import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

interface BackButtonProps {
  onPress: () => void;
  color?: string;
  size?: number;
}

export const BackButton: React.FC<BackButtonProps> = ({ onPress, color = '#667eea', size = 28 }) => {
  return (
    <TouchableOpacity 
      onPress={onPress}
      style={{ paddingHorizontal: 8, paddingVertical: 4, marginRight: 8 }}
    >
      <Text style={{ fontSize: size, color: color, fontWeight: 'bold' }}>←</Text>
    </TouchableOpacity>
  );
};
