import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface PhoneIconProps {
  size?: number;
  color?: string;
}

export const PhoneIcon: React.FC<PhoneIconProps> = ({ size = 24, color = '#000' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.92V19.92C22 20.4696 21.5523 20.92 21.0027 20.92C9.95032 20.4367 1.56282 12.0493 1.07954 1.00001C1.07954 0.450333 1.52952 0 2.07934 0H5.07934C5.62906 0 6.07934 0.450333 6.07934 1.00001C6.07934 2.08251 6.22929 3.13084 6.50924 4.12668C6.63922 4.61584 6.47425 5.13251 6.08929 5.45751L4.37943 6.91001C5.94429 10.4142 8.67462 13.1442 12.1789 14.7092L13.6314 12.9992C13.9564 12.6142 14.4731 12.4492 14.9622 12.5792C15.9581 12.8592 17.0064 13.0092 18.0889 13.0092C18.6386 13.0092 19.0889 13.4595 19.0889 14.0092V17.0092C19.0889 17.5589 18.6386 18.0092 18.0889 18.0092H15.0889"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
