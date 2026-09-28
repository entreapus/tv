import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  query,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { PlaylistItem, MediaItem } from './videoService';

// Initialize Firebase App safely
let app: FirebaseApp | null = null;
try {
  if (firebaseConfig && firebaseConfig.apiKey) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
} catch (err) {
  console.warn('Firebase initializeApp error, fallback to offline:', err);
}

// Initialize Firestore safely
let firestoreDb: Firestore | null = null;
if (app) {
  try {
    const dbId = firebaseConfig.firestoreDatabaseId;
    if (dbId && dbId !== '(default)') {
      try {
        firestoreDb = getFirestore(app, dbId);
      } catch (customDbErr) {
        console.warn('Custom databaseId failed, falling back to default:', customDbErr);
        firestoreDb = getFirestore(app);
      }
    } else {
      firestoreDb = getFirestore(app);
    }
  } catch (err) {
    console.warn('Firestore initialization error, running in local mode:', err);
  }
}

export const db = firestoreDb;

// Connection test
export async function testFirebaseConnection(): Promise<boolean> {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch {
    return false;
  }
}

// Helper to remove any undefined fields before sending to Firestore
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    } else {
      result[key] = '';
    }
  }
  return result;
}

// =========================================================
// 1. PLAYLIST SYNC (Google Drive + YouTube)
// =========================================================

export function subscribeToPlaylist(callback: (items: PlaylistItem[]) => void) {
  if (!db) return () => {};
  try {
    const q = query(collection(db, 'playlist'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          if (!snapshot.empty) {
            const items: PlaylistItem[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (data && (data.embedUrl || data.originalUrl)) {
                items.push({
                  id: docSnap.id,
                  title: data.title || 'Video Entre Apus TV',
                  category: data.category || 'festividades',
                  author: data.author || 'Entre Apus TV',
                  description: data.description || '',
                  sourceType: data.sourceType || 'youtube',
                  originalUrl: data.originalUrl || '',
                  embedUrl: data.embedUrl || '',
                  thumbnailUrl: data.thumbnailUrl || '',
                  videoId: data.videoId || undefined,
                  fileId: data.fileId || undefined,
                  order: typeof data.order === 'number' ? data.order : 0
                });
              }
            });
            if (items.length > 0) {
              items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
              callback(items);
            }
          }
        } catch (innerErr) {
          console.warn('Error parsing snapshot items:', innerErr);
        }
      },
      (error) => {
        console.warn('Firestore playlist snapshot error, keeping local playlist:', error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Error subscribing to playlist:', err);
    return () => {};
  }
}

export async function savePlaylistToCloud(items: PlaylistItem[]): Promise<boolean> {
  if (!db) return false;
  try {
    // 1. Fetch current playlist documents in Firestore to remove deleted ones
    const currentDocsSnap = await getDocs(collection(db, 'playlist'));
    const currentDocIds = new Set(items.map(i => i.id));
    const deleteBatch = writeBatch(db);
    let hasDeletes = false;

    currentDocsSnap.forEach(d => {
      if (!currentDocIds.has(d.id)) {
        deleteBatch.delete(d.ref);
        hasDeletes = true;
      }
    });

    if (hasDeletes) {
      await deleteBatch.commit();
    }

    // 2. Write all active items in batch
    if (items.length > 0) {
      const batch = writeBatch(db);
      items.forEach((item, index) => {
        const docRef = doc(db, 'playlist', item.id);
        const payload = sanitizeForFirestore({
          title: item.title || 'Video Entre Apus TV',
          category: item.category || 'festividades',
          author: item.author || 'Entre Apus TV',
          description: item.description || '',
          sourceType: item.sourceType || 'youtube',
          originalUrl: item.originalUrl || '',
          embedUrl: item.embedUrl || '',
          thumbnailUrl: item.thumbnailUrl || '',
          videoId: item.videoId || '',
          fileId: item.fileId || '',
          order: index,
          updatedAt: new Date().toISOString()
        });
        batch.set(docRef, payload, { merge: true });
      });
      await batch.commit();
    }

    // 3. Also backup the complete playlist array into settings/general
    await setDoc(
      doc(db, 'settings', 'general'),
      {
        playlistBackup: items.map((it, idx) => ({
          id: it.id,
          title: it.title,
          sourceType: it.sourceType,
          originalUrl: it.originalUrl,
          embedUrl: it.embedUrl,
          thumbnailUrl: it.thumbnailUrl,
          order: idx
        })),
        lastPlaylistUpdate: new Date().toISOString()
      },
      { merge: true }
    );

    return true;
  } catch (err) {
    console.error('Error saving playlist to cloud:', err);
    return false;
  }
}

export async function deletePlaylistItemFromCloud(itemId: string) {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'playlist', itemId));
  } catch (err) {
    console.warn('Error deleting playlist item from cloud:', err);
  }
}

