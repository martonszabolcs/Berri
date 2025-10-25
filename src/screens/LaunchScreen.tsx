import { useEffect, useCallback } from 'react';
import { Text, StyleSheet, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout } from '../components';
import React from 'react';

type RootStackParamList = {
  LaunchScreen: undefined;
  MainTabs: undefined;
  LoginScreen: undefined;
};

type LaunchScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'LaunchScreen'
>;

const LaunchScreen = () => {
  const navigation = useNavigation<LaunchScreenNavigationProp>();

  const checkToken = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      // Add a small delay for better UX
      setTimeout(() => {
        if (token) {
          navigation.replace('MainTabs');
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
      <Image
        resizeMode="contain"
        source={require('../assets/logo.png')}
        style={{ width: '60%' }}
      />
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
