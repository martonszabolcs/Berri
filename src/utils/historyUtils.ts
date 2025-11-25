import AsyncStorage from '@react-native-async-storage/async-storage';
import { FileSystem } from 'react-native-file-access';
import { AppDispatch } from '../store';
import { setHistory } from '../store/appSlice';

interface FileInfo {
  filename: string;
  url: string;
}

interface HistoryEntry {
  timestamp: number;
  destination?: number; // Legacy support
  destinations?: number[]; // New multi-destination support
  files: FileInfo[];
}

/**
 * Delete a history entry and all associated files from phone storage
 * @param historyEntry - The history entry to delete
 * @param currentHistory - Current history array from Redux
 * @param dispatch - Redux dispatch function
 */
export const deleteHistoryEntry = async (
  historyEntry: HistoryEntry,
  currentHistory: HistoryEntry[],
  dispatch: AppDispatch
): Promise<void> => {
  try {
    // Delete all files from phone storage
    console.log(`🗑️ Deleting ${historyEntry.files.length} file(s) from phone storage...`);
    for (const file of historyEntry.files) {
      try {
        const filePath = file.url.startsWith('file://') ? file.url.replace('file://', '') : file.url;
        const fileExists = await FileSystem.exists(filePath);
        
        if (fileExists) {
          await FileSystem.unlink(filePath);
          console.log(`✅ Deleted file: ${file.filename}`);
        } else {
          console.log(`⚠️ File not found (already deleted?): ${file.filename}`);
        }
      } catch (fileError) {
        console.error(`❌ Error deleting file ${file.filename}:`, fileError);
        // Continue with other files even if one fails
      }
    }
    
    // Filter out the history entry by timestamp
    const updatedHistory = currentHistory.filter(
      (entry) => entry.timestamp !== historyEntry.timestamp
    );
    
    // Save to AsyncStorage
    await AsyncStorage.setItem('history', JSON.stringify(updatedHistory));
    
    // Update Redux state
    dispatch(setHistory(updatedHistory));
    
    console.log('✅ History entry and files deleted successfully');
  } catch (error) {
    console.error('❌ Error deleting history entry:', error);
    throw error;
  }
};

/**
 * Delete multiple history entries and all associated files from phone storage
 * @param historyEntries - Array of history entries to delete
 * @param currentHistory - Current history array from Redux
 * @param dispatch - Redux dispatch function
 */
export const deleteMultipleHistoryEntries = async (
  historyEntries: HistoryEntry[],
  currentHistory: HistoryEntry[],
  dispatch: AppDispatch
): Promise<{ successCount: number; failureCount: number }> => {
  let successCount = 0;
  let failureCount = 0;
  
  console.log(`🗑️ Starting bulk deletion of ${historyEntries.length} history entries...`);
  
  // Create a set of timestamps to delete for efficient filtering
  const timestampsToDelete = new Set(historyEntries.map(entry => entry.timestamp));
  
  // Delete all files from phone storage
  for (const historyEntry of historyEntries) {
    try {
      console.log(`🗑️ Deleting files for entry: ${historyEntry.files[0]?.filename}...`);
      
      // Delete all files for this history entry
      for (const file of historyEntry.files) {
        try {
          const filePath = file.url.startsWith('file://') ? file.url.replace('file://', '') : file.url;
          const fileExists = await FileSystem.exists(filePath);
          
          if (fileExists) {
            await FileSystem.unlink(filePath);
            console.log(`✅ Deleted file: ${file.filename}`);
          } else {
            console.log(`⚠️ File not found (already deleted?): ${file.filename}`);
          }
        } catch (fileError) {
          console.error(`❌ Error deleting file ${file.filename}:`, fileError);
          // Continue with other files even if one fails
        }
      }
      
      successCount++;
      console.log(`✅ [${successCount}/${historyEntries.length}] Deleted history entry and files`);
      
    } catch (error) {
      console.error(`❌ Error deleting history entry:`, error);
      failureCount++;
    }
  }
  
  try {
    // Filter out all the history entries by timestamp
    const updatedHistory = currentHistory.filter(
      (entry) => !timestampsToDelete.has(entry.timestamp)
    );
    
    // Save to AsyncStorage
    await AsyncStorage.setItem('history', JSON.stringify(updatedHistory));
    
    // Update Redux state
    dispatch(setHistory(updatedHistory));
    
    console.log(`✅ Bulk deletion completed: ${successCount} successful, ${failureCount} failed`);
  } catch (error) {
    console.error('❌ Error updating storage after bulk deletion:', error);
    throw error;
  }
  
  return { successCount, failureCount };
};

/**
 * Update a history entry's destination and save to storage
 * @param historyEntry - The history entry to update
 * @param newDestinationId - New destination ID
 * @param currentHistory - Current history array from Redux
 * @param dispatch - Redux dispatch function
 */
export const updateHistoryDestination = async (
  historyEntry: HistoryEntry,
  newDestinationIds: number[],
  currentHistory: HistoryEntry[],
  dispatch: AppDispatch
): Promise<void> => {
  try {
    // Update the history entry's destinations
    const updatedHistory = currentHistory.map((entry) => {
      if (entry.timestamp === historyEntry.timestamp) {
        return { ...entry, destinations: newDestinationIds };
      }
      return entry;
    });
    
    // Save to AsyncStorage
    await AsyncStorage.setItem('history', JSON.stringify(updatedHistory));
    
    // Update Redux state
    dispatch(setHistory(updatedHistory));
    
    console.log(`✅ History destinations updated to [${newDestinationIds.join(', ')}]`);
  } catch (error) {
    console.error('❌ Error updating history destination:', error);
    throw error;
  }
};