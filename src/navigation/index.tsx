import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { CustomDrawerContent, HistoryTabBarIcon, NewScanTabBarIcon, DestinationsTabBarIcon } from '../components';

// Import screens
import CameraScreen from '../screens/CameraScreen';
import DestinationSelectScreen from '../screens/DestinationsSelectScreen';
import LaunchScreen from '../screens/LaunchScreen';
import AuthScreen from '../screens/AuthScreen';
import RegisterScreen from '../screens/RegisterScreen';
import LoginScreen from '../screens/LoginScreen';
import ForgottenScreen from '../screens/ForgottenScreen';
import HistoryScreen from '../screens/HistoryScreen';
import HistorySelectScreen from '../screens/HistorySelectScreen';
import HistoryDetailScreen from '../screens/HistoryDetailScreen';
import DestinationsScreen from '../screens/DestinationsScreen';
import DestinationScreen from '../screens/DestinationScreen';
import ChangeDestinationScreen from '../screens/ChangeDestinationScreen';
import ChangeRecipientScreen from '../screens/ChangeRecipientScreen';
import ProfileScreen from '../screens/ProfileScreen';
import HowToScreen from '../screens/HowToScreen';
import FileNamingScreen from '../screens/FileNamingScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import SettingsScreen from '../screens/SettingsScreen';
import React from 'react';

type RootStackParamList = {
  LaunchScreen: undefined;
  CameraScreen: undefined;
  LoginScreen: undefined;
  AuthScreen: undefined;
  RegisterScreen: undefined;
  ForgottenScreen: undefined;
  MainTabs: undefined;
  NewScanStack: undefined;
  DestinationsStack: undefined;
  Destinations: undefined;
  DestinationScreen: { destinationId: string };
  DestinationSelectScreen: { savedFilePath: string };
  ChangeDestinationScreen: { destinationId: string };
  ChangeRecipientScreen: { destinationId: string };
  ProfileScreen: undefined;
  HowToScreen: undefined;
  FileNamingScreen: undefined;
  ResetPasswordScreen: undefined;
  SettingsStack: undefined;
  SettingsScreen: undefined;
  HistorySelectScreen: undefined;
  HistoryDetailScreen: { 
    history: {
      id: string;
      name: string;
      createdAt: string;
      imageUri: string;
    }
  };
};

