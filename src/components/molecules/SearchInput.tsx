import React from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Image,
} from 'react-native';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  isSelectionMode?: boolean;
}

const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeText,
  placeholder = 'Search',
  isSelectionMode = false,
}) => {
  return (
    <View
      style={[
        styles.searchContainer,
        isSelectionMode && styles.searchContainerWithSelection,
      ]}
    >
      <View style={styles.searchInputContainer}>
        <Image
          source={require('../../assets/search.png')}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor={'white'}
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  searchContainerWithSelection: {
    paddingTop: 120, // Make room for selection header
  },
  searchInputContainer: {
    flexDirection: 'row',
    marginTop: 10,
    alignItems: 'center',
    backgroundColor: '#252544D9', // 85% opacity
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 4,
    gap: 10,
  },
  searchIcon: {
    width: 18,
    height: 18,
    tintColor: 'white',
  },
  searchInput: {
    color: 'white',
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    flex: 1,
  },
});

export default SearchInput;