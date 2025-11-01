import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, DestinationIcon } from '../components';

const IconDemo = () => {
  const destinations = [1, 2, 3, 4, 5, 6, 7] as const;
  const variants = ['screen', 'screen-selected', 'history', 'history-active'] as const;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Destination Icons</Text>
      
      {destinations.map((dest) => (
        <View key={dest} style={styles.destinationGroup}>
          <Text style={styles.destinationTitle}>Destination {dest}</Text>
          <View style={styles.variantRow}>
            {variants.map((variant) => (
              <View key={variant} style={styles.iconContainer}>
                <DestinationIcon type={dest} variant={variant} />
                <Text style={styles.variantLabel}>{variant}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  destinationGroup: {
    marginBottom: 30,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  destinationTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  variantRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  variantLabel: {
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
    color: '#666',
  },
});

export default IconDemo;