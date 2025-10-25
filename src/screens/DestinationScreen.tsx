import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Layout } from '../components';

type RootStackParamList = {
  DestinationScreen: { destinationId: string };
};

type DestinationScreenRouteProp = RouteProp<RootStackParamList, 'DestinationScreen'>;

const DestinationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<DestinationScreenRouteProp>();
  const { destinationId } = route.params;

  return (
    <Layout type="default">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Image source={require('../assets/left_arrow.png')} style={styles.backIcon} />
          </TouchableOpacity>
          <Text style={styles.title}>Destination {destinationId}</Text>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.detailText}>Details for destination {destinationId}</Text>
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
  backButton: {
    marginRight: 20,
  },
  backIcon: {
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
  detailText: {
    color: 'white',
    fontSize: 16,
  },
});

export default DestinationScreen;