// =========================================================
// 2. GALLERY SYNC (Google Drive Videos & Photos)
// =========================================================

export function subscribeToGallery(callback: (items: MediaItem[]) => void) {
  if (!db) return () => {};
  try {
    const q = query(collection(db, 'gallery'));
    return onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const items: MediaItem[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && data.title) {
              items.push({
                id: docSnap.id,
                title: data.title || '',
                category: data.category || 'festividades',
                author: data.author || 'Entre Apus TV',
                description: data.description || '',
                type: data.type || 'video',
                sourceType: data.sourceType || (data.isGoogleDrive ? 'drive' : 'youtube'),
                videoUrl: data.videoUrl || null,
                photoUrl: data.photoUrl || null,
                driveEmbedUrl: data.driveEmbedUrl || null,
                driveFileId: data.driveFileId || null,
                isGoogleDrive: !!data.isGoogleDrive,
                createdAt: data.createdAt || ''
              });
            }
          });
          if (items.length > 0) {
            // Sort by createdAt desc
            items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            callback(items);
          }
        }
      },
      (err) => {
        console.warn('Firestore gallery snapshot error:', err);
      }
    );
  } catch {
    return () => {};
  }
}

export async function saveGalleryItemToCloud(item: MediaItem): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, 'gallery', item.id);
    const payload = sanitizeForFirestore({
      title: item.title,
      category: item.category,
      author: item.author,
      description: item.description || '',
      type: item.type,
      sourceType: item.sourceType || (item.isGoogleDrive ? 'drive' : 'youtube'),
      videoUrl: item.videoUrl || '',
      photoUrl: item.photoUrl || '',
      driveEmbedUrl: item.driveEmbedUrl || '',
      driveFileId: item.driveFileId || '',
      isGoogleDrive: !!item.isGoogleDrive,
      createdAt: item.createdAt || new Date().toISOString()
    });
    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.error('Error saving gallery item to cloud:', err);
    return false;
  }
}

export async function deleteGalleryItemFromCloud(itemId: string) {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'gallery', itemId));
  } catch (err) {
    console.warn('Error deleting gallery item from cloud:', err);
  }
}

// =========================================================
// 3. SITE SETTINGS SYNC (Live stream, Cover)
// =========================================================

export interface CloudSiteSettings {
  liveTitle?: string;
  liveUrl?: string;
  isLiveActive?: boolean;
  coverImageUrl?: string;
}

export function subscribeToSiteSettings(callback: (settings: CloudSiteSettings) => void) {
  if (!db) return () => {};
  try {
    return onSnapshot(
      doc(db, 'settings', 'general'),
      (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data() as CloudSiteSettings);
        }
      },
      (err) => {
        console.warn('Firestore settings snapshot error:', err);
      }
    );
  } catch {
    return () => {};
  }
}

export async function saveSiteSettingsToCloud(settings: CloudSiteSettings): Promise<boolean> {
  if (!db) return false;
  try {
    const payload = sanitizeForFirestore({
      liveTitle: settings.liveTitle ?? '',
      liveUrl: settings.liveUrl ?? '',
      isLiveActive: settings.isLiveActive ?? false,
      coverImageUrl: settings.coverImageUrl ?? '',
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'settings', 'general'), payload, { merge: true });
    return true;
  } catch (err) {
    console.error('Error saving site settings to cloud:', err);
    return false;
  }
}
