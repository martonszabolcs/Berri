import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { Text, AvatarIcon } from '../';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logoutUser } from '../../store/appSlice';

interface CustomDrawerContentProps {
  navigation: any;
}

const CustomDrawerContent = ({ navigation }: CustomDrawerContentProps) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.app.user);
  const userEmail = user?.email || '';
  
  const handleLogout = async () => {
    try {
      await dispatch(logoutUser());
      // Use CommonActions.reset to reset the root navigator
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'AuthScreen' }],
        })
      );
    } catch (error) {
      console.error('Logout error:', error);
    }
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
          <AvatarIcon 
            character={userEmail.charAt(0)}
            size={70}
          />
          <Text style={styles.emailText}>{user.name}</Text>
          <Text style={styles.emailText}>{userEmail}</Text>
        </TouchableOpacity>

      </View>
        <View style={{width: "70%", marginHorizontal: "auto", height: 1, backgroundColor: "rgba(243, 204, 251, 0.92)"}} />

      <View style={styles.drawerContent}>
        <TouchableOpacity
          style={styles.drawerItem}
          onPress={() =>
            navigation.navigate('MainTabs', { screen: 'HowToScreen' })
          }
        >
          <Image
            source={require('../../assets/how_to.png')}
            style={styles.drawerIcon}
          />
          <Text style={styles.drawerText}>HOW TO /NEWS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.drawerItem}
          onPress={() =>
            navigation.navigate('MainTabs', { screen: 'SettingsStack' })
          }
        >
          <Image
            source={require('../../assets/settings.png')}
            style={styles.drawerIcon}
          />
          <Text style={styles.drawerText}>SETTINGS</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.drawerFooter}>
        <Text style={{marginHorizontal: "auto", marginBottom: 10}}>SOCIAL MEDIA</Text>
        <View style={styles.socialContainer}>
          <TouchableOpacity
            onPress={() => openSocialLink('https://www.facebook.com/Berribookhungary')}
          >
            <Image
              source={require('../../assets/FB.png')}
              style={styles.socialIcon}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openSocialLink('https://www.instagram.com/berri_book')}
          >
            <Image
              source={require('../../assets/instagram.png')}
              style={styles.socialIcon}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openSocialLink('https://www.youtube.com/@Berribook')}
          >
            <Image
              source={require('../../assets/YT.png')}
              style={styles.socialIcon}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 1)',
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
  emailText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 10
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
    marginRight: 35,
    tintColor: 'white',
  },
  drawerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  drawerFooter: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  socialContainer: {
    flexDirection: 'row',
    marginBottom: 100,
    marginHorizontal: "auto",
    gap: 15,
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

export default CustomDrawerContent;