import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Button from './Button';

interface HeaderProps {
  title: string;
  onBackPress?: () => void;
  showBackButton?: boolean;
  rightComponent?: React.ReactNode;
  showLogout?: boolean;
  onLogout?: () => void;
  isDark?: boolean;
}

const Header = ({ 
  title, 
  onBackPress, 
  showBackButton = true, 
  rightComponent,
  showLogout = false,
  onLogout,
  isDark = false
}: HeaderProps) => {
  const navigation = useNavigation();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };

  const containerStyle = isDark 
    ? [styles.container, styles.darkContainer] 
    : styles.container;

  return (
    <View style={containerStyle}>
      {showBackButton && (
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
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
    paddingTop: 60,
    paddingBottom: 20,
  },
  darkContainer: {
    backgroundColor: '#252544',
  },
  backButton: {
    marginRight: 20,
  },
  backIcon: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    marginRight: 44, // Compensate for back button to center title
  },
  rightComponent: {
    position: 'absolute',
    right: 20,
  },
  logoutButtonText: {
    color: 'white',
  },
});

export default Header;