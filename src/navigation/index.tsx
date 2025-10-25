import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import CameraScreen from '../screens/CameraScreen';
import LaunchScreen from '../screens/LaunchScreen';
import AuthScreen from '../screens/AuthScreen';
import RegisterScreen from '../screens/RegisterScreen';
import LoginScreen from '../screens/LoginScreen';
import ForgottenScreen from '../screens/ForgottenScreen';

type RootStackParamList = {
  LaunchScreen: undefined;
  CameraScreen: undefined;
  LoginScreen: undefined;
  HomeStack: undefined;
  AuthStack: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const hideHeader = {
  headerShown: false,
  gestureEnabled: true,
};

const Navigation = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="LaunchScreen">
        <Stack.Screen
          name="LaunchScreen"
          component={LaunchScreen}
          options={hideHeader}
        />
        <Stack.Screen
          name="CameraScreen"
          component={CameraScreen}
          options={hideHeader}
        />
         <Stack.Screen
          name="AuthScreen"
          component={AuthScreen}
          options={hideHeader}
        />
        <Stack.Screen
          name="LoginScreen"
          component={LoginScreen}
          options={hideHeader}
        />
         <Stack.Screen
          name="RegisterScreen"
          component={RegisterScreen}
          options={hideHeader}
        />
        <Stack.Screen
          name="ForgottenScreen"
          component={ForgottenScreen}
          options={hideHeader}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default Navigation;
