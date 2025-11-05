import { Dirs, FileSystem } from 'react-native-file-access';

/**
 * Saves a file from cache directory to permanent storage (Documents folder)
 * @param tempPath - Path to the temporary file (usually in cache)
 * @param fileName - Final filename for the saved file
 * @returns Promise<string | null> - Returns the permanent file path on success, null on failure
 */
export const saveFileToStorage = async (
  tempPath: string,
  fileName: string
): Promise<string | null> => {
  try {
    console.log('💾 Starting file save to permanent storage...');
    console.log('📂 Source path:', tempPath);
    console.log('📄 Target filename:', fileName);

    // Check if source file exists
    const exists = await FileSystem.exists(tempPath);
    if (!exists) {
      console.error('❌ Source file does not exist:', tempPath);
      return null;
    }

    // Get permanent storage path (Documents directory)
    const documentsPath = Dirs.DocumentDir;
    const permanentPath = `${documentsPath}/${fileName}`;

    console.log('📁 Documents directory:', documentsPath);
    console.log('🎯 Final file path:', permanentPath);

    // Copy file from temp to permanent location
    await FileSystem.cp(tempPath, permanentPath);

    // Verify the file was copied successfully
    const savedExists = await FileSystem.exists(permanentPath);
    if (!savedExists) {
      console.error('❌ File copy failed - file not found at destination');
      return null;
    }

    // Get file stats for confirmation
    const stats = await FileSystem.stat(permanentPath);
    
    console.log('✅ File saved successfully!');
    console.log('📍 Permanent location:', permanentPath);
    console.log('📊 File size:', stats.size, 'bytes');

    return permanentPath;

  } catch (error) {
    console.error('❌ Error saving file to storage:', error);
    return null;
  }
};

/**
 * Saves image data (base64) directly to permanent storage
 * @param imageBase64 - Base64 encoded image data
 * @param fileName - Final filename for the saved file
 * @returns Promise<string | null> - Returns the permanent file path on success, null on failure
 */
export const saveBase64ToStorage = async (
  imageBase64: string,
  fileName: string
): Promise<string | null> => {
  try {
    console.log('💾 Starting base64 image save to permanent storage...');
    console.log('📄 Target filename:', fileName);

    // Get permanent storage path (Documents directory)
    const documentsPath = Dirs.DocumentDir;
    const permanentPath = `${documentsPath}/${fileName}`;

    console.log('📁 Documents directory:', documentsPath);
    console.log('🎯 Final file path:', permanentPath);

    // Write base64 data directly to permanent location
    await FileSystem.writeFile(permanentPath, imageBase64, 'base64');

    // Verify the file was saved successfully
    const savedExists = await FileSystem.exists(permanentPath);
    if (!savedExists) {
      console.error('❌ File save failed - file not found at destination');
      return null;
    }

    // Get file stats for confirmation
    const stats = await FileSystem.stat(permanentPath);
    
    console.log('✅ Base64 image saved successfully!');
    console.log('📍 Permanent location:', permanentPath);
    console.log('📊 File size:', stats.size, 'bytes');

    return permanentPath;

  } catch (error) {
    console.error('❌ Error saving base64 image to storage:', error);
    return null;
  }
};

/**
 * Generates a unique filename with timestamp
 * @param baseName - Base name for the file (without extension)
 * @param extension - File extension (e.g., 'jpg', 'pdf')
 * @returns string - Unique filename with timestamp
 */
export const generateUniqueFileName = (baseName: string, extension: string): string => {
  const timestamp = Date.now();
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${baseName}_${dateStr}_${timestamp}.${extension}`;
};

/**
 * Saves the scanned document to permanent storage with automatic filename generation
 * @param imageBase64 - Base64 encoded scanned document
 * @returns Promise<string | null> - Returns the permanent file path on success, null on failure
 */
export const saveScannedDocument = async (imageBase64: string): Promise<string | null> => {
  try {
    // Generate unique filename for scanned document
    const fileName = generateUniqueFileName('BERRI_Scanned_Document', 'jpg');
    
    console.log('📄 Saving scanned document with filename:', fileName);
    
    // Save to permanent storage
    const savedPath = await saveBase64ToStorage(imageBase64, fileName);
    
    if (savedPath) {
      console.log('✅ Scanned document saved successfully!');
      console.log('📍 Location:', savedPath);
      return savedPath;
    } else {
      console.error('❌ Failed to save scanned document');
      return null;
    }

  } catch (error) {
    console.error('❌ Error saving scanned document:', error);
    return null;
  }
};

/**
 * Lists all saved files in the Documents directory
 * @returns Promise<string[]> - Array of filenames in Documents directory
 */
export const listSavedFiles = async (): Promise<string[]> => {
  try {
    const documentsPath = Dirs.DocumentDir;
    
    // Note: react-native-file-access might not have readdir in all versions
    // This is a placeholder for when that functionality is available
    console.log('📋 Documents directory:', documentsPath);
    
    // For now, return empty array as we don't have directory listing
    // In a real implementation, you'd use FileSystem.readdir if available
    return [];
    
  } catch (error) {
    console.error('❌ Error listing saved files:', error);
    return [];
  }
};

/**
 * Deletes a saved file from permanent storage
 * @param fileName - Name of the file to delete
 * @returns Promise<boolean> - True if deleted successfully, false otherwise
 */
export const deleteSavedFile = async (fileName: string): Promise<boolean> => {
  try {
    const documentsPath = Dirs.DocumentDir;
    const filePath = `${documentsPath}/${fileName}`;
    
    console.log('🗑️ Deleting file:', filePath);
    
    // Check if file exists before attempting deletion
    const exists = await FileSystem.exists(filePath);
    if (!exists) {
      console.warn('⚠️ File does not exist:', filePath);
      return false;
    }
    
    // Delete the file
    await FileSystem.unlink(filePath);
    
    console.log('✅ File deleted successfully:', fileName);
    return true;
    
  } catch (error) {
    console.error('❌ Error deleting file:', error);
    return false;
  }
};