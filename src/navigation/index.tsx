import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import screens
import CameraScreen from '../screens/CameraScreen';
import LaunchScreen from '../screens/LaunchScreen';
import AuthScreen from '../screens/AuthScreen';
import RegisterScreen from '../screens/RegisterScreen';
import LoginScreen from '../screens/LoginScreen';
import ForgottenScreen from '../screens/ForgottenScreen';
import HistoryScreen from '../screens/HistoryScreen';
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
  HistoryScreen: undefined;
  NewScanStack: undefined;
  DestinationsStack: undefined;
  DestinationsScreen: undefined;
  DestinationScreen: { destinationId: string };
  ChangeDestinationScreen: { destinationId: string };
  ChangeRecipientScreen: { destinationId: string };
  ProfileScreen: undefined;
  HowToScreen: undefined;
  FileNamingScreen: undefined;
  ResetPasswordScreen: undefined;
  SettingsStack: undefined;
  SettingsScreen: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

const hideHeader = {
  headerShown: false,
  gestureEnabled: true,
};

// Custom Drawer Content
const CustomDrawerContent = ({ navigation }: any) => {
  const handleLogout = async () => {
    await AsyncStorage.removeItem('authToken');
    navigation.reset({
      index: 0,
      routes: [{ name: 'LaunchScreen' }],
    });
  };

  const openSocialLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <View style={styles.drawerContainer}>
      <View style={styles.drawerHeader}>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('MainTabs', { screen: 'ProfileScreen' })
          }
          style={styles.profileSection}
        >
          <Image
            source={require('../assets/logo.png')}
            style={styles.profileImage}
          />
          <Text style={styles.emailText}>user@example.com</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.drawerContent}>
        <TouchableOpacity
          style={styles.drawerItem}
          onPress={() =>
            navigation.navigate('MainTabs', { screen: 'HowToScreen' })
          }
        >
          <Image
            source={require('../assets/how_to.png')}
            style={styles.drawerIcon}
          />
          <Text style={styles.drawerText}>How To</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.drawerItem}
          onPress={() =>
            navigation.navigate('MainTabs', { screen: 'SettingsStack' })
          }
        >
          <Image
            source={require('../assets/settings.png')}
            style={styles.drawerIcon}
          />
          <Text style={styles.drawerText}>Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.drawerFooter}>
        <View style={styles.socialContainer}>
          <TouchableOpacity
            onPress={() => openSocialLink('https://facebook.com')}
          >
            <Image
              source={require('../assets/FB.png')}
              style={styles.socialIcon}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openSocialLink('https://instagram.com')}
          >
            <Image
              source={require('../assets/instagram.png')}
              style={styles.socialIcon}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openSocialLink('https://youtube.com')}
          >
            <Image
              source={require('../assets/YT.png')}
              style={styles.socialIcon}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// New Scan Stack Navigator
const NewScanStack = () => {
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

// Destinations Stack Navigator
const DestinationsStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DestinationsScreen"
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
    <Stack.Navigator>
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

// Main Tab Navigator
const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderTopWidth: 0,
        },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
      }}
    >
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Image
              resizeMode="contain"
              source={require('../assets/history.png')}
              style={{ width: size, height: size, tintColor: color }}
            />
          ),
        }}
      />
      <Tab.Screen
        name="NewScan"
        component={NewScanStack}
        options={{
          tabBarLabel: 'New Scan',
          tabBarIcon: ({ color, size }) => (
            <Image
              resizeMode="contain"
              source={require('../assets/new_scan.png')}
              style={{ width: size, height: size, tintColor: color }}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Destinations"
        component={DestinationsStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Image
              resizeMode="contain"
              source={require('../assets/destinations.png')}
              style={{ width: size, height: size, tintColor: color }}
            />
          ),
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
      <Tab.Screen
        name="ResetPasswordScreen"
        component={ResetPasswordScreen}
        options={{
          tabBarItemStyle: { display: 'none' }, // Completely hide from tab bar
        }}
      />
    </Tab.Navigator>
  );
};

// Main Drawer Navigator
const DrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={props => <CustomDrawerContent {...props} />}
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
      <Stack.Navigator initialRouteName="LaunchScreen">
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
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  drawerHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  profileSection: {
    alignItems: 'center',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 15,
  },
  emailText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  drawerContent: {
    flex: 1,
    paddingTop: 30,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  drawerIcon: {
    width: 24,
    height: 24,
    marginRight: 15,
    tintColor: 'white',
  },
  drawerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  drawerFooter: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  socialIcon: {
    width: 32,
    height: 32,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Navigation;
