import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Text, Button } from '..';

interface DriveFolder {
  id: string;
  name: string;
}

interface GoogleDriveFolderPickerProps {
  visible: boolean;
  accessToken: string;
  onSelect: (folder: { id: string; name: string } | null) => void;
  onCancel: () => void;
  onAuthNeeded?: () => Promise<string | null>; // Re-auth callback, returns new accessToken or null
}

const GoogleDriveFolderPicker: React.FC<GoogleDriveFolderPickerProps> = ({
  visible,
  accessToken,
  onSelect,
  onCancel,
  onAuthNeeded,
}) => {
  const tokenRef = React.useRef(accessToken);
  React.useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [currentFolderName, setCurrentFolderName] = useState<string>('My Drive');
  const [folderStack, setFolderStack] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const fetchFolders = useCallback(
    async (parentId: string) => {
      setLoading(true);
      setError(null);
      try {
        const query = encodeURIComponent(
          `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        );
        const doFetch = async (token: string) => {
          return fetch(
            `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=name&pageSize=100`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );
        };

        let response = await doFetch(tokenRef.current);

        // Auto re-auth on 401
        if (response.status === 401 && onAuthNeeded) {
          console.log('🔑 Google Drive 401 - attempting re-auth...');
          const newToken = await onAuthNeeded();
          if (newToken) {
            tokenRef.current = newToken;
            response = await doFetch(newToken);
          }
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch folders: ${response.status}`);
        }

        const data = await response.json();
        setFolders(data.files || []);
      } catch (err: any) {
        console.error('❌ Error fetching Google Drive folders:', err);
        setError(err.message || 'Failed to load folders');
      } finally {
        setLoading(false);
      }
    },
    [onAuthNeeded],
  );

  useEffect(() => {
    if (visible && accessToken) {
      setCurrentFolderId('root');
      setCurrentFolderName('My Drive');
      setFolderStack([]);
      fetchFolders('root');
    }
  }, [visible, accessToken, fetchFolders]);

  const navigateToFolder = (folder: DriveFolder) => {
    setFolderStack(prev => [
      ...prev,
      { id: currentFolderId, name: currentFolderName },
    ]);
    setCurrentFolderId(folder.id);
    setCurrentFolderName(folder.name);
    fetchFolders(folder.id);
  };

  const navigateBack = () => {
    const stack = [...folderStack];
    const parent = stack.pop();
    if (parent) {
      setFolderStack(stack);
      setCurrentFolderId(parent.id);
      setCurrentFolderName(parent.name);
      fetchFolders(parent.id);
    }
  };

  const handleSelectCurrent = () => {
    if (currentFolderId === 'root') {
      onSelect(null); // root = no specific folder
    } else {
      onSelect({ id: currentFolderId, name: currentFolderName });
    }
  };

  const renderFolder = ({ item }: { item: DriveFolder }) => (
    <TouchableOpacity
      style={styles.folderItem}
      onPress={() => navigateToFolder(item)}
    >
      <Text style={styles.folderIcon}>📁</Text>
      <Text style={styles.folderName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Folder</Text>
          <View style={styles.closeButton} />
        </View>

        <View style={styles.breadcrumb}>
          {folderStack.length > 0 && (
            <TouchableOpacity onPress={navigateBack} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.currentFolder} numberOfLines={1}>
            {currentFolderName}
          </Text>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="white" />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Button
              title="Retry"
              size="medium"
              onPress={() => fetchFolders(currentFolderId)}
            />
          </View>
        ) : (
          <FlatList
            data={folders}
            keyExtractor={item => item.id}
            renderItem={renderFolder}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={styles.emptyText}>No subfolders</Text>
              </View>
            }
            style={styles.list}
          />
        )}

        <View style={styles.footer}>
          <Button
            title={`Save here: ${currentFolderName}`}
            size="medium"
            onPress={handleSelectCurrent}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 20,
    color: 'white',
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    marginRight: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
  },
  backText: {
    color: 'white',
    fontSize: 14,
  },
  currentFolder: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    flex: 1,
  },
  list: {
    flex: 1,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  folderIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  folderName: {
    flex: 1,
    fontSize: 16,
    color: 'white',
  },
  chevron: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default GoogleDriveFolderPicker;
