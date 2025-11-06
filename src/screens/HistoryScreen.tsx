import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { Layout, Text, HistoryCard } from '../components';
import { useSelector } from 'react-redux';

const HistoryScreen = () => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [selectedSort, setSelectedSort] = useState('Newest scan');
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [selectAnimation] = useState(new Animated.Value(0));
  const [isGridView, setIsGridView] = useState(false);
  const [isOverlayMode, setIsOverlayMode] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  const history = useSelector((state: any) => state.app.history);
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
  }, [history]);

  const sortOptions = ['Newest scan', 'Oldest scan', 'Alphabetical order'];

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

  const toggleCardSelection = (cardId: string | number) => {
    setSelectedCards(prev =>
      prev.includes(cardId)
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId],
    );
  };

  const selectAllCards = () => {
    setSelectedCards(historyData.map((item: any) => item.timestamp));
  };

  const cancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedCards([]);
  };

  // Tab bar elrejtése/megjelenítése selection mode-ban
  useEffect(() => {
    navigation.getParent()?.setOptions({
      tabBarStyle: isSelectionMode
        ? { display: 'none' }
        : {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderTopWidth: 0,
            zIndex: 1,
            elevation: 1,
          },
    });
  }, [isSelectionMode, navigation]);

  // custom stuff on top of tabbar
  // https://stackoverflow.com/questions/63108520/how-to-add-components-above-creatematerialtoptabnavigator

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
        {isSelectionMode ? (
          <View style={styles.selectionHeader}>
            <TouchableOpacity
              onPress={cancelSelection}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.selectedCountText}>
              {selectedCards.length} selected
            </Text>
            <TouchableOpacity
              onPress={selectAllCards}
              style={styles.selectButton}
            >
              <Text style={styles.selectAllText}>Select All</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.container}>
          {/* Search Input */}
          <View
            style={[
              styles.searchContainer,
              isSelectionMode && styles.searchContainerWithSelection,
            ]}
          >
            <View style={styles.searchInputContainer}>
              <Image
                source={require('../assets/search.png')}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor={'white'}
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
            </View>
          </View>

          {/* Custom Select and Reorder */}
          <View style={styles.selectAndReorderContainer}>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={toggleSelect}
            >
              <Text style={styles.selectText}>{selectedSort}</Text>
              <Image
                style={{
                  marginLeft: 10,
                  width: 12,
                  height: 12,
                  alignSelf: 'center',
                }}
                resizeMode="contain"
                source={require('../assets/arrow-down.png')}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reorderButton}
              onPress={() => setIsGridView(!isGridView)}
            >
              <Image
                source={require('../assets/arrange.png')}
                style={styles.reorderIcon}
                resizeMode="contain"
              />
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
                      transform: [
                        {
                          translateY: selectAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-10, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.sortByLabel}>Sort by</Text>
                  {sortOptions.map(option => (
                    <TouchableOpacity
                      key={option}
                      style={styles.selectOption}
                      onPress={() => selectOption(option)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selectedSort === option && styles.selectedOptionText,
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
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedCards.includes(
                              historyItem.timestamp,
                            )}
                            onToggleSelection={toggleCardSelection}
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
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedCards.includes(
                            historyItem.timestamp,
                          )}
                          onToggleSelection={toggleCardSelection}
                        />
                      ))
                  )}
                </ScrollView>
              )}
            </View>
          </View>

          {/* Selection Mode Bottom Bar */}
          {isSelectionMode && (
            <View style={styles.selectionBottomBar}>
              <TouchableOpacity style={styles.bottomButton}>
                <Image
                  source={require('../assets/delete.png')}
                  style={styles.bottomButtonIcon}
                />
                <Text style={styles.bottomButtonText}>Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.bottomButton}>
                <Image
                  source={require('../assets/merge.png')}
                  style={styles.bottomButtonIcon}
                />
                <Text style={styles.bottomButtonText}>Merge</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.bottomButton}>
                <Image
                  source={require('../assets/resend.png')}
                  style={styles.bottomButtonIcon}
                />
                <Text style={styles.bottomButtonText}>Resend</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.bottomButton}>
                <Image
                  source={require('../assets/share.png')}
                  style={styles.bottomButtonIcon}
                />
                <Text style={styles.bottomButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Overlay Mode */}
          {isOverlayMode && (
            <View style={styles.overlayMode}>
              <TouchableOpacity
                style={styles.overlayBackground}
                onPress={() => setIsOverlayMode(false)}
              />
              <View style={styles.overlayButtons}>
                <TouchableOpacity
                  style={styles.overlayButton}
                  onPress={() => {
                    setIsOverlayMode(false);
                    setIsSelectionMode(true);
                  }}
                >
                  <Image
                    resizeMode="contain"
                    source={require('../assets/select.png')}
                    style={styles.overlayButtonIcon}
                  />
                  <Text style={styles.overlayButtonText}>Select</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.overlayButton}
                  onPress={() => {
                    setIsOverlayMode(false);
                    setShowDeleteConfirm(true);
                  }}
                >
                  <Image
                    resizeMode="contain"
                    source={require('../assets/trash.png')}
                    style={styles.overlayButtonIcon}
                  />
                  <Text style={styles.overlayButtonText}>Delete All</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <View style={styles.confirmationOverlay}>
              <TouchableOpacity
                style={styles.overlayBackground}
                onPress={() => setShowDeleteConfirm(false)}
              />
              <View style={styles.confirmationDialog}>
                <Text style={styles.confirmationText}>
                  Are you sure you want to delete all history items?
                </Text>
                <View style={styles.confirmationButtons}>
                  <TouchableOpacity
                    style={[styles.confirmationButton, styles.cancelButton]}
                    onPress={() => setShowDeleteConfirm(false)}
                  >
                    <Text style={styles.cancelButtonText}>No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmationButton, styles.deleteButton]}
                    onPress={() => {
                      // TODO: Delete all logic
                      setShowDeleteConfirm(false);
                    }}
                  >
                    <Text style={styles.deleteButtonText}>Yes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </Layout>
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    zIndex: 9999999,
    elevation: 9999999,
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
  },
  selectContainer: {
    paddingHorizontal: 20,
    paddingBottom: 6, // Reduced padding
  },
  selectAndReorderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  selectButton: {
    paddingVertical: 8,
    flex: 1,
    flexDirection: 'row',
  },
  reorderButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  reorderIcon: {
    width: 20,
    height: 14,
    tintColor: 'white',
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
    backgroundColor: 'rgba(37, 37, 68, 0.86)',
    zIndex: 1000,
    paddingTop: 20, // Small margin from select
    paddingHorizontal: 20,
  },
  selectOptions: {
    //backgroundColor: '#252544',
    // borderRadius: 15,
    paddingVertical: 5,
    paddingHorizontal: 10,
    // borderWidth: 1,
    // borderColor: 'white',
    alignSelf: 'flex-start',
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
    paddingVertical: 5,
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
  // Overlay Mode Styles
  overlayMode: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(37, 37, 68, 0.86)',
  },
  overlayButtons: {
    position: 'absolute',
    backgroundColor: 'rgba(37, 37, 68, 1)',
    paddingVertical: 30,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  overlayButton: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 25,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  overlayButtonIcon: {
    width: 24,
    height: 24,
    marginRight: 5,
  },
  overlayButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '400',
  },
  // Confirmation Dialog Styles
  confirmationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1001,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmationDialog: {
    backgroundColor: '#252544',
    margin: 40,
    borderRadius: 15,
    padding: 25,
    borderWidth: 1,
    borderColor: 'white',
  },
  confirmationText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  confirmationButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    minWidth: 80,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Selection Mode Styles
  selectionHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#252544',
    zIndex: 1000,
    elevation: 1000,
  },
  cancelText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedCountText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectAllText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  // Selection Bottom Bar Styles
  selectionBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#252544',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  selectionBottomBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bottomButton: {
    alignItems: 'center',
    flex: 1,
  },
  bottomButtonIcon: {
    width: 24,
    height: 24,
    tintColor: 'white',
    marginBottom: 6,
  },
  bottomButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default HistoryScreen;
