import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Radio,
  Play,
  Upload,
  Camera,
  Heart,
  Send,
  MessageSquare,
  Compass,
  MapPin,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  FileCode,
  HardDrive,
  Info,
  Menu,
  X,
  Layers,
  Youtube,
  Settings,
  ListPlus,
  Sparkles,
  Film,
  Share2,
  Cloud,
  CloudUpload
} from 'lucide-react';
import {
  PlaylistItem,
  MediaItem,
  INITIAL_PLAYLIST,
  detectAndParseVideoUrl,
  encodePlaylistForUrl,
  decodePlaylistFromUrl,
  cleanRawVideoUrl
} from './videoService';
import {
  subscribeToPlaylist,
  savePlaylistToCloud,
  subscribeToSiteSettings,
  saveSiteSettingsToCloud,
  testFirebaseConnection,
  subscribeToGallery,
  saveGalleryItemToCloud,
  deleteGalleryItemFromCloud
} from './firebase';
import { VideoManagerModal } from './VideoManagerModal';
import { VideoPlayerSection } from './VideoPlayerSection';
import { SocialMediaBar, FacebookIcon, YoutubeIcon, TiktokIcon, InstagramIcon } from './SocialIcons';

interface Greeting {
  id: string;
  name: string;
  location: string;
  message: string;
  date: string;
}

interface ChatMessage {
  id: string;
  author: string;
  text: string;
  isSelf?: boolean;
}

const CATEGORY_PRESET_IMAGES: Record<string, string> = {
  festividades: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=800&q=80',
  paisajes: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  folklore: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
  comunidad: 'https://images.unsplash.com/photo-1582650625119-3a31f841807d?auto=format&fit=crop&w=800&q=80'
};

const INITIAL_GALLERY: MediaItem[] = [
  {
    id: 'photo-1',
    title: 'Apus Tutelares y Cañón de Chalhuanca',
    category: 'paisajes',
    author: 'Entre Apus TV',
    description: 'Imponentes montañas que abrazan el valle aymarino, patrimonio geográfico y espiritual.',
    type: 'photo',
    photoUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'photo-2',
    title: 'Plaza de Armas de Chalhuanca',
    category: 'comunidad',
    author: 'Entre Apus TV',
    description: 'Encuentro ciudadano y cotidianeidad en el corazón de la provincia de Aymaraes.',
    type: 'photo',
    photoUrl: 'https://images.unsplash.com/photo-1582650625119-3a31f841807d?auto=format&fit=crop&w=800&q=80'
  }
];

