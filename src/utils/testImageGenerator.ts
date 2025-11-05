import { Dirs, FileSystem } from 'react-native-file-access';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GeneratedFile {
  path: string;
  uri: string;
  name: string;
  size: number;
}

export interface FileInfo {
  filename: string;
  url: string;
}

export interface FileHistoryEntry {
  timestamp: number;
  destination: number;
  files: FileInfo[];
}

const HISTORY_KEY = 'history';

/**
 * Gets the current file history from AsyncStorage
 */
const getFileHistory = async (): Promise<FileHistoryEntry[]> => {
    // await AsyncStorage.removeItem(HISTORY_KEY);
  try {
    const historyData = await AsyncStorage.getItem(HISTORY_KEY);
    if (historyData) {
      return JSON.parse(historyData);
    }
    return [];
  } catch (error) {
    console.error('❌ Error getting file history:', error);
    return [];
  }
};

/**
 * Saves file history to AsyncStorage
 */
const saveFileHistory = async (history: FileHistoryEntry[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    console.log('💾 File history saved to AsyncStorage');
  } catch (error) {
    console.error('❌ Error saving file history:', error);
  }
};

/**
 * Adds a generated file to the existing history for a specific destination
 * Creates a clean entry for each destination with exactly one file
 */
const addFileToHistory = async (
  destinationId: number,
  filename: string,
  uri: string
): Promise<void> => {
  try {
    const currentHistory = await getFileHistory();
    
    // Remove any existing entry for this destination to avoid duplicates
    const filteredHistory = currentHistory.filter(
      entry => entry.destination !== destinationId
    );
    
    // Create new clean entry for this destination with one file
    const newEntry: FileHistoryEntry = {
      timestamp: Date.now(),
      destination: destinationId,
      files: [{ filename, url: uri }]
    };
    
    // Add the new entry to filtered history
    filteredHistory.push(newEntry);
    
    await saveFileHistory(filteredHistory);
    console.log(`📝 Added ${filename} to destination ${destinationId} history`);
  } catch (error) {
    console.error(`❌ Error adding file to history:`, error);
  }
};

/**
 * Adds a new file entry to history for any destination
 */
const addToHistory = async (file: GeneratedFile, destination: number): Promise<void> => {
  try {
    // Add the file to the appropriate destination
    await addFileToHistory(destination, file.name, file.uri);
    
  } catch (error) {
    console.error('❌ Error adding to file history:', error);
  }
};

/**
 * Generates a simple test JPG file by creating a base64 encoded minimal JPG
 * @param fileName Optional custom filename (default: test-image-[timestamp].jpg)
 * @returns Promise<GeneratedFile | null>
 */
export const generateTestImage = async (fileName?: string): Promise<GeneratedFile | null> => {
  try {
    console.log('🎨 Starting test image generation...');
    
    // Generate filename with timestamp if not provided
    const timestamp = Date.now();
    const finalFileName = fileName || `test-image-${timestamp}.jpg`;
    
    // Get documents directory path
    const documentsPath = Dirs.DocumentDir;
    const filePath = `${documentsPath}/${finalFileName}`;
    
    console.log('📁 Documents directory:', documentsPath);
    console.log('📄 Full file path:', filePath);
    
    // Create a minimal valid JPG image in base64
    // This is a 1x1 pixel red JPG image
    const minimalJpgBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A';
    
    // Write the base64 data to file
    await FileSystem.writeFile(filePath, minimalJpgBase64, 'base64');
    console.log('💾 File written to device storage');
    
    // Get file stats
    const stats = await FileSystem.stat(filePath);
    
    const result: GeneratedFile = {
      path: filePath,
      uri: `file://${filePath}`,
      name: finalFileName,
      size: stats.size
    };
    
    console.log('✅ Test image generated successfully!');
    console.log('📍 File location:', result.path);
    console.log('🔗 File URI:', result.uri);
    console.log('📊 File size:', result.size, 'bytes');
    console.log('📄 File name:', result.name);
    
    // Add to AsyncStorage history (destination 1)
    await addToHistory(result, 1);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error generating test image:', error);
    return null;
  }
};

/**
 * Generates a larger test JPG with more content (colorful gradient-like pattern)
 */
export const generateColorfulTestImage = async (fileName?: string): Promise<GeneratedFile | null> => {
  try {
    console.log('🎨 Starting colorful test image generation...');
    
    const timestamp = Date.now();
    const finalFileName = fileName || `colorful-test-${timestamp}.jpg`;
    
    const documentsPath = Dirs.DocumentDir;
    const filePath = `${documentsPath}/${finalFileName}`;
    
    console.log('📁 Documents directory:', documentsPath);
    console.log('📄 Full file path:', filePath);
    
    // A larger, more colorful test JPG (100x100 pixels with gradient pattern)
    // This is a base64 encoded JPG with a simple gradient pattern
    const colorfulJpgBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCABkAGQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD/AFSiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9k=';
    
    await FileSystem.writeFile(filePath, colorfulJpgBase64, 'base64');
    console.log('💾 Colorful file written to device storage');
    
    const stats = await FileSystem.stat(filePath);
    
    const result: GeneratedFile = {
      path: filePath,
      uri: `file://${filePath}`,
      name: finalFileName,
      size: stats.size
    };
    
    console.log('✅ Colorful test image generated successfully!');
    console.log('📍 File location:', result.path);
    console.log('🔗 File URI:', result.uri);
    console.log('📊 File size:', result.size, 'bytes');
    console.log('📄 File name:', result.name);
    
    // Add to AsyncStorage history (destination 2)
    await addToHistory(result, 2);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error generating colorful test image:', error);
    return null;
  }
};

