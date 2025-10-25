import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout } from '../components';

type RootStackParamList = {
  DestinationScreen: { destinationId: string };
};

type DestinationsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const DestinationsScreen = () => {
  const navigation = useNavigation<DestinationsScreenNavigationProp>();

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const navigateToDestination = (destinationId: string) => {
    navigation.navigate('DestinationScreen', { destinationId });
  };

  return (
    <Layout type="default">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={openDrawer} style={styles.menuButton}>
            <Image source={require('../assets/menu.png')} style={styles.menuIcon} />
          </TouchableOpacity>
          <Text style={styles.title}>Destinations</Text>
        </View>
        
        <View style={styles.content}>
          <TouchableOpacity 
            style={styles.destinationCard} 
            onPress={() => navigateToDestination('1')}
          >
            <Text style={styles.destinationText}>Sample Destination 1</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.destinationCard} 
            onPress={() => navigateToDestination('2')}
          >
            <Text style={styles.destinationText}>Sample Destination 2</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  destinationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
  },
  destinationText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default DestinationsScreen;