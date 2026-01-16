import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface HistoryIconProps {
  size?: number;
  color?: string;
}

export const HistoryIcon: React.FC<HistoryIconProps> = ({ size = 24, color = '#000' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M12 7V12L15 15"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