export default function App() {
  // Navigation & admin state
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [videoManagerOpen, setVideoManagerOpen] = useState(false);
  const [liveConfigModalOpen, setLiveConfigModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [coverModalOpen, setCoverModalOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [lightboxAspect, setLightboxAspect] = useState<'fit' | 'vertical' | 'cinema' | 'full'>('fit');
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);

  // Admin login form
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // 1. PLAYLIST & VIDEO STATE (YouTube & Drive Automatic Detection)
  // 1. PLAYLIST & VIDEO STATE (YouTube & Drive Automatic Detection)
  // Supports reading shared URL parameters (?pl=...), localStorage, or INITIAL_PLAYLIST
  const [playlist, setPlaylist] = useState<PlaylistItem[]>(() => {
    try {
      // 1. Check if playlist was shared via URL (?pl=...)
      if (typeof window !== 'undefined' && window.location.search) {
        const searchParams = new URLSearchParams(window.location.search);
        const urlPl = searchParams.get('pl');
        if (urlPl) {
          const decoded = decodePlaylistFromUrl(urlPl);
          if (decoded && decoded.length > 0) {
            localStorage.setItem('entreapus_video_playlist', JSON.stringify(decoded));
            return decoded;
          }
        }
      }

      // 2. Check localStorage
      const saved = localStorage.getItem('entreapus_video_playlist');
      if (saved) {
        const parsed: PlaylistItem[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }

      // 3. Fallback to Initial Cultural Playlist so page is never empty
      return INITIAL_PLAYLIST;
    } catch {
      return INITIAL_PLAYLIST;
    }
  });

  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState<number>(0);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('entreapus_live_active') === 'true';
    } catch {
      return false;
    }
  });
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [hasCloudConnection, setHasCloudConnection] = useState<boolean>(false);

  // Save playlist to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('entreapus_video_playlist', JSON.stringify(playlist));
    } catch {}
  }, [playlist]);

  // Real-time synchronization with Firestore Cloud Database
  useEffect(() => {
    testFirebaseConnection().then(ok => setHasCloudConnection(ok));

    // Subscribe to cloud playlist
    const unsubscribePlaylist = subscribeToPlaylist((cloudItems) => {
      if (cloudItems && cloudItems.length > 0) {
        setPlaylist(cloudItems);
        try {
          localStorage.setItem('entreapus_video_playlist', JSON.stringify(cloudItems));
        } catch {}
      } else {
        // If Firestore is empty, seed it with the current local playlist so it persists online
        if (playlist.length > 0) {
          savePlaylistToCloud(playlist);
        }
      }
    });

    // Subscribe to cloud gallery (Google Drive videos and photos)
    const unsubscribeGallery = subscribeToGallery((cloudMedia) => {
      if (cloudMedia && cloudMedia.length > 0) {
        setGallery(cloudMedia);
        try {
          localStorage.setItem('entreapus_gallery_items', JSON.stringify(cloudMedia));
        } catch {}
      }
    });

    // Subscribe to cloud settings
    const unsubscribeSettings = subscribeToSiteSettings((settings) => {
      if (settings.liveUrl) {
        setLiveUrlInput(settings.liveUrl);
      }
      if (settings.liveTitle) {
        setLiveTitleInput(settings.liveTitle);
      }
      if (settings.isLiveActive !== undefined) {
        setIsLiveActive(settings.isLiveActive);
        try {
          localStorage.setItem('entreapus_live_active', settings.isLiveActive ? 'true' : 'false');
        } catch {}
      }
      if (settings.coverImageUrl) {
        setCoverImageUrl(settings.coverImageUrl);
        try {
          localStorage.setItem('entreapus_cover_url', settings.coverImageUrl);
        } catch {}
      }
    });

    return () => {
      unsubscribePlaylist();
      unsubscribeGallery();
      unsubscribeSettings();
    };
  }, []);

  const handleUpdatePlaylist = async (newPlaylist: PlaylistItem[]) => {
    if (!isAdmin) {
      showToast('Acceso Denegado', 'Debes identificarte como administrador para modificar los videos.', 'error');
      return;
    }
    setPlaylist(newPlaylist);
    try {
      localStorage.setItem('entreapus_video_playlist', JSON.stringify(newPlaylist));
    } catch {}
    setIsCloudSyncing(true);
    await savePlaylistToCloud(newPlaylist);
    setIsCloudSyncing(false);
  };

  const handleUploadAllToCloud = async () => {
    if (!isAdmin) {
      showToast('Acceso Denegado', 'Solo el administrador puede sincronizar con la nube.', 'error');
      return;
    }
    setIsCloudSyncing(true);
    showToast('Subiendo a la Nube', 'Sincronizando videos y configuración con Firebase Firestore...', 'info');
    const ok = await savePlaylistToCloud(playlist);
    await saveSiteSettingsToCloud({
      liveUrl: liveUrlInput,
      liveTitle: liveTitleInput,
      isLiveActive,
      coverImageUrl
    });
    setIsCloudSyncing(false);
    if (ok) {
      showToast('Nube Actualizada', 'Todos los videos han sido subidos a la base de datos Firestore.', 'success');
    } else {
      showToast('Guardado Local', 'Guardado localmente en este dispositivo.', 'info');
    }
  };

  // Gallery state - saves to localStorage and synchronizes with Firestore cloud
  const [gallery, setGallery] = useState<MediaItem[]>(() => {
    try {
      const saved = localStorage.getItem('entreapus_gallery_items');
      if (saved) {
        const parsed: MediaItem[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      return INITIAL_GALLERY;
    } catch {
      return INITIAL_GALLERY;
    }
  });

  // Save gallery to localStorage whenever updated (Ensures Google Drive videos persist!)
  useEffect(() => {
    try {
      localStorage.setItem('entreapus_gallery_items', JSON.stringify(gallery));
    } catch {}
  }, [gallery]);

  const [filterCategory, setFilterCategory] = useState<string>('todos');
  const [coverImageUrl, setCoverImageUrl] = useState<string>(() => {
    return localStorage.getItem('entreapus_cover_url') || 'https://drive.google.com/thumbnail?id=1th_earNmAA5JojTVVutxh6wAC2zW0hW_&sz=w1200';
  });

  // State to play video directly inline inside the gallery card
  const [playingInlineId, setPlayingInlineId] = useState<string | null>(null);

  // Live Config Input
  const [liveUrlInput, setLiveUrlInput] = useState<string>(() => {
    return localStorage.getItem('entreapus_live_url') || '';
  });
  const [liveTitleInput, setLiveTitleInput] = useState<string>(() => {
    return localStorage.getItem('entreapus_live_title') || '';
  });

  // Upload Form State (Gallery)
  const [uploadTab, setUploadTab] = useState<'video' | 'photo'>('video');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<'festividades' | 'paisajes' | 'folklore' | 'comunidad'>('festividades');
  const [uploadAuthor, setUploadAuthor] = useState('Entre Apus TV');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadUrl, setUploadUrl] = useState('');
  const [alsoAddToPlaylist, setAlsoAddToPlaylist] = useState<boolean>(true);

  // Cover modal
  const [coverDriveUrl, setCoverDriveUrl] = useState('');

  // Greetings Wall
  const [greetings, setGreetings] = useState<Greeting[]>([
    {
      id: 'g-1',
      name: 'Familia Quispe Palomino',
      location: 'Cusco',
      message: 'Un saludo cariñoso a todo el pueblo de Chalhuanca. Orgullosos de nuestras raíces andinas y el trabajo de Entre Apus TV.',
      date: 'Reciente'
    },
    {
      id: 'g-2',
      name: 'Sonia Mendoza',
      location: 'Madrid, España',
      message: 'Desde tan lejos los vemos cada semana. Muchas bendiciones a la hermandad del Señor de Ánimas.',
      date: 'Reciente'
    }
  ]);
  const [greetingName, setGreetingName] = useState('');
  const [greetingLocation, setGreetingLocation] = useState('');
  const [greetingMessage, setGreetingMessage] = useState('');

  // Live Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 'c-1', author: 'Entre Apus TV', text: '¡Bienvenidos a nuestra señal oficial! Dejen sus saludos para Chalhuanca y Aymaraes.' },
    { id: 'c-2', author: 'María Huamán (Lima)', text: 'Saludos a toda mi familia en Chalhuanca. Siempre conectados viendo nuestras costumbres.' },
    { id: 'c-3', author: 'Carlos Rivas (Arequipa)', text: '¡Viva el Señor de Ánimas! Gran trabajo de Entre Apus TV por mantenernos cerca.' }
  ]);
  const [chatInput, setChatInput] = useState('');

  // Notification Toast
  const [toast, setToast] = useState<{ title: string; message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (title: string, message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ title, message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Sync admin state
  useEffect(() => {
    const auth = localStorage.getItem('entreapus_admin_auth');
    if (auth === 'true') {
      setIsAdmin(true);
    }
  }, []);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = adminUser.trim().toLowerCase();
    const cleanPass = adminPass.trim();

    if (cleanUser === 'entreapus' && cleanPass === 'Entreapus@tv2021') {
      setIsAdmin(true);
      localStorage.setItem('entreapus_admin_auth', 'true');
      setAdminModalOpen(false);
      setAdminUser('');
      setAdminPass('');
      setLoginError('');
      showToast('Sesión Iniciada', 'Bienvenido al panel administrativo de Entre Apus TV', 'success');
    } else {
      setLoginError('Credenciales incorrectas. Verifique el usuario y contraseña.');
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('entreapus_admin_auth');
    showToast('Sesión Cerrada', 'Has vuelto al modo visitante.', 'info');
  };

  // Select video in player
  const handleSelectVideo = (index: number) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentPlaylistIndex(index);
      setIsLiveActive(false);
    }
  };

  // Share link with currently loaded playlist so any visitor sees all videos
  const handleSharePlaylist = () => {
    try {
      const baseUrl = window.location.origin + window.location.pathname;
      const encoded = encodePlaylistForUrl(playlist);
      const shareUrl = encoded ? `${baseUrl}?pl=${encoded}` : baseUrl;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl);
        showToast('Enlace Copiado', 'Copia enviada. Al abrirlo en cualquier dispositivo, cargará todos los videos configurados.', 'success');
      } else {
        showToast('Enlace Generado', shareUrl, 'info');
      }
    } catch {
      showToast('Error', 'No se pudo generar el enlace.', 'error');
    }
  };

  // Live Config
  const handleLiveConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Acceso Denegado', 'Solo el administrador puede configurar la señal en vivo.', 'error');
      return;
    }
    if (!liveUrlInput) return;

    const cleanUrl = cleanRawVideoUrl(liveUrlInput);
    const detected = detectAndParseVideoUrl(cleanUrl);
    if (!detected.isValid) {
      showToast('Enlace inválido', 'Ingresa una URL válida de YouTube Live o Google Drive.', 'error');
      return;
    }

    const liveTitle = liveTitleInput.trim() || 'Transmisión En Vivo Oficial';
    const liveItem: PlaylistItem = {
      id: 'live_' + Date.now(),
      title: liveTitle,
      category: 'festividades',
      author: 'Entre Apus TV',
      description: 'Transmisión en directo al aire',
      sourceType: detected.sourceType,
      originalUrl: cleanUrl,
      embedUrl: detected.embedUrl,
      thumbnailUrl: detected.thumbnailUrl,
      videoId: detected.sourceType === 'youtube' ? detected.identifier : undefined,
      fileId: detected.sourceType === 'drive' ? detected.identifier : undefined
    };

    const newPlaylist = [liveItem, ...playlist.filter(p => !p.id.startsWith('live_'))];
    setPlaylist(newPlaylist);
    setCurrentPlaylistIndex(0);
    setIsLiveActive(true);
    setLiveConfigModalOpen(false);

    try {
      localStorage.setItem('entreapus_live_url', cleanUrl);
      localStorage.setItem('entreapus_live_title', liveTitle);
      localStorage.setItem('entreapus_live_active', 'true');
      localStorage.setItem('entreapus_video_playlist', JSON.stringify(newPlaylist));
    } catch {}

    setIsCloudSyncing(true);
    await savePlaylistToCloud(newPlaylist);
    await saveSiteSettingsToCloud({
      liveUrl: cleanUrl,
      liveTitle: liveTitle,
      isLiveActive: true,
      coverImageUrl
    });
    setIsCloudSyncing(false);

    showToast('Transmisión al Aire', 'La señal en vivo ha sido configurada y guardada en la nube.', 'success');
  };

  const stopLiveAndRestoreArchive = async () => {
    if (!isAdmin) return;
    setIsLiveActive(false);
    setLiveConfigModalOpen(false);
    try {
      localStorage.setItem('entreapus_live_active', 'false');
    } catch {}
    await saveSiteSettingsToCloud({
      isLiveActive: false
    });
    showToast('Señal en Espera', 'Se ha restablecido la lista cultural continua.', 'info');
  };

  // Upload to Gallery with Auto-Detection & Persistent Cloud Storage
  const handleGalleryUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Acceso Denegado', 'Solo el administrador puede subir contenido a la galería.', 'error');
      return;
    }
    if (!uploadTitle.trim() || !uploadUrl.trim()) return;

    const cleanedUrl = cleanRawVideoUrl(uploadUrl.trim());

    if (uploadTab === 'video') {
      const detected = detectAndParseVideoUrl(cleanedUrl);
      if (!detected.isValid) {
        showToast('Enlace de video inválido', detected.error || 'El enlace debe pertenecer a YouTube o Google Drive.', 'error');
        return;
      }

      // Thumbnail is taken strictly from the video itself:
      // YouTube -> official extracted video frame
      // Drive -> drive preview / thumbnail
      const videoSelfThumbnail = detected.sourceType === 'youtube'
        ? `https://img.youtube.com/vi/${detected.identifier}/hqdefault.jpg`
        : `https://drive.google.com/thumbnail?id=${detected.identifier}&sz=w800`;

      const newMedia: MediaItem = {
        id: 'gallery_' + Date.now(),
        title: uploadTitle.trim(),
        category: uploadCategory,
        author: uploadAuthor.trim() || 'Entre Apus TV',
        description: uploadDescription.trim(),
        type: 'video',
        sourceType: detected.sourceType,
        videoUrl: cleanedUrl,
        isGoogleDrive: detected.sourceType === 'drive',
        driveFileId: detected.sourceType === 'drive' ? detected.identifier : undefined,
        driveEmbedUrl: detected.sourceType === 'drive' ? detected.embedUrl : undefined,
        photoUrl: videoSelfThumbnail,
        createdAt: new Date().toISOString()
      };

      // Also add to playback playlist if chosen
      if (alsoAddToPlaylist) {
        const newPlaylistItem: PlaylistItem = {
          id: 'pl_' + newMedia.id,
          title: uploadTitle.trim(),
          category: uploadCategory,
          author: uploadAuthor.trim() || 'Entre Apus TV',
          description: uploadDescription.trim(),
          sourceType: detected.sourceType,
          originalUrl: cleanedUrl,
          embedUrl: detected.embedUrl,
          thumbnailUrl: videoSelfThumbnail,
          videoId: detected.sourceType === 'youtube' ? detected.identifier : undefined,
          fileId: detected.sourceType === 'drive' ? detected.identifier : undefined
        };
        const updatedPlaylist = [...playlist, newPlaylistItem];
        setPlaylist(updatedPlaylist);
        try {
          localStorage.setItem('entreapus_video_playlist', JSON.stringify(updatedPlaylist));
        } catch {}
        await savePlaylistToCloud(updatedPlaylist);
      }

      const updatedGallery = [newMedia, ...gallery];
      setGallery(updatedGallery);
      try {
        localStorage.setItem('entreapus_gallery_items', JSON.stringify(updatedGallery));
      } catch {}
      await saveGalleryItemToCloud(newMedia);

      setFilterCategory('todos');
      setUploadModalOpen(false);
      resetUploadForm();
      showToast('Video Publicado', `"${uploadTitle}" se guardó permanentemente en la página.`, 'success');
      setTimeout(() => {
        document.getElementById('galeria')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      // Photo
      const detected = detectAndParseVideoUrl(cleanedUrl);
      const photoSrc = detected.sourceType === 'drive'
        ? `https://drive.google.com/thumbnail?id=${detected.identifier}&sz=w800`
        : cleanedUrl;

      const newMedia: MediaItem = {
        id: 'gallery_' + Date.now(),
        title: uploadTitle.trim(),
        category: uploadCategory,
        author: uploadAuthor.trim() || 'Entre Apus TV',
        description: uploadDescription.trim(),
        type: 'photo',
        photoUrl: photoSrc,
        isGoogleDrive: detected.sourceType === 'drive',
        driveFileId: detected.sourceType === 'drive' ? detected.identifier : undefined,
        createdAt: new Date().toISOString()
      };

      const updatedGallery = [newMedia, ...gallery];
      setGallery(updatedGallery);
      try {
        localStorage.setItem('entreapus_gallery_items', JSON.stringify(updatedGallery));
      } catch {}
      await saveGalleryItemToCloud(newMedia);

      setFilterCategory('todos');
      setUploadModalOpen(false);
      resetUploadForm();
      showToast('Foto Publicada', `"${uploadTitle}" se guardó en la galería cultural.`, 'success');
      setTimeout(() => {
        document.getElementById('galeria')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const resetUploadForm = () => {
    setUploadTitle('');
    setUploadUrl('');
    setUploadAuthor('Entre Apus TV');
    setUploadDescription('');
    setAlsoAddToPlaylist(true);
  };

  const deleteGalleryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) {
      showToast('Acceso Denegado', 'Solo el administrador puede eliminar elementos.', 'error');
      return;
    }
    const updated = gallery.filter(i => i.id !== id);
    setGallery(updated);
    try {
      localStorage.setItem('entreapus_gallery_items', JSON.stringify(updated));
    } catch {}
    if (playingInlineId === id) setPlayingInlineId(null);
    await deleteGalleryItemFromCloud(id);
    showToast('Elemento Eliminado', 'Se ha retirado de la galería y de la base de datos.', 'info');
  };

  // Helper to get embeddable iframe URL for media in gallery
  const getEmbedUrlForMedia = (item: MediaItem): string => {
    if (item.driveEmbedUrl) return item.driveEmbedUrl;
    if (item.driveFileId) return `https://drive.google.com/file/d/${item.driveFileId}/preview`;
    if (item.videoUrl) {
      const detected = detectAndParseVideoUrl(item.videoUrl);
      if (detected.isValid && detected.embedUrl) {
        return detected.embedUrl;
      }
      return item.videoUrl;
    }
    return '';
  };

  // Helper to get thumbnail image URL for media in gallery (Guarantees an image always shows!)
  const getThumbnailForMedia = (item: MediaItem): string => {
    // 1. If item has photoUrl and it's not a legacy broken url
    if (item.photoUrl && !item.photoUrl.includes('lh3.googleusercontent.com/d/')) {
      return item.photoUrl;
    }
    // 2. If YouTube: official YouTube thumbnail
    if (item.sourceType === 'youtube' || (item.videoUrl && (item.videoUrl.includes('youtu.be') || item.videoUrl.includes('youtube.com')))) {
      const detected = detectAndParseVideoUrl(item.videoUrl || '');
      if (detected.thumbnailUrl) return detected.thumbnailUrl;
    }
    // 3. If Google Drive: try drive thumbnail endpoint
    const driveId = item.driveFileId || (item.videoUrl ? detectAndParseVideoUrl(item.videoUrl).identifier : null);
    if (driveId && (item.isGoogleDrive || item.sourceType === 'drive')) {
      return `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`;
    }
    // 4. Reliable cultural category preset photo
    return CATEGORY_PRESET_IMAGES[item.category] || CATEGORY_PRESET_IMAGES.festividades;
  };

  // Clear all videos from playlist and gallery
  const handleClearAllVideos = async () => {
    if (!isAdmin) return;
    if (window.confirm('¿Confirmas eliminar TODOS los videos del sistema (lista de reproducción y galería audiovisual)?')) {
      setPlaylist([]);
      const cleanGallery = gallery.filter(i => i.type !== 'video');
      setGallery(cleanGallery);
      setPlayingInlineId(null);
      try {
        localStorage.setItem('entreapus_video_playlist', JSON.stringify([]));
        localStorage.setItem('entreapus_gallery_items', JSON.stringify(cleanGallery));
      } catch {}
      await savePlaylistToCloud([]);
      showToast('Videos Eliminados', 'Se han eliminado todos los videos del sistema.', 'info');
    }
  };

  // Clear only gallery videos
  const handleClearAllGalleryVideos = () => {
    if (!isAdmin) return;
    if (window.confirm('¿Confirmas eliminar todos los videos guardados en la galería cultural?')) {
      const cleanGallery = gallery.filter(i => i.type !== 'video');
      setGallery(cleanGallery);
      setPlayingInlineId(null);
      try {
        localStorage.setItem('entreapus_gallery_items', JSON.stringify(cleanGallery));
      } catch {}
      showToast('Galería Depurada', 'Se han eliminado todos los videos de la galería.', 'info');
    }
  };

  const handleCoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Acceso Denegado', 'Solo el administrador puede cambiar la portada.', 'error');
      return;
    }
    const cleanUrl = cleanRawVideoUrl(coverDriveUrl);
    const detected = detectAndParseVideoUrl(cleanUrl);
    let imgUrl = cleanUrl;
    if (detected.sourceType === 'drive' && detected.identifier) {
      imgUrl = `https://drive.google.com/thumbnail?id=${detected.identifier}&sz=w1600`;
    }
    setCoverImageUrl(imgUrl);
    try {
      localStorage.setItem('entreapus_cover_url', imgUrl);
    } catch {}
    await saveSiteSettingsToCloud({ coverImageUrl: imgUrl });
    setCoverModalOpen(false);
    showToast('Portada Actualizada', 'Nueva portada configurada y guardada.', 'success');
  };

  const handleSendGreeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!greetingName || !greetingMessage) return;

    const newGreeting: Greeting = {
      id: 'g_' + Date.now(),
      name: greetingName,
      location: greetingLocation || 'Chalhuanca',
      message: greetingMessage,
      date: 'Hace un momento'
    };

    setGreetings(prev => [newGreeting, ...prev]);
    setGreetingName('');
    setGreetingLocation('');
    setGreetingMessage('');
    showToast('¡Saludo Publicado!', 'Tu mensaje ya está en el muro comunitario.', 'success');
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      author: 'Tú (Visitante)',
      text: chatInput.trim(),
      isSelf: true
    };
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput('');
  };

  // Open lightbox with auto-detected aspect ratio
  const openMediaInLightbox = (item: MediaItem) => {
    const isLikelyVertical = item.type === 'video' && /vertical|reel|short|tiktok|celular|procesion|móvil|movil|templo/i.test(item.title + ' ' + (item.description || ''));
    setLightboxAspect(isLikelyVertical ? 'vertical' : 'fit');
    setLightboxItem(item);
  };

  // Transmit item from gallery into the main video player
  const transmitGalleryItemToPlayer = async (item: MediaItem) => {
    if (!isAdmin) {
      showToast('Solo Administrador', 'Debes identificarte como administrador para emitir videos al reproductor principal.', 'info');
      return;
    }
    if (item.type !== 'video' || !item.videoUrl) return;

    // Check if already in playlist
    const foundIndex = playlist.findIndex(p => 
      (item.driveFileId && p.fileId === item.driveFileId) ||
      p.originalUrl === item.videoUrl ||
      p.embedUrl === item.videoUrl ||
      p.title === item.title
    );
    if (foundIndex >= 0) {
      setCurrentPlaylistIndex(foundIndex);
    } else {
      // Add as first and play
      const cleanUrl = cleanRawVideoUrl(item.videoUrl);
      const detected = detectAndParseVideoUrl(cleanUrl);
      const newPlaylistItem: PlaylistItem = {
        id: 'pl_trans_' + Date.now(),
        title: item.title,
        category: item.category,
        author: item.author,
        description: item.description,
        sourceType: detected.sourceType,
        originalUrl: cleanUrl,
        embedUrl: detected.embedUrl || cleanUrl,
        thumbnailUrl: item.photoUrl || detected.thumbnailUrl,
        videoId: detected.sourceType === 'youtube' ? detected.identifier : undefined,
        fileId: detected.sourceType === 'drive' ? detected.identifier : undefined
      };
      const updatedPlaylist = [newPlaylistItem, ...playlist];
      setPlaylist(updatedPlaylist);
      setCurrentPlaylistIndex(0);
      try {
        localStorage.setItem('entreapus_video_playlist', JSON.stringify(updatedPlaylist));
      } catch {}
      setIsCloudSyncing(true);
      await savePlaylistToCloud(updatedPlaylist);
      setIsCloudSyncing(false);
    }

    showToast('Cargado al Reproductor', `"${item.title}" está en emisión.`, 'success');
    document.getElementById('transmision')?.scrollIntoView({ behavior: 'smooth' });
  };

  const filteredGallery = gallery.filter(item => {
    if (filterCategory === 'todos') return true;
    if (filterCategory === 'videos') return item.type === 'video';
    if (filterCategory === 'fotos') return item.type === 'photo';
    return item.category === filterCategory;
  });

  return (
    <div className="bg-[#040915] text-slate-100 font-sans min-h-screen flex flex-col selection:bg-amber-500 selection:text-slate-950">
      
      {/* Top Admin Sticky Notification Bar */}
      {isAdmin && (
        <aside className="bg-gradient-to-r from-amber-600 via-amber-500 to-rose-600 text-slate-950 text-xs font-bold py-2 px-4 sticky top-0 z-50 shadow-xl flex items-center justify-between">
          <div className="max-w-7xl mx-auto w-full flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-950 animate-ping"></span>
              <ShieldCheck className="w-4 h-4 text-slate-950" />
              <span>MODO ADMINISTRADOR ACTIVO — Entre Apus TV</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setUploadModalOpen(true)}
                className="px-3 py-1 bg-slate-950 text-emerald-300 hover:bg-slate-900 rounded-lg border border-emerald-400/50 flex items-center gap-1.5 transition text-[11px] shadow font-extrabold"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ Subir Contenido</span>
              </button>

              <button
                onClick={() => setVideoManagerOpen(true)}
                className="px-3 py-1 bg-slate-950 text-amber-300 hover:bg-slate-900 rounded-lg border border-amber-400/50 flex items-center gap-1.5 transition text-[11px] shadow"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Gestionar Videos ({playlist.length})</span>
              </button>

              <button
                onClick={() => setLiveConfigModalOpen(true)}
                className="px-3 py-1 bg-slate-950/80 hover:bg-slate-900 text-white rounded-lg border border-white/20 flex items-center gap-1.5 transition text-[11px]"
              >
                <Radio className="w-3.5 h-3.5 text-rose-400" />
                <span>En Vivo</span>
              </button>

              <button
                onClick={() => setCoverModalOpen(true)}
                className="px-3 py-1 bg-slate-950/80 hover:bg-slate-900 text-amber-300 rounded-lg border border-amber-400/40 flex items-center gap-1.5 transition text-[11px]"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span>Portada</span>
              </button>

              <button
                onClick={handleUploadAllToCloud}
                disabled={isCloudSyncing}
                className="px-3 py-1 bg-blue-950/80 hover:bg-blue-900 text-blue-200 rounded-lg border border-blue-400/40 flex items-center gap-1.5 transition text-[11px]"
                title="Sincronizar toda la configuración con Firebase Firestore"
              >
                <CloudUpload className="w-3.5 h-3.5 text-blue-300" />
                <span>{isCloudSyncing ? 'Sincronizando...' : 'Sincronizar Nube'}</span>
              </button>

              <a
                href="https://drive.google.com/drive/folders/1m6YBpxlpjvtZWu0HjgAzVaKktjDPzwCP?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-slate-950/80 hover:bg-slate-900 text-slate-300 rounded-lg border border-slate-700 flex items-center gap-1.5 transition text-[11px]"
              >
                <HardDrive className="w-3.5 h-3.5 text-blue-300" />
                <span>Drive</span>
              </a>

              <button
                onClick={handleClearAllVideos}
                className="px-3 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-200 rounded-lg border border-rose-500/40 flex items-center gap-1.5 transition text-[11px]"
                title="Eliminar todos los videos del reproductor y de la galería"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Videos</span>
              </button>

              <button
                onClick={() => setAnalysisModalOpen(true)}
                className="px-3 py-1 bg-slate-950/80 hover:bg-slate-900 text-slate-300 rounded-lg border border-white/20 flex items-center gap-1.5 transition text-[11px]"
              >
                <FileCode className="w-3.5 h-3.5 text-slate-300" />
                <span>Diagnóstico</span>
              </button>

              <button
                onClick={handleAdminLogout}
                className="px-3 py-1 bg-red-950 hover:bg-red-900 text-red-200 rounded-lg border border-red-500/40 transition text-[11px]"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-[#040915]/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Logo */}
            <a href="#inicio" className="flex items-center gap-3.5 group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 border border-amber-500/40 p-1 flex items-center justify-center shadow-lg group-hover:scale-105 transition">
                <svg viewBox="0 0 500 320" className="w-full h-full object-contain filter drop-shadow">
                  <polygon points="120,180 250,30 380,180" fill="#1e3a8a" stroke="#38bdf8" strokeWidth="6" />
                  <polygon points="250,30 220,90 240,80 250,105 260,80 280,90" fill="#ffffff" />
                  <rect x="340" y="110" width="130" height="95" rx="20" fill="#ef4444" stroke="#f87171" strokeWidth="5" />
                  <text x="405" y="175" fontFamily="'Cinzel', serif" fontWeight="900" fontSize="52" fill="#ffffff" textAnchor="middle">TV</text>
                  <text x="210" y="135" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="64" fill="#ffffff" textAnchor="middle">Entre</text>
                  <text x="220" y="205" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="78" fill="#4ade80" textAnchor="middle">Apus</text>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-extrabold text-lg sm:text-2xl tracking-wider text-white group-hover:text-amber-400 transition">
                    ENTRE APUS TV
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                    VIVO
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-amber-400 tracking-wider uppercase">
                  Chalhuanca - Aymaraes
                </p>
              </div>
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-6">
              <a href="#inicio" className="text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-amber-400 transition">Inicio</a>
              <a href="#transmision" className="text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-amber-400 transition flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                <span>Transmisión en Vivo</span>
              </a>
              <a href="#galeria" className="text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-amber-400 transition">Archivo Audiovisual</a>
              <a href="#editorial" className="text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-amber-400 transition">Nuestra Identidad</a>
              <a href="#saludos" className="text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-amber-400 transition">Saludos</a>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Social Media Icons (Facebook, YouTube, TikTok, Instagram) */}
              <div className="hidden xl:flex items-center">
                <SocialMediaBar size="sm" />
              </div>

              {isAdmin && (
                <button
                  onClick={() => setVideoManagerOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg transition"
                >
                  <Layers className="w-4 h-4" />
                  <span>Gestionar Videos ({playlist.length})</span>
                </button>
              )}

              <a
                href="https://wa.me/51912900359?text=Hola%20Entre%20Apus%20TV,%20deseo%20coordinar%20una%20cobertura"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition"
              >
                <span>WhatsApp</span>
              </a>

              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  <div className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Admin Activo</span>
                  </div>
                  <button
                    onClick={handleAdminLogout}
                    className="px-2.5 py-2 rounded-xl text-xs font-bold bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-500/40 transition shadow"
                    title="Cerrar Sesión Administrador"
                  >
                    Salir
                  </button>
                </div>
              )}

              {/* Botón Menú - Ahora da acceso al Menú donde se encuentra la opción de Acceso Admin */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 sm:px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1.5 transition"
                title="Menú"
                aria-label="Abrir Menú"
              >
                {mobileMenuOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
                <span className="text-xs font-semibold">Menú</span>
              </button>
            </div>

          </div>
        </div>

        {/* Dropdown Menu (Accessible on Mobile and Desktop via Menú button) */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-800 bg-[#040915]/95 backdrop-blur-xl px-4 py-4 space-y-3 shadow-2xl animate-in fade-in duration-150">
            <div className="max-w-7xl mx-auto space-y-3">
              <a href="#inicio" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-semibold text-slate-300 hover:text-amber-400">Inicio</a>
              <a href="#transmision" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-semibold text-slate-300 hover:text-amber-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                <span>Transmisión en Vivo</span>
              </a>
              <a href="#galeria" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-semibold text-slate-300 hover:text-amber-400">Archivo Fotográfico & Videos</a>
              <a href="#editorial" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-semibold text-slate-300 hover:text-amber-400">Nuestra Identidad</a>
              <a href="#saludos" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-semibold text-slate-300 hover:text-amber-400">Muro de Saludos</a>
              
              {/* Redes Oficiales en el Menú */}
              <div className="pt-3 pb-1 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Redes Oficiales Entre Apus TV
                </span>
                <SocialMediaBar size="md" />
              </div>

              {/* Acceso Administrador ubicado dentro del Menú */}
              {isAdmin ? (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold py-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Sesión de Administrador Activa</span>
                  </div>
                  <button
                    onClick={() => { setVideoManagerOpen(true); setMobileMenuOpen(false); }}
                    className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 hover:bg-amber-400 transition"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Gestionar Videos ({playlist.length})</span>
                  </button>
                  <button
                    onClick={() => { setUploadModalOpen(true); setMobileMenuOpen(false); }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-500 transition"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Subir Video o Foto</span>
                  </button>
                  <button
                    onClick={() => { handleAdminLogout(); setMobileMenuOpen(false); }}
                    className="w-full py-2 rounded-xl bg-red-950 text-red-200 border border-red-500/40 text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-900 transition"
                  >
                    <span>Cerrar Sesión Administrador</span>
                  </button>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={() => { setAdminModalOpen(true); setMobileMenuOpen(false); }}
                    className="w-full py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-amber-500/40 text-amber-400 text-xs font-bold flex items-center justify-center gap-2 shadow transition"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Acceso Administrador</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section id="inicio" className="relative pt-6 pb-12 sm:pt-10 sm:pb-16 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Panoramic Cover */}
          <div className="relative w-full rounded-3xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-2xl mb-8 group">
            <div className="relative w-full aspect-[21/9] sm:aspect-[24/9] md:aspect-[3/1] max-h-[460px] overflow-hidden bg-gradient-to-r from-[#040915] via-slate-900 to-[#040915] flex items-center justify-center">
              <img
                src={coverImageUrl}
                alt="Portada Oficial Entre Apus TV"
                className="w-full h-full object-cover object-center transition duration-700 group-hover:scale-[1.02]"
                onError={() => {
                  setCoverImageUrl('https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80');
                }}
              />

              <div className="absolute bottom-3 left-3 z-10">
                <span className="px-3 py-1 rounded-lg bg-[#040915]/85 backdrop-blur-md text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 border border-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>Chalhuanca - Aymaraes - Apurímac</span>
                </span>
              </div>

              {isAdmin && (
                <div className="absolute top-3 right-3 z-20">
                  <button
                    onClick={() => setCoverModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-amber-500/50 text-xs font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md transition"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Cambiar portada</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Hero Content */}
          <div className="text-center max-w-4xl mx-auto space-y-5">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wider uppercase">
              <Compass className="w-4 h-4" />
              <span>Voz e Identidad de Nuestra Tierra</span>
            </div>

            <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight">
              Entre Montañas, <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-rose-500">
                Historia y Futuro
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed max-w-3xl mx-auto">
              Entre Apus TV es un medio de comunicación digital comprometido con la difusión de la información, cultura, eventos y tradiciones de Aymaraes y todo el Perú. Promovemos nuestra identidad y acercamos nuestra realidad a nuestra comunidad y al mundo.
            </p>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#transmision"
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Ver Transmisión en Vivo</span>
              </a>

              {isAdmin && (
                <>
                  <button
                    onClick={() => setVideoManagerOpen(true)}
                    className="px-6 py-3.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/50 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Gestionar Videos & Orden</span>
                  </button>

                  <button
                    onClick={handleUploadAllToCloud}
                    disabled={isCloudSyncing}
                    title="Subir y sincronizar toda la lista de videos y configuración a la base de datos en la nube"
                    className="px-4 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 text-slate-200 hover:text-blue-400 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition"
                  >
                    <CloudUpload className={`w-4 h-4 text-blue-400 ${isCloudSyncing ? 'animate-bounce' : ''}`} />
                    <span>{isCloudSyncing ? 'Subiendo...' : 'Subir a la Nube'}</span>
                  </button>
                </>
              )}

              <button
                onClick={handleSharePlaylist}
                title="Copiar enlace para compartir la página con todos los videos"
                className="px-5 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-slate-200 hover:text-amber-400 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition"
              >
                <Share2 className="w-4 h-4 text-amber-400" />
                <span>Compartir Señal</span>
              </button>

              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-lg">
                <a
                  href="https://www.facebook.com/EntreApusTV"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Facebook Entre Apus TV"
                  className="w-10 h-10 rounded-xl bg-slate-950/80 hover:bg-[#1877F2] text-slate-300 hover:text-white border border-slate-800 hover:border-[#1877F2] flex items-center justify-center transition-all duration-300 shadow hover:scale-110"
                >
                  <FacebookIcon className="w-4 h-4" />
                </a>
                <a
                  href="https://www.youtube.com/@EntreApusTV"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="YouTube Entre Apus TV"
                  className="w-10 h-10 rounded-xl bg-slate-950/80 hover:bg-[#FF0000] text-slate-300 hover:text-white border border-slate-800 hover:border-[#FF0000] flex items-center justify-center transition-all duration-300 shadow hover:scale-110"
                >
                  <YoutubeIcon className="w-4 h-4" />
                </a>
                <a
                  href="https://www.tiktok.com/@entreapus.tv"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="TikTok Entre Apus TV"
                  className="w-10 h-10 rounded-xl bg-slate-950/80 hover:bg-black text-slate-300 hover:text-[#25F4EE] border border-slate-800 hover:border-[#FE2C55] flex items-center justify-center transition-all duration-300 shadow hover:scale-110"
                >
                  <TiktokIcon className="w-4 h-4" />
                </a>
                <a
                  href="https://www.instagram.com/entreapustv?stkn=MTV3M2Q5MDNtcThuaQ=="
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Instagram Entre Apus TV"
                  className="w-10 h-10 rounded-xl bg-slate-950/80 hover:bg-gradient-to-tr hover:from-[#f09433] hover:via-[#dc2743] hover:to-[#bc1888] text-slate-300 hover:text-white border border-slate-800 hover:border-pink-500 flex items-center justify-center transition-all duration-300 shadow hover:scale-110"
                >
                  <InstagramIcon className="w-4 h-4" />
                </a>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Main Broadcast & Playlist Video Player Section */}
      <section id="transmision" className="py-12 bg-slate-900/60 border-y border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span>TRANSMISIÓN VIVO</span>
              </div>
              <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white">
                Transmisiones desde el Corazón de Apurímac
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Señal oficial en directo de los eventos, festividades y cultura de Chalhuanca y Aymaraes.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && (
                <>
                  <button
                    onClick={() => setVideoManagerOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow transition"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Administrar Lista ({playlist.length})</span>
                  </button>

                  <button
                    onClick={() => setLiveConfigModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-500/50 text-xs font-bold flex items-center gap-1.5 shadow transition"
                  >
                    <Radio className="w-4 h-4 text-rose-400" />
                    <span>Configurar En Vivo</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Interactive Player with Auto-Play & Playlist Selection */}
            <div className="lg:col-span-2">
              <VideoPlayerSection
                playlist={playlist}
                currentIndex={currentPlaylistIndex}
                onSelectVideo={handleSelectVideo}
                onOpenManager={() => setVideoManagerOpen(true)}
                isAdmin={isAdmin}
                isLiveMode={isLiveActive}
              />
            </div>

            {/* Live Chat Panel */}
            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 flex flex-col h-[400px] lg:h-[460px] shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Comentarios en Directo</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Conectado
                </span>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 text-xs">
                {chatMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`p-2.5 rounded-xl border ${
                      msg.isSelf
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <span className="font-bold text-amber-400">{msg.author}:</span>
                    <p className="text-slate-300 mt-0.5">{msg.text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendChatMessage} className="pt-3 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Escribe un saludo..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center transition"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

          </div>

        </div>
      </section>

      {/* Cultural Gallery & Audiovisual Archive */}
      <section id="galeria" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Film className="w-4 h-4" />
              <span>Archivo Fotográfico & Audiovisual</span>
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white">
              Estampas de Chalhuanca y Aymaraes
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Registro visual de festividades, paisajes y memorias de nuestra tierra.
            </p>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setUploadModalOpen(true)}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition"
              >
                <Upload className="w-4 h-4" />
                <span>Subir video o foto</span>
              </button>

              {gallery.some(i => i.type === 'video') && (
                <button
                  onClick={handleClearAllGalleryVideos}
                  className="px-3.5 py-2.5 rounded-2xl bg-slate-900 hover:bg-rose-950/70 hover:text-rose-400 text-slate-400 border border-slate-800 hover:border-rose-500/40 font-semibold text-xs transition flex items-center gap-1.5 shadow"
                  title="Eliminar todos los videos guardados en la galería"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Eliminar videos de la galería</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6">
          {['todos', 'videos', 'fotos', 'festividades', 'paisajes', 'folklore', 'comunidad'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition ${
                filterCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-extrabold'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Gallery Empty State */}
        {filteredGallery.length === 0 && (
          <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-slate-800 bg-slate-900/30">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
              <Film className="w-8 h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">No hay registros en esta sección</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-5">
              {isAdmin
                ? 'Agrega un video de YouTube o Google Drive, o sube una fotografía para registrar las festividades y memorias de Chalhuanca y Aymaraes.'
                : 'Próximamente se publicarán nuevos registros culturales de festividades y memorias de Chalhuanca y Aymaraes.'}
            </p>
            {isAdmin && (
              <button
                onClick={() => setUploadModalOpen(true)}
                className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2 shadow-lg transition"
              >
                <Upload className="w-4 h-4" />
                <span>Agregar Video o Foto Ahora</span>
              </button>
            )}
          </div>
        )}

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGallery.map(item => {
            const isVideo = item.type === 'video';
            const driveId = item.driveFileId || (item.videoUrl ? detectAndParseVideoUrl(item.videoUrl).identifier : null);
            const isDriveVideo = isVideo && (item.isGoogleDrive || item.sourceType === 'drive' || (item.videoUrl && item.videoUrl.includes('drive.google.com')));
            const youtubeId = item.sourceType === 'youtube'
              ? (item.videoUrl ? detectAndParseVideoUrl(item.videoUrl).identifier : null)
              : (item.videoUrl && (item.videoUrl.includes('youtu.be') || item.videoUrl.includes('youtube.com'))
                  ? detectAndParseVideoUrl(item.videoUrl).identifier
                  : null);
            const isYoutube = isVideo && Boolean(youtubeId);
            const isInlinePlaying = playingInlineId === item.id;
            const embedUrl = isVideo ? getEmbedUrlForMedia(item) : '';

            return (
              <div
                key={item.id}
                className="group relative rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl hover:border-amber-500/50 transition flex flex-col justify-between"
              >
                {/* Media area - ALWAYS shows the actual frame from the video itself */}
                <div className="relative w-full aspect-video bg-slate-950 overflow-hidden">
                  {isVideo && isInlinePlaying ? (
                    <div className="w-full h-full relative bg-black">
                      <iframe
                        src={embedUrl + (isYoutube ? '?autoplay=1' : '')}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        title={item.title}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlayingInlineId(null);
                        }}
                        title="Cerrar video"
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/80 hover:bg-rose-600 text-white transition z-20"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : isDriveVideo && driveId ? (
                    /* GOOGLE DRIVE: Real video player frame from the video itself */
                    <div className="w-full h-full relative bg-black">
                      <iframe
                        src={`https://drive.google.com/file/d/${driveId}/preview`}
                        className="w-full h-full border-0 pointer-events-none"
                        allow="autoplay; fullscreen"
                        title={item.title}
                        loading="lazy"
                      />
                      {/* Transparent overlay that handles clicking to open in lightbox */}
                      <div
                        onClick={() => openMediaInLightbox(item)}
                        className="absolute inset-0 z-10 cursor-pointer bg-gradient-to-t from-black/80 via-transparent to-black/20 hover:bg-black/40 transition flex items-center justify-center group/play"
                      >
                        <div className="w-12 h-12 rounded-full bg-amber-500/90 text-slate-950 flex items-center justify-center shadow-2xl group-hover/play:scale-115 transition">
                          <Play className="w-5 h-5 translate-x-0.5 fill-current" />
                        </div>
                        <div className="absolute top-3 left-3 pointer-events-none">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-blue-600 text-white flex items-center gap-1 shadow-lg backdrop-blur-md">
                            <HardDrive className="w-3 h-3" />
                            <span>Google Drive</span>
                          </span>
                        </div>
                        <div className="absolute bottom-2 inset-x-2 opacity-0 group-hover/play:opacity-100 transition text-center pointer-events-none">
                          <span className="px-2.5 py-1 rounded-md bg-black/85 text-[10px] font-bold text-amber-300 backdrop-blur-sm border border-white/10">
                            Clic para ver en pantalla grande
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : isYoutube && youtubeId ? (
                    /* YOUTUBE: Official video thumbnail frame extracted from the video itself */
                    <div
                      className="w-full h-full cursor-pointer relative"
                      onClick={() => openMediaInLightbox(item)}
                    >
                      <img
                        src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                        alt={item.title}
                        onError={(e) => {
                          if (e.currentTarget.src.includes('hqdefault.jpg')) {
                            e.currentTarget.src = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
                          } else if (e.currentTarget.src.includes('mqdefault.jpg')) {
                            e.currentTarget.src = `https://img.youtube.com/vi/${youtubeId}/0.jpg`;
                          }
                        }}
                        className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-black/30 pointer-events-none" />

                      <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10 pointer-events-none">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-red-600 text-white flex items-center gap-1 shadow-lg backdrop-blur-md">
                          <Youtube className="w-3 h-3" />
                          <span>YouTube</span>
                        </span>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-amber-500/90 text-slate-950 flex items-center justify-center shadow-2xl group-hover:scale-115 transition">
                          <Play className="w-5 h-5 translate-x-0.5 fill-current" />
                        </div>
                      </div>

                      <div className="absolute bottom-2 inset-x-2 z-10 opacity-0 group-hover:opacity-100 transition text-center pointer-events-none">
                        <span className="px-2.5 py-1 rounded-md bg-black/80 text-[10px] font-bold text-amber-300 backdrop-blur-sm border border-white/10">
                          Clic para ver en pantalla grande
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* PHOTOGRAPHY OR DIRECT MEDIA */
                    <div
                      className="w-full h-full cursor-pointer relative"
                      onClick={() => openMediaInLightbox(item)}
                    >
                      {item.type === 'video' && item.videoUrl ? (
                        <video
                          src={item.videoUrl}
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={item.photoUrl || ''}
                          alt={item.title}
                          className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      )}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10 pointer-events-none">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 text-slate-950 flex items-center gap-1 shadow-lg">
                          <Camera className="w-3 h-3" />
                          <span>Foto</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Info and Action Buttons */}
                <div className="p-5 flex flex-col justify-between flex-1 gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">{item.category}</span>
                      <span className="text-[10px] text-slate-400 truncate max-w-[130px]">{item.author}</span>
                    </div>
                    <h4
                      onClick={() => openMediaInLightbox(item)}
                      className="font-bold text-sm text-white hover:text-amber-400 transition cursor-pointer line-clamp-1"
                    >
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description || 'Registro de Entre Apus TV'}</p>
                  </div>

                  {/* Video Action Controls Bar */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1.5 flex-wrap">
                    {isVideo ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlayingInlineId(isInlinePlaying ? null : item.id);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                            isInlinePlaying
                              ? 'bg-rose-500 text-white'
                              : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/40'
                          }`}
                          title="Reproducir directamente aquí dentro de la tarjeta"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{isInlinePlaying ? 'Pausar' : 'Ver aquí'}</span>
                        </button>

                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              transmitGalleryItemToPlayer(item);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 border border-slate-700 transition"
                            title="Transmitir este video en el reproductor principal superior"
                          >
                            <Radio className="w-3 h-3 text-amber-400" />
                            <span className="hidden sm:inline">Transmitir</span> arriba
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => openMediaInLightbox(item)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 border border-slate-700 transition"
                      >
                        <Eye className="w-3 h-3 text-amber-400" />
                        <span>Ver foto</span>
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        onClick={(e) => deleteGalleryItem(item.id, e)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition ml-auto"
                        title="Eliminar de la galería"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </section>

      {/* Editorial Pillars Section */}
      <section id="editorial" className="py-14 bg-slate-900/40 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">Compromiso Cultural</span>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white mt-1">
              Nuestra Línea Editorial
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Los 4 pilares fundamentales que guían cada reporte, transmisión y homenaje de Entre Apus TV.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition group">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition">
                <Heart className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">Festividades & Tradición</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Devoción al Señor de Ánimas, procesiones solemnes, corridas tradicionales y celebraciones patronales que unen a los pueblos de Aymaraes.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition">
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">Folklore & Danzas</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Difusión de las huaylias, carnavales aymarinos, trajes autóctonos y concursos escolares que mantienen viva nuestra herencia ancestral.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 transition group">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition">
                <FileCode className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">Noticias Comunitarias</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Acontecimientos cotidianos de Chalhuanca, reportes del estado de vías, clima, homenajes y espacio para la voz del vecino aymarino.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-rose-500/40 transition group">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">Apus & Geografía</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Revaloración de las montañas sagradas tutelares, el cañón del río Chalhuanca y la riqueza turística y natural de Apurímac.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* Community Greetings Wall */}
      <section id="saludos" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-xl">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-white">Muro de Saludos a la Tierra</h3>
                <p className="text-xs text-slate-400">Dedicatorias para transmitir al aire</p>
              </div>
            </div>

            <form onSubmit={handleSendGreeting} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tu Nombre o Familia</label>
                <input
                  type="text"
                  value={greetingName}
                  onChange={e => setGreetingName(e.target.value)}
                  placeholder="Ej: Familia Huarcaya"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Ciudad o País donde te encuentras</label>
                <input
                  type="text"
                  value={greetingLocation}
                  onChange={e => setGreetingLocation(e.target.value)}
                  placeholder="Ej: Lima, Arequipa, Virginia EE.UU."
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tu Mensaje para los Paisanos</label>
                <textarea
                  value={greetingMessage}
                  onChange={e => setGreetingMessage(e.target.value)}
                  rows={3}
                  placeholder="Envía un abrazo a tu barrio, tu comunidad o tu devoción al Señor de Ánimas..."
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Send className="w-4 h-4" />
                <span>Publicar Saludo</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" />
                <span>La Diáspora Aymarina Conectada</span>
              </h3>
              <span className="text-xs text-slate-400">Mensajes de todo el mundo</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {greetings.map(g => (
                <div key={g.id} className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-amber-400">{g.name}</span>
                    <span className="text-slate-500 text-[10px]">{g.location}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">"{g.message}"</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* WhatsApp Action Section */}
      <section className="py-12 bg-gradient-to-r from-emerald-950 via-[#040915] to-slate-950 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            ¿Deseas una cobertura especial en tu localidad?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
            Coordinamos transmisiones para festividades patronales, eventos culturales, institucionales o noticias de interés comunitario en Aymaraes y todo el Perú.
          </p>
          <div className="pt-2">
            <a
              href="https://wa.me/51912900359?text=Hola%20Entre%20Apus%20TV,%20deseo%20coordinar%20una%20cobertura"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition"
            >
              <span>Escribir por WhatsApp (+51 912 900 359)</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#040915] border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                EATV
              </div>
              <div>
                <h4 className="font-display font-bold text-white text-base">ENTRE APUS TV</h4>
                <p className="text-[11px] text-slate-400">Chalhuanca • Aymaraes • Apurímac • Perú</p>
              </div>
            </div>

            {/* Redes Sociales Oficiales con Iconos Reales */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <span className="text-xs text-slate-400 font-semibold">Síguenos en Redes Sociales:</span>
              <SocialMediaBar size="md" showLabels />
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© 2026 Entre Apus TV. Todos los derechos reservados.</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setAnalysisModalOpen(true)} className="hover:text-amber-400 transition flex items-center gap-1">
                <FileCode className="w-3.5 h-3.5" />
                <span>Auditoría Web</span>
              </button>
              <button
                onClick={() => isAdmin ? handleAdminLogout() : setAdminModalOpen(true)}
                className="hover:text-amber-400 transition flex items-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isAdmin ? 'Cerrar Sesión Admin' : 'Acceso Administrador'}</span>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* MODAL 1: VIDEO MANAGER (Playlist, Ordering, Bulk, YouTube & Drive detection) */}
      <VideoManagerModal
        isOpen={isAdmin && videoManagerOpen}
        onClose={() => setVideoManagerOpen(false)}
        playlist={playlist}
        currentIndex={currentPlaylistIndex}
        onSelectVideo={handleSelectVideo}
        onUpdatePlaylist={handleUpdatePlaylist}
        showToast={showToast}
      />

      {/* MODAL 2: Administrator Login Modal */}
      {adminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="relative max-w-sm w-full bg-slate-900 rounded-3xl p-6 border border-slate-700 shadow-2xl my-auto max-h-[95vh] overflow-y-auto">
            <button
              onClick={() => setAdminModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center text-2xl mb-3 shadow-lg">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Ingresa como administrador</h3>
              <p className="text-xs text-slate-400 mt-1">Gestión de videos de YouTube/Drive y transmisiones</p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Usuario</label>
                <input
                  type="text"
                  value={adminUser}
                  onChange={e => setAdminUser(e.target.value)}
                  placeholder=""
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPass}
                    onChange={e => setAdminPass(e.target.value)}
                    placeholder=""
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg transition"
              >
                Iniciar Sesión
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Live Config */}
      {isAdmin && liveConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="relative max-w-lg w-full bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-700 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 flex-shrink-0 bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center text-xl flex-shrink-0">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight">Configurar Señal en Vivo</h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">Pega un enlace de YouTube Live o Google Drive</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLiveConfigModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition flex-shrink-0"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLiveConfigSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Enlace de la Transmisión (URL de Google Drive o YouTube)</label>
                  <input
                    type="text"
                    value={liveUrlInput}
                    onChange={e => {
                      const val = e.target.value;
                      const cleaned = cleanRawVideoUrl(val);
                      if (val.includes('<iframe') && cleaned) {
                        setLiveUrlInput(cleaned);
                      } else {
                        setLiveUrlInput(val);
                      }
                    }}
                    placeholder="https://drive.google.com/file/d/.../view o https://www.youtube.com/watch?v=..."
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />

                  {liveUrlInput.trim() && (() => {
                    const detected = detectAndParseVideoUrl(cleanRawVideoUrl(liveUrlInput));
                    if (detected.isValid && detected.sourceType === 'drive') {
                      return (
                        <p className="text-[11px] text-blue-300 mt-1.5 flex items-center gap-1.5 bg-blue-950/40 p-2 rounded-lg border border-blue-500/30">
                          <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span>Google Drive: Asegúrate de que el enlace tenga permiso <strong>"Cualquier persona con el enlace"</strong> para que todos los visitantes puedan verlo.</span>
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Título de la Transmisión al Aire</label>
                  <input
                    type="text"
                    value={liveTitleInput}
                    onChange={e => setLiveTitleInput(e.target.value)}
                    placeholder="Ej: Procesión Solemne del Señor de Ánimas 2026"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Botones Fijos al Pie */}
              <div className="p-3 sm:p-4 bg-slate-950/95 border-t border-slate-800 flex-shrink-0 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={stopLiveAndRestoreArchive}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition order-2 sm:order-1"
                >
                  <Film className="w-4 h-4" />
                  <span>Restaurar Playlist</span>
                </button>

                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition order-1 sm:order-2"
                >
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>Transmitir Señal En Vivo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Gallery Upload Modal */}
      {isAdmin && uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="relative max-w-lg w-full bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-700 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto overflow-hidden">
            {/* Header Fijo */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 flex-shrink-0 bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl flex-shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight">Subir a la Galería Audiovisual</h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">Publica videos y fotografías con detección automática</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition flex-shrink-0"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGalleryUploadSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
              {/* Contenido scrolleable adaptable al navegador */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
                {/* Type selector */}
                <div className="flex border-b border-slate-800 pb-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadTab('video')}
                    className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                      uploadTab === 'video'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'text-slate-400 hover:text-white bg-slate-950/60'
                    }`}
                  >
                    <Youtube className="w-4 h-4" />
                    <span>Video (YouTube / Drive)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadTab('photo')}
                    className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                      uploadTab === 'photo'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'text-slate-400 hover:text-white bg-slate-950/60'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>Fotografía</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Enlace del archivo (Google Drive o YouTube)
                  </label>
                  <input
                    type="text"
                    value={uploadUrl}
                    onChange={e => {
                      const val = e.target.value;
                      const cleaned = cleanRawVideoUrl(val);
                      if (val.includes('<iframe') && cleaned) {
                        setUploadUrl(cleaned);
                      } else {
                        setUploadUrl(val);
                      }
                    }}
                    placeholder={uploadTab === 'video' ? 'https://drive.google.com/file/d/.../view o https://www.youtube.com/...' : 'https://drive.google.com/... o URL directa'}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />

                  {/* Live Detection Feedback */}
                  {uploadTab === 'video' && uploadUrl.trim() && (
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      {(() => {
                        const detected = detectAndParseVideoUrl(cleanRawVideoUrl(uploadUrl.trim()));
                        if (detected.isValid) {
                          return (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 text-emerald-400">
                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                <div>
                                  <p className="font-bold">
                                    {detected.sourceType === 'youtube' ? 'Video de YouTube detectado' : 'Video de Google Drive detectado'}
                                  </p>
                                  <p className="text-[10px] text-slate-400">ID / Archivo: {detected.identifier}</p>
                                </div>
                              </div>
                              {detected.sourceType === 'drive' && (
                                <p className="text-[10px] text-blue-300">
                                  💡 Recuerda que el enlace en Google Drive debe tener permisos: <strong>"Cualquier persona con el enlace puede ver"</strong>.
                                </p>
                              )}
                            </div>
                          );
                        }
                        return (
                          <div className="flex items-center gap-2 text-amber-400">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <p className="text-[11px]">{detected.error || 'Enlace no reconocido. Pega una URL de YouTube o Google Drive.'}</p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Título de la Estampa</label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={e => setUploadTitle(e.target.value)}
                    placeholder="Ej: Danza de las Huaylias 2026"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría</label>
                    <select
                      value={uploadCategory}
                      onChange={e => setUploadCategory(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
                    >
                      <option value="festividades">Festividades</option>
                      <option value="paisajes">Paisajes & Apus</option>
                      <option value="folklore">Folklore & Danzas</option>
                      <option value="comunidad">Comunidad</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Autor / Cobertura</label>
                    <input
                      type="text"
                      value={uploadAuthor}
                      onChange={e => setUploadAuthor(e.target.value)}
                      placeholder="Ej: Entre Apus TV"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción Breve</label>
                  <textarea
                    value={uploadDescription}
                    onChange={e => setUploadDescription(e.target.value)}
                    rows={2}
                    placeholder="Reseña histórica o detalles del evento..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                {uploadTab === 'video' && uploadUrl.trim() && (
                  <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5" />
                        <span>Fotograma del Mismo Video</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>Capturado del propio video</span>
                      </span>
                    </div>

                    {(() => {
                      const parsed = detectAndParseVideoUrl(uploadUrl.trim());
                      if (parsed.isValid) {
                        if (parsed.sourceType === 'youtube') {
                          return (
                            <div className="relative aspect-video max-h-[140px] sm:max-h-[180px] rounded-xl overflow-hidden bg-black border border-slate-700 mx-auto">
                              <img
                                src={`https://img.youtube.com/vi/${parsed.identifier}/hqdefault.jpg`}
                                alt="Miniatura de YouTube"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold shadow">
                                YouTube
                              </div>
                            </div>
                          );
                        } else if (parsed.sourceType === 'drive') {
                          return (
                            <div className="relative aspect-video max-h-[140px] sm:max-h-[180px] rounded-xl overflow-hidden bg-black border border-slate-700 mx-auto">
                              <iframe
                                src={`https://drive.google.com/file/d/${parsed.identifier}/preview`}
                                className="w-full h-full border-0 pointer-events-none"
                                title="Vista previa Google Drive"
                              />
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold shadow">
                                Google Drive
                              </div>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}

                    <p className="text-[11px] text-slate-400">
                      La imagen se genera automáticamente del mismo video que estás subiendo, sin fotos externas ni genéricas.
                    </p>
                  </div>
                )}

                {uploadTab === 'video' && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <input
                      type="checkbox"
                      checked={alsoAddToPlaylist}
                      onChange={e => setAlsoAddToPlaylist(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span>También agregar a la lista de reproducción continua del reproductor</span>
                  </label>
                )}
              </div>

              {/* Botón Pinned / Fijo al Pie: SIEMPRE VISIBLE en celular y navegador sin necesidad de zoom */}
              <div className="p-3 sm:p-4 bg-slate-950/95 border-t border-slate-800 flex-shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Publicar en la Galería</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Lightbox */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/90 backdrop-blur-md"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-950 rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-slate-800 shadow-2xl flex flex-col items-center max-h-[95vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-800/80 mb-2.5 sm:mb-3">
              <div className="flex items-center gap-2">
                {lightboxItem.type === 'video' ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold">
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Reproductor Audiovisual</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Fotografía Cultural</span>
                  </span>
                )}
                <span className="text-xs font-semibold text-slate-400 capitalize">{lightboxItem.category}</span>
              </div>
              <button
                onClick={() => setLightboxItem(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition"
                title="Cerrar reproductor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de formato y adaptación de pantalla para videos de Google Drive y YouTube */}
            {lightboxItem.type === 'video' && (
              <div className="w-full mb-3 flex items-center justify-between gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-400">
                  Ajustar pantalla:
                </span>
                <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-[11px] font-semibold overflow-x-auto max-w-full">
                  <button
                    type="button"
                    onClick={() => setLightboxAspect('fit')}
                    className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                      lightboxAspect === 'fit'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    title="Adaptable completo: ajusta el alto para mostrar todo el video sin recortes"
                  >
                    Adaptable (Completo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxAspect('vertical')}
                    className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                      lightboxAspect === 'vertical'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    title="Formato vertical para videos grabados con celular o procesiones"
                  >
                    📱 Celular (Vertical)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxAspect('cinema')}
                    className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                      lightboxAspect === 'cinema'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    title="Formato panorámico horizontal 16:9 tradicional"
                  >
                    🖥️ Panorámico
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxAspect(lightboxAspect === 'full' ? 'fit' : 'full')}
                    className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                      lightboxAspect === 'full'
                        ? 'bg-rose-500 text-white font-bold shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    title="Maximizar en pantalla grande"
                  >
                    ⤢ Pantalla Grande
                  </button>
                </div>
              </div>
            )}

            {/* Contenedor de reproducción adaptado dinámicamente al video (Google Drive y YouTube) */}
            <div
              className={`flex items-center justify-center overflow-hidden rounded-xl sm:rounded-2xl bg-black relative border border-slate-800 shadow-2xl transition-all duration-300 ${
                lightboxAspect === 'vertical'
                  ? 'w-full max-w-[340px] aspect-[9/16] max-h-[75vh] mx-auto'
                  : lightboxAspect === 'cinema'
                  ? 'w-full aspect-video max-h-[65vh]'
                  : lightboxAspect === 'full'
                  ? 'w-full h-[76vh] max-h-[820px]'
                  : 'w-full h-[52vh] sm:h-[64vh] min-h-[300px] sm:min-h-[440px] max-h-[640px]'
              }`}
            >
              {lightboxItem.type === 'video' ? (
                <div className="w-full h-full relative flex items-center justify-center bg-black">
                  <iframe
                    src={getEmbedUrlForMedia(lightboxItem)}
                    className="w-full h-full border-0 rounded-xl sm:rounded-2xl"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    title={lightboxItem.title}
                  />

                  {/* Escudo protector oficial: Cubre discretamente el icono emergente de Google Drive para evitar que el público abra el enlace de origen */}
                  <div
                    className="absolute top-0 right-0 w-16 h-10 z-20 pointer-events-auto bg-[#040915] flex items-center justify-center rounded-bl-xl border-b border-l border-amber-500/30 shadow-lg select-none"
                    onClick={(e) => { e.stopPropagation(); }}
                    title="Entre Apus TV"
                  >
                    <span className="text-[10px] font-extrabold text-amber-400 tracking-wider">
                      EATV
                    </span>
                  </div>
                </div>
              ) : (
                <img
                  src={lightboxItem.photoUrl || ''}
                  alt={lightboxItem.title}
                  className="max-h-full max-w-full object-contain"
                />
              )}
            </div>

            <div className="w-full mt-3 sm:mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white text-base sm:text-lg leading-snug line-clamp-2">
                  {lightboxItem.title}
                </h4>
                <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">
                  {lightboxItem.author ? `${lightboxItem.author} • ` : ''}{lightboxItem.description || 'Archivo cultural oficial de Chalhuanca y Aymaraes'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-shrink-0">
                {isAdmin && lightboxItem.type === 'video' && (
                  <button
                    onClick={() => {
                      transmitGalleryItemToPlayer(lightboxItem);
                      setLightboxItem(null);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow transition"
                  >
                    <Radio className="w-4 h-4" />
                    <span>Transmitir en Señal Principal</span>
                  </button>
                )}

                <button
                  onClick={() => setLightboxItem(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cerrar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Cover Image */}
      {isAdmin && coverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative max-w-lg w-full bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-700 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 flex-shrink-0 bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl flex-shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight">Cambiar Portada</h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">Pega un enlace de Google Drive con la foto de portada</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCoverModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition flex-shrink-0"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCoverSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Enlace de Google Drive Compartido</label>
                  <input
                    type="text"
                    value={coverDriveUrl}
                    onChange={e => {
                      const val = e.target.value;
                      const cleaned = cleanRawVideoUrl(val);
                      if (val.includes('<iframe') && cleaned) {
                        setCoverDriveUrl(cleaned);
                      } else {
                        setCoverDriveUrl(val);
                      }
                    }}
                    placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  {coverDriveUrl.trim() && (() => {
                    const detected = detectAndParseVideoUrl(cleanRawVideoUrl(coverDriveUrl));
                    if (detected.isValid && detected.sourceType === 'drive') {
                      return (
                        <p className="text-[11px] text-blue-300 mt-1.5 flex items-center gap-1.5 bg-blue-950/40 p-2 rounded-lg border border-blue-500/30">
                          <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span>Google Drive: Asegúrate de que el archivo esté compartido con <strong>"Cualquier persona con el enlace"</strong>.</span>
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Botón Pinned al Pie */}
              <div className="p-3 sm:p-4 bg-slate-950/95 border-t border-slate-800 flex-shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCoverModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Actualizar Portada</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: DIAGNÓSTICO & ANÁLISIS TÉCNICO EXHAUSTIVO */}
      {analysisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="relative max-w-3xl w-full bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-700 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setAnalysisModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-2xl shadow-lg">
                <FileCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Análisis & Diagnóstico de la Web: Entre Apus TV</h3>
                <p className="text-xs text-slate-400">Auditoría de arquitectura, ventajas, riesgos y recomendaciones</p>
              </div>
            </div>

            <div className="space-y-6 text-xs text-slate-300 leading-relaxed">
              
              {/* Sección 1 */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                <h4 className="text-sm font-bold text-amber-400 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>1. Nuevo Motor de Detección Automática de Videos (YouTube + Drive)</span>
                </h4>
                <p>
                  El sistema cuenta ahora con un parser inteligente que:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
                  <li><strong>Detección automática:</strong> Identifica al instante si una URL es de YouTube (estándar, <code>youtu.be</code>, shorts o live) o de Google Drive (cualquier formato de enlace compartido).</li>
                  <li><strong>Construcción de Embed y Autoplay:</strong> Genera la URL con parámetros de reproducción automática (<code>autoplay=1&enablejsapi=1</code>) y miniatura de alta resolución.</li>
                  <li><strong>Reproducción Continua (Playlist):</strong> Cuando un video termina, avanza automáticamente al siguiente de la lista programada.</li>
                  <li><strong>Panel de Gestión:</strong> Permite agregar varios videos a la vez (en lote), cambiar el orden con botones de subida/bajada, editar o reemplazar enlaces, y eliminar cualquier elemento.</li>
                </ul>
              </div>

              {/* Sección 2 */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                <h4 className="text-sm font-bold text-amber-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>2. Puntos Críticos y Vulnerabilidades Detectadas</span>
                </h4>
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30">
                    <p className="font-bold text-red-300">Seguridad: Contraseña en texto plano en el Front-End</p>
                    <p className="text-slate-400 mt-1">
                      Credenciales de acceso administrativo: <code>entreapus</code> / clave configurada. Se recomienda validar sesiones mediante cookies httpOnly o Firebase Auth para proyectos de producción comercial.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30">
                    <p className="font-bold text-amber-300">Límites de Google Drive vs YouTube</p>
                    <p className="text-slate-400 mt-1">
                      Google Drive bloquea streams con alto tráfico por cuotas de visualización. Para transmisiones en vivo o videos virales, YouTube es notablemente superior y no presenta problemas de ancho de banda.
                    </p>
                  </div>
                </div>
              </div>

            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setAnalysisModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
              >
                Cerrar diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white shadow-2xl text-xs animate-bounce">
          <Info className={`w-5 h-5 ${toast.type === 'success' ? 'text-emerald-400' : toast.type === 'error' ? 'text-rose-400' : 'text-amber-400'}`} />
          <div>
            <p className="font-bold text-slate-100">{toast.title}</p>
            <p className="text-slate-400 text-[11px]">{toast.message}</p>
          </div>
        </div>
      )}

    </div>
  );
}
