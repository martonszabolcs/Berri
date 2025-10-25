import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, TextInput, Animated } from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { Layout, Text } from '../components';

const HistoryScreen = () => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [selectedSort, setSelectedSort] = useState('newest scan');
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [selectAnimation] = useState(new Animated.Value(0));

  const sortOptions = [
    'newest scan',
    'oldest scan', 
    'alphabetical order'
  ];

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const toggleSelect = () => {
    const toValue = isSelectOpen ? 0 : 1;
    setIsSelectOpen(!isSelectOpen);
    
    Animated.timing(selectAnimation, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const selectOption = (option: string) => {
    setSelectedSort(option);
    toggleSelect();
  };

  return (
    <Layout type="default">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={openDrawer} style={styles.menuButton}>
            <Image source={require('../assets/menu.png')} style={styles.menuIcon} />
          </TouchableOpacity>
          <Text style={styles.title}>History</Text>
        </View>
        
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Image 
              source={require('../assets/select.png')} 
              style={styles.searchIcon} 
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search history..."
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
        </View>

        {/* Custom Select */}
        <View style={styles.selectContainer}>
          <TouchableOpacity 
            style={styles.selectButton}
            onPress={toggleSelect}
          >
            <Text style={styles.selectText}>{selectedSort}</Text>
          </TouchableOpacity>
        </View>

        {/* Content area that will be covered by overlay */}
        <View style={styles.contentWrapper}>
          {/* Select Overlay */}
          {isSelectOpen && (
            <TouchableOpacity 
              style={styles.overlay}
              activeOpacity={1}
              onPress={toggleSelect}
            >
              <Animated.View 
                style={[
                  styles.selectOptions,
                  {
                    opacity: selectAnimation,
                    transform: [{
                      translateY: selectAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-10, 0]
                      })
                    }]
                  }
                ]}
              >
                <Text style={styles.sortByLabel}>Sort by</Text>
                {sortOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.selectOption}
                    onPress={() => selectOption(option)}
                  >
                    <Text 
                      style={[
                        styles.optionText,
                        selectedSort === option && styles.selectedOptionText
                      ]}
                    >
                      {option}
                    </Text>
                    {selectedSort === option && (
                      <Image 
                        source={require('../assets/checkmark.png')} 
                        style={styles.checkmarkIcon}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </Animated.View>
            </TouchableOpacity>
          )}
          
          <View style={styles.content}>
            <Text style={styles.emptyText}>No scan history yet</Text>
          </View>
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
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252544D9', // 85% opacity
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 12,
    gap: 10,
  },
  searchIcon: {
    width: 18,
    height: 18,
    tintColor: 'white',
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    height: 20,
  },
  selectContainer: {
    paddingHorizontal: 20,
    paddingBottom: 6, // Reduced padding
  },
  selectButton: {
    // Remove all button styling - just a simple touchable area
    paddingVertical: 8,
  },
  selectText: {
    fontSize: 16,
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: 0, // Start from top of contentWrapper, not full screen
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    paddingTop: 20, // Small margin from select
    paddingHorizontal: 20,
  },
  selectOptions: {
    backgroundColor: '#252544',
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'white',
    alignSelf: 'flex-start', // Align to left instead of center
  },
  sortByLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 10,
  },
  optionText: {
    fontSize: 16,
  },
  selectedOptionText: {
    color: '#F3CCFBEB',
  },
  checkmarkIcon: {
    width: 16,
    height: 16,
    tintColor: '#F3CCFBEB',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
});

export default HistoryScreen;