import { FileSystem } from 'react-native-file-access';
import { Buffer } from 'buffer';

export const uploadToDrive = async (accessToken: string, fileUri: string) => {
  const metadata = {
    name: 'photo.jpg',
    mimeType: 'image/jpeg'
  };

  const form = new FormData();
  form.append('metadata', {
    type: 'application/json',
    string: JSON.stringify(metadata)
  } as any);
  
  // Clean the file URI and use it directly in FormData
  const cleanUri = fileUri.startsWith('file://') ? fileUri : `file://${fileUri}`;
  
  form.append('file', {
    uri: cleanUri,
    type: 'image/jpeg',
    name: 'photo.jpg'
  } as any);

  try {
    console.log('Google Drive upload - fileUri:', cleanUri);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form
      }
    );

    console.log('Google Drive upload response status:', res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Google Drive upload error:', errorText);
      throw new Error(`Google Drive upload failed: ${res.status} ${errorText}`);
    }

    return res.json();
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw error;
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!! TODO REFRESH TOKEN !!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // await GoogleSignin.signInSilently(); // refresh tokenből új access token
    // const tokens = await GoogleSignin.getTokens();
    // TODO TOKEN ELMENTÉSE
  }
};

export const uploadToDropbox = async (accessToken: string, fileUri: string) => {
  const fileName = fileUri.split('/').pop() || 'photo.jpg';

  console.log("filename:", fileName);
  console.log("fileUri:", fileUri);

  try {
    // Remove 'file://' prefix if present for react-native-file-access
    const filePath = fileUri.replace('file://', '');
    
    // Read file as base64 using react-native-file-access
    const fileBase64 = await FileSystem.readFile(filePath, 'base64');
    console.log("fileBase64 length:", fileBase64.length);

    // Convert base64 to ArrayBuffer for Dropbox API
    // Use built-in Buffer which is available in React Native
    const buffer = Buffer.from(fileBase64, 'base64');
    
    console.log('Dropbox upload - buffer size:', buffer.length);

    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream', // Required by Dropbox API
        'Dropbox-API-Arg': JSON.stringify({ 
          path: `/${fileName}`, 
          mode: 'add', 
          autorename: true, 
          mute: false 
        })
      },
      body: buffer // Send the buffer as binary data
    });

    console.log('Dropbox upload response status:', res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Dropbox upload error:', errorText);
      throw new Error(`Dropbox upload failed: ${res.status} ${errorText}`);
    }

    return res.json();
  } catch (error) { 
    console.error('Error uploading to Dropbox:', error);
    throw error;
  }
};

export const uploadToOneDrive = async (accessToken: string, fileUri: string) => {
  const fileName = fileUri.split('/').pop() || 'photo.jpg';

  try {
    // Clean the file URI - similar to Google Drive approach
    const cleanUri = fileUri.startsWith('file://') ? fileUri : `file://${fileUri}`;
    
    // Try using FormData approach first
    const form = new FormData();
    form.append('file', {
      uri: cleanUri,
      type: 'image/jpeg',
      name: fileName
    } as any);

    console.log('OneDrive upload attempt with FormData - fileUri:', cleanUri);

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        // Let browser set Content-Type for FormData
      },
      body: form
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('OneDrive upload error:', errorText);
      throw new Error(`OneDrive upload failed: ${res.status} ${errorText}`);
    }

    return res.json();
  } catch (error) {
    console.error('Error uploading to OneDrive:', error);
    throw error;
  }
};