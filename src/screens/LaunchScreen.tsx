import { useEffect, useCallback } from 'react';
import { Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout } from '../components';

type RootStackParamList = {
  LaunchScreen: undefined;
  CameraScreen: undefined;
  LoginScreen: undefined;
};

type LaunchScreenNavigationProp = StackNavigationProp<RootStackParamList, 'LaunchScreen'>;

const LaunchScreen = () => {
  const navigation = useNavigation<LaunchScreenNavigationProp>();

  const checkToken = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      // Add a small delay for better UX
      setTimeout(() => {
        if (token) {
          navigation.replace('CameraScreen');
        } else {
          navigation.replace('LoginScreen');
        }
      }, 1500);
    } catch (error) {
      console.error('Error checking token:', error);
      // If there's an error, navigate to login
      setTimeout(() => {
        navigation.replace('LoginScreen');
      }, 1500);
    }
  }, [navigation]);

  useEffect(() => {
    checkToken();
  }, [checkToken]);

  return (
    <Layout type="default">
      <Text style={styles.text}>BERRĪ</Text>
    </Layout>
  );
};

const styles = StyleSheet.create({
  text: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    transform: [{ translateY: -16 }], // Half of font size to center vertically
  },
});

export default LaunchScreen;