type HistoryStackParamList = {
  HistoryScreen: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

const hideHeader = {
  headerShown: false,
  gestureEnabled: true,
};

// New Scan Stack Navigator
const NewScanStack = () => {
  return (
    <Stack.Navigator 
      screenOptions={{
        headerShown: false,
        presentation: 'card',
        animationTypeForReplace: 'push',
      }}>
      <Stack.Screen
        name="CameraScreen"
        component={CameraScreen}
        options={hideHeader}
      />
      <Stack.Screen
        name="DestinationSelectScreen"
        component={DestinationSelectScreen}
        options={hideHeader}
      />
    </Stack.Navigator>
  );
};

// Destinations Stack Navigator
const DestinationsStack = () => {
  return (
    <Stack.Navigator 
      screenOptions={{
        headerShown: false,
        presentation: 'card',
      }}>
      <Stack.Screen
        name="Destinations"
        component={DestinationsScreen}
        options={hideHeader}
      />
      <Stack.Screen
        name="DestinationScreen"
        component={DestinationScreen}
        options={hideHeader}
      />
      <Stack.Screen
        name="ChangeDestinationScreen"
        component={ChangeDestinationScreen}
        options={hideHeader}
      />
      <Stack.Screen
        name="ChangeRecipientScreen"
        component={ChangeRecipientScreen}
        options={hideHeader}
      />
    </Stack.Navigator>
  );
};

// Settings Stack Navigator
const SettingsStack = () => {
  return (
    <Stack.Navigator 
      screenOptions={{
        headerShown: false,
        presentation: 'card',
      }}>
      <Stack.Screen
        name="SettingsScreen"
        component={SettingsScreen}
        options={hideHeader}
      />
      <Stack.Screen
        name="FileNamingScreen"
        component={FileNamingScreen}
        options={hideHeader}
      />
    </Stack.Navigator>
  );
};

// History stack (only contains the main HistoryScreen)
const HistoryStack = () => {
  const HistoryStackNavigator = createStackNavigator<HistoryStackParamList>();
  return (
    <HistoryStackNavigator.Navigator 
      screenOptions={{
        headerShown: false,
        presentation: 'card',
      }}>
      <HistoryStackNavigator.Screen
        name="HistoryScreen"
        component={HistoryScreen}
        options={hideHeader}
      />
    </HistoryStackNavigator.Navigator>
  );
}

// Main Tab Navigator
const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(37, 37, 68, 1)',
          borderTopWidth: 0,
          height: 70,
          paddingTop: 10,
        },
        tabBarActiveTintColor: 'rgba(255, 231, 255, 1)',
        tabBarInactiveTintColor: 'rgba(255, 231, 255, 0.5)',
      }}
    >
      <Tab.Screen
        name="History"
        component={HistoryStack}
        options={{
          tabBarIcon: renderHistoryTabBarIcon,
        }}
      />
      <Tab.Screen
        name="NewScan"
        component={NewScanStack}
        options={{
          tabBarLabel: 'New Scan',
          tabBarIcon: renderNewScanTabBarIcon,
        }}
      />
      <Tab.Screen
        name="Destinations"
        component={DestinationsStack}
        options={{
          tabBarIcon: renderDestinationsTabBarIcon,
        }}
      />
      {/* Hidden tabs that show tab bar but are not visible in tab bar */}
      <Tab.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{
          tabBarItemStyle: { display: 'none' }, // Completely hide from tab bar
        }}
      />
      <Tab.Screen
        name="HowToScreen"
        component={HowToScreen}
        options={{
          tabBarItemStyle: { display: 'none' }, // Completely hide from tab bar
        }}
      />
      <Tab.Screen
        name="SettingsStack"
        component={SettingsStack}
        options={{
          tabBarItemStyle: { display: 'none' }, // Completely hide from tab bar
        }}
      />
    </Tab.Navigator>
  );
};

// Custom Drawer Content Render Function
const renderCustomDrawerContent = (props: any) => (
  <CustomDrawerContent {...props} />
);

// TabBar Icon Render Functions
const renderHistoryTabBarIcon = ({ color, size }: { color: string; size: number }) => (
  <HistoryTabBarIcon color={color} size={size} />
);

const renderNewScanTabBarIcon = ({ color, size }: { color: string; size: number }) => (
  <NewScanTabBarIcon color={color} size={size} />
);

const renderDestinationsTabBarIcon = ({ color, size }: { color: string; size: number }) => (
  <DestinationsTabBarIcon color={color} size={size} />
);

// Main Drawer Navigator
const DrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={renderCustomDrawerContent}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: 'transparent',
          width: 280,
        },
      }}
    >
      <Drawer.Screen name="MainTabs" component={MainTabs} />
    </Drawer.Navigator>
  );
};

const Navigation = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="LaunchScreen" 
        screenOptions={{
          headerShown: false,
          presentation: 'card',
        }}>
        <Stack.Screen
          name="LaunchScreen"
          component={LaunchScreen}
          options={hideHeader}
        />
        <Stack.Screen
          name="MainTabs"
          component={DrawerNavigator}
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
        <Stack.Screen
          name="ResetPasswordScreen"
          component={ResetPasswordScreen}
          options={hideHeader}
        />
        <Stack.Screen
          name="HistoryDetailScreen"
          component={HistoryDetailScreen}
          options={hideHeader}
        />
        <Stack.Screen
          name="HistorySelectScreen"
          component={HistorySelectScreen}
          options={hideHeader}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default Navigation;
