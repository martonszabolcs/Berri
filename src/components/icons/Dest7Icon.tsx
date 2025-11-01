import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface Dest7IconProps {
  color?: string;
  width?: number;
  height?: number;
}

const Dest7Icon: React.FC<Dest7IconProps> = ({ 
  color = '#000000', 
  width = 103, 
  height = 103 
}) => (
  <Svg width={width} height={height} viewBox="0 0 103 103" fill="none">
    {/* Grape berries */}
    <Circle cx="61.1529" cy="40.826" r="7.12866" stroke={color} strokeWidth="2.95871"/>
    <Circle cx="46.0865" cy="40.826" r="7.12866" stroke={color} strokeWidth="2.95871"/>
    <Circle cx="61.1529" cy="66.6507" r="7.12866" stroke={color} strokeWidth="2.95871"/>
    <Circle cx="46.0865" cy="66.6507" r="7.12866" stroke={color} strokeWidth="2.95871"/>
    <Circle cx="53.9742" cy="79.5624" r="7.12866" stroke={color} strokeWidth="2.95871"/>
    <Circle cx="68.3248" cy="53.7384" r="7.12866" stroke={color} strokeWidth="2.95871"/>
    <Circle cx="53.2584" cy="53.7384" r="7.12866" stroke={color} strokeWidth="2.95871"/>
    <Circle cx="38.1949" cy="53.7384" r="7.12866" stroke={color} strokeWidth="2.95871"/>
    
    {/* Grape stem */}
    <Path 
      d="M56.4856 17.8723C53.6163 19.307 51.8226 22.8937 52.8986 27.5563C53.9746 32.219 54.3336 35.0883 53.6186 37.2404" 
      stroke={color} 
      strokeWidth="2.43894" 
      strokeLinecap="round"
    />
    
    {/* Grape leaves */}
    <Path 
      d="M73.7012 20.7742C73.8329 21.1078 73.0772 26.0329 66.4046 28.6659C61.4295 30.629 55.6851 27.8831 55.6851 27.8831C55.6851 27.8831 58.0067 21.9545 62.9817 19.9914C70.6553 16.9635 73.5696 20.4405 73.7012 20.7742Z" 
      fill={color}
    />
    <Path 
      d="M40.2575 22.831C40.3611 22.6703 43.049 21.6733 47.178 24.3343C50.2565 26.3183 51.4059 30.0157 51.4059 30.0157C51.4059 30.0157 47.5639 30.4964 44.4854 28.5124C39.737 25.4523 40.154 22.9917 40.2575 22.831Z" 
      fill={color}
    />
  </Svg>
);

export default Dest7Icon;