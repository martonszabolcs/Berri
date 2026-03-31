import React, { useEffect, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LottieView from 'lottie-react-native';
import { Layout } from '../components';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { initializeAuth } from '../store/appSlice';

type RootStackParamList = {
  LaunchScreen: undefined;
  MainTabs: undefined;
  AuthScreen: undefined;
};

type LaunchScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'LaunchScreen'
>;

const LaunchScreen = () => {
  const navigation = useNavigation<LaunchScreenNavigationProp>();
  const dispatch = useAppDispatch();

  const initializeApp = useCallback(async () => {
    try {
      // Initialize auth state from AsyncStorage using Redux thunk
      const result = await dispatch(initializeAuth()).unwrap();
      
      // Add a small delay for better UX, then check authentication
      setTimeout(() => {
        // Check the actual result from initializeAuth, not stale state
        if (result && result.token) {
          navigation.replace('MainTabs');
        } else {
          navigation.replace('AuthScreen');
        }
      }, 1500);
    } catch (error) {
      console.error('Error initializing app:', error);
      // If there's an error, navigate to AuthScreen
      setTimeout(() => {
        navigation.replace('AuthScreen');
      }, 1500);
    }
  }, [navigation, dispatch]);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  return (
    <Layout type="default">
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <LottieView
          source={require('../../image2lottie-animation.json')}
          autoPlay
          loop={false}
          style={styles.lottie}
        />
      </View>
    </Layout>
  );
};

const styles = StyleSheet.create({
  lottie: {
    width: '80%',
    aspectRatio: 1,
  },
});

export default LaunchScreen;
