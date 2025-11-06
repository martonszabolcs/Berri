import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, RadialGradient, Stop, Defs, Text as SvgText } from 'react-native-svg';

interface AvatarIconProps {
  character: string;
  size?: 70 | 100;
}

const AvatarIcon: React.FC<AvatarIconProps> = ({ character, size = 70 }) => {
  const radius = size / 2;
  const fontSize = size === 100 ? 50 : 40;
  
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient
            id="avatarGradient"
            cx="50%"
            cy="50%"
            r="50%"
          >
            <Stop offset="0%" stopColor="rgba(243, 204, 251, 0.92)" />
            <Stop offset="100%" stopColor="rgba(132, 72, 149, 1)" />
          </RadialGradient>
        </Defs>
        
        <Circle
          cx={radius}
          cy={radius}
          r={radius}
          fill="url(#avatarGradient)"
        />
        
        <SvgText
          x={radius}
          y={radius + fontSize/3}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="bold"
          fill="white"
        >
          {character.toUpperCase()}
        </SvgText>
      </Svg>
    </View>
  );
};

export default AvatarIcon;