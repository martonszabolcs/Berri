import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import {
  Layout,
  Text,
  HistoryCard,
  DeleteModal,
  HistoryMoreFunctions,
  SearchInput,
  HistorySelectOverlay,
  HistorySelectAndReorder,
} from '../components';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../store/hooks';
import {
  deleteMultipleHistoryEntries,
} from '../utils/historyUtils';

const HistoryScreen = () => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [selectedSort, setSelectedSort] = useState('Newest scan');
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [selectAnimation] = useState(new Animated.Value(0));
  const [isGridView, setIsGridView] = useState(false);
  const [isOverlayMode, setIsOverlayMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const history = useSelector((state: any) => state.app.history);
  const dispatch = useAppDispatch();
  const [historyData, setHistoryData] = useState(history);

  useEffect(() => {
    // Filter history based on search text
    const filtered = history.filter((item: any) =>
      searchText !== ''
        ? item.files?.find((file: any) =>
            file.filename.toLowerCase().includes(searchText.toLowerCase()),
          )
        : true,
    );
    setHistoryData(filtered);
  }, [history, searchText]);

  const sortOptions = ['Newest scan', 'Oldest scan', 'Alphabetical order'];

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const selectOption = (option: string) => {
    setSelectedSort(option);
    toggleSelect();
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

  const deleteAllHistory = async () => {
    try {
      console.log(
        `🗑️ Starting deletion of all ${history.length} history items...`,
      );

      if (history.length === 0) {
        Alert.alert('Info', 'No history items to delete');
        return;
      }

      // Use the existing utility function to delete all history entries
      const result = await deleteMultipleHistoryEntries(
        history, // Pass all history entries
        history, // Current history array
        dispatch, // Redux dispatch
      );

      // Show success message
      if (result.failureCount === 0) {
        Alert.alert(
          'Success',
          `Successfully deleted all ${result.successCount} history items and their files.`,
        );
      } else {
        Alert.alert(
          'Partial Success',
          `Deleted ${result.successCount} history items successfully. ${result.failureCount} items failed to delete.`,
        );
      }
    } catch (error) {
      console.error('❌ Critical error during delete all operation:', error);
      Alert.alert(
        'Error',
        'Failed to delete all history items. Please try again.',
      );
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <Layout
        type="default"
        headerTitle="History"
        onMenuPress={openDrawer}
        rightComponent={
          <TouchableOpacity
            onPress={() => setIsOverlayMode(true)}
            style={styles.dotsButton}
          >
            <Image
              resizeMode="contain"
              source={require('../assets/dots.png')}
              style={styles.dotsIcon}
            />
          </TouchableOpacity>
        }
      >
        <View style={styles.container}>
          <SearchInput
            value={searchText}
            onChangeText={text => {
              setSearchText(text);
              if (text !== '') {
                console.log('ITEM HISTORY FILTERED', history);
                setHistoryData(
                  history.filter((item: any) =>
                    item.files.find((file: any) =>
                      file.filename
                        .toLowerCase()
                        .includes(searchText.toLowerCase()),
                    ),
                  ),
                );
              } else {
                setHistoryData(history);
              }
            }}
          />

          <HistorySelectAndReorder
            selectedSort={selectedSort}
            isGridView={isGridView}
            onToggleSelect={toggleSelect}
            onToggleGridView={() => setIsGridView(!isGridView)}
          />

          <View style={styles.contentWrapper}>
            <HistorySelectOverlay
              visible={isSelectOpen}
              selectedSort={selectedSort}
              sortOptions={sortOptions}
              selectAnimation={selectAnimation}
              onClose={toggleSelect}
              onSelectOption={selectOption}
            />

            <View style={styles.content}>
              {historyData.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No scan history yet</Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.historyList}
                  showsVerticalScrollIndicator={false}
                >
                  {isGridView ? (
                    <View style={styles.gridContainer}>
                      {[...historyData]
                        ?.sort((a: any, b: any) => {
                          switch (selectedSort) {
                            case 'Newest scan':
                              return b.timestamp - a.timestamp; // Newest first
                            case 'Oldest scan':
                              return a.timestamp - b.timestamp; // Oldest first
                            case 'Alphabetical order':
                              const filenameA =
                                a.files?.[0]?.filename?.toLowerCase() || '';
                              const filenameB =
                                b.files?.[0]?.filename?.toLowerCase() || '';
                              return filenameA.localeCompare(filenameB);
                            default:
                              return b.timestamp - a.timestamp; // Default to newest
                          }
                        })
                        .map((historyItem: any) => (
                          <HistoryCard
                            key={historyItem.id || historyItem.timestamp}
                            history={historyItem}
                            isGridView={isGridView}
                            isSelectionMode={false}
                            isSelected={false}
                          />
                        ))}
                    </View>
                  ) : (
                    [...historyData]
                      ?.sort((a: any, b: any) => {
                        switch (selectedSort) {
                          case 'Newest scan':
                            return b.timestamp - a.timestamp; // Newest first
                          case 'Oldest scan':
                            return a.timestamp - b.timestamp; // Oldest first
                          case 'Alphabetical order':
                            const filenameA =
                              a.files?.[0]?.filename?.toLowerCase() || '';
                            const filenameB =
                              b.files?.[0]?.filename?.toLowerCase() || '';
                            return filenameA.localeCompare(filenameB);
                          default:
                            return b.timestamp - a.timestamp; // Default to newest
                        }
                      })
                      .map((historyItem: any) => (
                        <HistoryCard
                          key={historyItem.id || historyItem.timestamp}
                          history={historyItem}
                          isGridView={isGridView}
                          isSelectionMode={false}
                          isSelected={false}
                        />
                      ))
                  )}
                </ScrollView>
              )}
            </View>
          </View>

          {/* Overlay Mode */}
          <HistoryMoreFunctions
            visible={isOverlayMode}
            onClose={() => setIsOverlayMode(false)}
            onSelectMode={() => {
              setIsOverlayMode(false);
              // Navigate to HistorySelectScreen via root navigator (this will hide the tab bar)
              navigation.getParent()?.navigate('HistorySelectScreen');
            }}
            onDeleteAll={() => {
              setIsOverlayMode(false);
              setShowDeleteConfirm(true);
            }}
          />

          {/* Delete Confirmation */}
          <DeleteModal
            visible={showDeleteConfirm}
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={async () => {
              setShowDeleteConfirm(false);
              await deleteAllHistory();
            }}
          />
        </View>
      </Layout>
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  dotsButton: {
    padding: 8,
    marginTop: 'auto',
  },
  dotsIcon: {
    width: 24,
    height: 24,
    tintColor: 'white',
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyList: {
    flex: 1,
    width: '100%',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
});

export default HistoryScreen;
