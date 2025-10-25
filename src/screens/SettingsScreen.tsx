import React from 'react';
import { View, StyleSheet, Image, ScrollView, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout, MenuListItem, Text } from '../components';

type SettingsStackParamList = {
  SettingsScreen: undefined;
  FileNamingScreen: undefined;
  HowToScreen: undefined;
  DestinationsScreen: undefined;
};

type SettingsScreenNavigationProp = StackNavigationProp<SettingsStackParamList>;

const SettingsScreen = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();

  const handleGetStarted = () => {
    navigation.navigate('HowToScreen');
  };

  const handleFileNaming = () => {
    navigation.navigate('FileNamingScreen');
  };

  const handleHelpCenter = () => {
    Linking.openURL('https://www.google.com');
  };

  const handleContactBerriBook = () => {
    Linking.openURL('https://www.google.com');
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://www.google.com');
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://www.google.com');
  };

  const handleDestinationSetup = () => {
    navigation.navigate('DestinationsScreen');
  };

  return (
    <Layout type="dark" headerTitle="Settings">
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* User Info Section */}
        <View style={styles.userSection}>
          <Image 
            source={require('../assets/logo.png')} 
            style={styles.userImage}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userLabel}>Email</Text>
            <Text style={styles.userEmail}>user@example.com</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <MenuListItem
            title="Get started"
            subtitle="Learn how to use the app"
            onPress={handleGetStarted}
          />
          <MenuListItem
            title="File naming template"
            subtitle="Customize how files are named"
            onPress={handleFileNaming}
          />
          <MenuListItem
            title="Help center"
            subtitle="Get support and answers"
            onPress={handleHelpCenter}
          />
          <MenuListItem
            title="Contact BerrīBook"
            subtitle="Reach out to our team"
            onPress={handleContactBerriBook}
          />
          <MenuListItem
            title="Privacy Policy"
            subtitle="How we protect your data"
            onPress={handlePrivacyPolicy}
          />
          <MenuListItem
            title="Terms of service"
            subtitle="Our terms and conditions"
            onPress={handleTermsOfService}
          />
          <MenuListItem
            title="Destination setup"
            subtitle="Configure scan destinations"
            onPress={handleDestinationSetup}
          />
        </View>
      </ScrollView>
    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 12,
  },
  userImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  userInfo: {
    flex: 1,
  },
  userLabel: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
  },
  menuSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  menuButton: {
    marginRight: 20,
  },
  menuIcon: {
    width: 24,
    height: 24,
    tintColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  settingsText: {
    fontSize: 16,
  },
});

export default SettingsScreen;