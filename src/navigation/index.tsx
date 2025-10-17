import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import CameraScreen from '../screens/CameraScreen';

type RootStackParamList = {
  CameraScreen: undefined;
  HomeStack: undefined;
  AuthStack: undefined;
  LoginScreen: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const hideHeader = {
  headerShown: false,
  gestureEnabled: true,
};

const HomeStack: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CameraScreen"
        component={CameraScreen}
        options={hideHeader}
      />
    </Stack.Navigator>
  );
};
const AuthStack: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="LoginScreen"
        component={CameraScreen}
        options={hideHeader}
      />
    </Stack.Navigator>
  );
};

const Navigation: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="HomeStack">
        <Stack.Screen
          name="HomeStack"
          component={HomeStack}
          options={hideHeader}
        />
        <Stack.Screen
          name="AuthStack"
          component={AuthStack}
          options={hideHeader}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default Navigation;