/**
 * Lists all generated test images in the documents directory
 * Note: This is a simplified version that returns expected filenames
 */
export const listGeneratedImages = async (): Promise<string[]> => {
  try {
    // Since react-native-file-access doesn't have readdir in this version,
    // we'll return a list based on common test patterns
    // In a real implementation, you'd maintain a list of generated files
    console.log('📋 Listing generated images (simplified)');
    
    // Return empty array for now - in practice you'd store generated filenames
    return [];
    
  } catch (error) {
    console.error('❌ Error listing generated images:', error);
    return [];
  }
};

/**
 * Deletes a generated test image
 */
export const deleteGeneratedImage = async (fileName: string): Promise<boolean> => {
  try {
    const documentsPath = Dirs.DocumentDir;
    const filePath = `${documentsPath}/${fileName}`;
    
    await FileSystem.unlink(filePath);
    console.log('🗑️ Deleted generated image:', fileName);
    return true;
    
  } catch (error) {
    console.error('❌ Error deleting generated image:', error);
    return false;
  }
};

/**
 * Gets the full path for a generated image file
 */
export const getImagePath = (fileName: string): string => {
  return `${Dirs.DocumentDir}/${fileName}`;
};

/**
 * Gets the file URI for a generated image file
 */
export const getImageUri = (fileName: string): string => {
  return `file://${Dirs.DocumentDir}/${fileName}`;
};

/**
 * Gets the current file history from AsyncStorage (exported for external use)
 */
export const getGeneratedFileHistory = async (): Promise<FileHistoryEntry[]> => {
  return await getFileHistory();
};

/**
 * Clears the file history in AsyncStorage
 */
export const clearFileHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
    console.log('🗑️ File history cleared from AsyncStorage');
  } catch (error) {
    console.error('❌ Error clearing file history:', error);
  }
};

/**
 * Ensures clean history structure: exactly 3 destinations with 1 file each
 * Called before generating new files to reset the structure
 */
export const resetHistoryForNewGeneration = async (): Promise<void> => {
  try {
    // Clear existing history to start fresh
    await clearFileHistory();
    console.log('🔄 History reset for new file generation');
  } catch (error) {
    console.error('❌ Error resetting history:', error);
  }
};

/**
 * Creates a PDF-like test file (actually a text file with .pdf extension for testing)
 */
export const generateTestPDF = async (fileName?: string): Promise<GeneratedFile | null> => {
  try {
    console.log('📄 Starting test PDF generation...');
    
    const timestamp = Date.now();
    const finalFileName = fileName || `test-document-${timestamp}.pdf`;
    
    const documentsPath = Dirs.DocumentDir;
    const filePath = `${documentsPath}/${finalFileName}`;
    
    console.log('📁 Documents directory:', documentsPath);
    console.log('📄 Full file path:', filePath);
    
    // Create a simple text content that mimics a PDF structure
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 24 Tf
100 700 Td
(Berri Test Document) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000205 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
299
%%EOF`;
    
    await FileSystem.writeFile(filePath, pdfContent, 'utf8');
    console.log('💾 PDF file written to device storage');
    
    const stats = await FileSystem.stat(filePath);
    
    const result: GeneratedFile = {
      path: filePath,
      uri: `file://${filePath}`,
      name: finalFileName,
      size: stats.size
    };
    
    console.log('✅ Test PDF generated successfully!');
    console.log('📍 File location:', result.path);
    console.log('🔗 File URI:', result.uri);
    console.log('📊 File size:', result.size, 'bytes');
    console.log('📄 File name:', result.name);
    
    // Add to AsyncStorage history (destination 3)
    await addToHistory(result, 3);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error generating test PDF:', error);
    return null;
  }
};

/**
 * Generates all test files (2 JPGs + 1 PDF) and adds them to AsyncStorage history
 */
export const generateAllTestFiles = async (): Promise<{
  image1: GeneratedFile | null;
  image2: GeneratedFile | null;
  pdf: GeneratedFile | null;
}> => {
  console.log('🚀 Starting generation of all test files...');
  
  try {
    // Reset history to ensure clean structure
    await resetHistoryForNewGeneration();
    
    // Generate all files in parallel
    const [image1, image2, pdf] = await Promise.all([
      generateTestImage(),
      generateColorfulTestImage(),
      generateTestPDF()
    ]);
    
    console.log('✅ All test files generated successfully!');
    console.log('📊 Results:');
    console.log('  - Simple JPG (dest 1):', image1 ? '✅' : '❌');
    console.log('  - Colorful JPG (dest 2):', image2 ? '✅' : '❌');
    console.log('  - Test PDF (dest 3):', pdf ? '✅' : '❌');
    
    // Verify history structure
    const finalHistory = await getFileHistory();
    console.log('📋 Final history structure:', finalHistory.length, 'destinations');
    
    return { image1, image2, pdf };
    
  } catch (error) {
    console.error('❌ Error generating all test files:', error);
    return { image1: null, image2: null, pdf: null };
  }
};