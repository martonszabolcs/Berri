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
  destination: number;
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
 * Update a history entry's destination and save to storage
 * @param historyEntry - The history entry to update
 * @param newDestinationId - New destination ID
 * @param currentHistory - Current history array from Redux
 * @param dispatch - Redux dispatch function
 */
export const updateHistoryDestination = async (
  historyEntry: HistoryEntry,
  newDestinationId: number,
  currentHistory: HistoryEntry[],
  dispatch: AppDispatch
): Promise<void> => {
  try {
    // Update the history entry's destination
    const updatedHistory = currentHistory.map((entry) => {
      if (entry.timestamp === historyEntry.timestamp) {
        return { ...entry, destination: newDestinationId };
      }
      return entry;
    });
    
    // Save to AsyncStorage
    await AsyncStorage.setItem('history', JSON.stringify(updatedHistory));
    
    // Update Redux state
    dispatch(setHistory(updatedHistory));
    
    console.log(`✅ History destination updated to ${newDestinationId}`);
  } catch (error) {
    console.error('❌ Error updating history destination:', error);
    throw error;
  }
};