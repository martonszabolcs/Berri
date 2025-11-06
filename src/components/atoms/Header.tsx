import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Button from './Button';
import Text from './Text';

interface HeaderProps {
  title: string;
  onBackPress?: () => void;
  showBackButton?: boolean;
  rightComponent?: React.ReactNode;
  showLogout?: boolean;
  onLogout?: () => void;
  onMenuPress?: () => void;
  isDark?: boolean;
}

const Header = ({ 
  title, 
  onBackPress, 
  showBackButton = true, 
  rightComponent,
  showLogout = false,
  onLogout,
  onMenuPress,
}: HeaderProps) => {
  const navigation = useNavigation();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      {onMenuPress ? (
        <TouchableOpacity onPress={onMenuPress} style={styles.backButton}>
          <Image source={require('../../assets/menu.png')} style={styles.menuIcon} resizeMode="contain" />
        </TouchableOpacity>
      ) : showBackButton && (
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Image 
            source={require('../../assets/left_arrow.png')} 
            style={styles.backIcon} 
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}
      <Text style={styles.title}>{title}</Text>
      {showLogout && (
        <View style={styles.rightComponent}>
          <Button
            title="Log out"
            variant="text"
            size="small"
            onPress={onLogout}
            textStyle={styles.logoutButtonText}
          />
        </View>
      )}
      {rightComponent && (
        <View style={styles.rightComponent}>
          {rightComponent}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#252544',
  },
  
  backButton: {
    marginRight: 20,
  },
  menuIcon: {
    width: 30,
    height: 14,
    tintColor: 'white',
    marginTop: 'auto',
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: 'white',
  },
  title: {
    fontSize: 14,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    marginRight: 44,
  },
  rightComponent: {
    position: 'absolute',
    right: 20,
  },
  logoutButtonText: {
  },
});

export default Header;