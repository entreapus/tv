export interface PlaylistItem {
  id: string;
  title: string;
  category: 'festividades' | 'paisajes' | 'folklore' | 'comunidad';
  author: string;
  description: string;
  sourceType: 'youtube' | 'drive' | 'direct';
  originalUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
  duration?: string;
  fileId?: string;
  videoId?: string;
  order?: number;
}

export interface MediaItem {
  id: string;
  title: string;
  category: 'festividades' | 'paisajes' | 'folklore' | 'comunidad';
  author: string;
  description: string;
  type: 'video' | 'photo';
  sourceType?: 'youtube' | 'drive' | 'direct';
  videoUrl?: string | null;
  photoUrl?: string | null;
  driveEmbedUrl?: string | null;
  driveFileId?: string | null;
  isGoogleDrive?: boolean;
  createdAt?: string;
}

export interface VideoDetectionResult {
  isValid: boolean;
  sourceType: 'youtube' | 'drive' | 'direct';
  embedUrl: string;
  thumbnailUrl: string;
  identifier: string; // Video ID or Drive File ID
  error?: string;
}

/**
 * Cleans user-pasted input, extracting URLs from iframe snippets, quotes, or markdown.
 */
export function cleanRawVideoUrl(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.trim();

  // If pasted as an iframe: <iframe ... src="URL" ...>
  const iframeMatch = cleaned.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    cleaned = iframeMatch[1].trim();
  }

  // If markdown link [text](url)
  const mdMatch = cleaned.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)/i);
  if (mdMatch && mdMatch[1]) {
    cleaned = mdMatch[1].trim();
  }

  // Remove surrounding quotes or angle brackets
  cleaned = cleaned.replace(/^["'<]|["'>]$/g, '').trim();

  return cleaned;
}

/**
 * Detects whether a URL belongs to YouTube, Google Drive, or a direct video URL.
 * Automatically extracts the relevant IDs and constructs responsive embed and thumbnail URLs.
 */
export function detectAndParseVideoUrl(rawUrl: string): VideoDetectionResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      isValid: false,
      sourceType: 'direct',
      embedUrl: '',
      thumbnailUrl: '',
      identifier: '',
      error: 'La URL está vacía'
    };
  }

  const url = cleanRawVideoUrl(rawUrl);

  // 1. YouTube Detection
  // Matches: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/live/ID, youtube.com/shorts/ID
  const ytMatch = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/|shorts\/))([\w-]{11})/i
  );

  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return {
      isValid: true,
      sourceType: 'youtube',
      // enablejsapi=1, origin, autoplay=1, mute=0/1 to support automatic playback and postMessage events
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1&playsinline=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      identifier: videoId
    };
  }

  // 2. Google Drive Detection
  // Check if it's a folder link
  if (url.includes('/drive/folders/')) {
    return {
      isValid: false,
      sourceType: 'drive',
      embedUrl: '',
      thumbnailUrl: '',
      identifier: '',
      error: 'Has pegado el enlace a una carpeta de Google Drive. Por favor, abre el archivo de video específico, haz clic en "Compartir" y pega el enlace del video.'
    };
  }

  // Matches: drive.google.com/file/d/FILE_ID/view..., drive.google.com/file/u/0/d/FILE_ID, drive.google.com/open?id=FILE_ID, docs.google.com, etc.
  const driveMatch = url.match(/\/file(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/i) || 
                     url.match(/[?&]id=([a-zA-Z0-9_-]+)/i) ||
                     url.match(/\/d\/([a-zA-Z0-9_-]+)/i);

  // Or if user pasted directly a Google Drive File ID (25-45 alphanumeric, underscores, hyphens)
  const isDirectDriveId = /^[a-zA-Z0-9_-]{25,45}$/.test(url);

  const fileId = driveMatch ? driveMatch[1] : (isDirectDriveId ? url : null);

  if (fileId) {
    return {
      isValid: true,
      sourceType: 'drive',
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
      identifier: fileId
    };
  }

  // 3. Direct HTML5 Video (.mp4, .webm, .m3u8, etc.)
  if (url.match(/\.(mp4|webm|ogg|m3u8)($|\?)/i) || url.startsWith('blob:') || url.startsWith('data:video/')) {
    return {
      isValid: true,
      sourceType: 'direct',
      embedUrl: url,
      thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      identifier: url
    };
  }

  return {
    isValid: false,
    sourceType: 'direct',
    embedUrl: '',
    thumbnailUrl: '',
    identifier: '',
    error: 'No se reconoció como enlace de YouTube o Google Drive válido.'
  };
}

export const INITIAL_PLAYLIST: PlaylistItem[] = [
  {
    id: 'pl_chalhuanca_1',
    title: 'Chalhuanca, Capital de Aymaraes - Costumbres y Tradiciones',
    category: 'paisajes',
    author: 'Entre Apus TV',
    description: 'Documental sobre la historia, paisajes andinos y tradiciones vivas de Chalhuanca, Apurímac.',
    sourceType: 'youtube',
    originalUrl: 'https://www.youtube.com/watch?v=0e3GPea1Tyg',
    embedUrl: 'https://www.youtube.com/embed/0e3GPea1Tyg?autoplay=1&enablejsapi=1&rel=0',
    thumbnailUrl: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=800&q=80',
    videoId: '0e3GPea1Tyg'
  },
  {
    id: 'pl_chalhuanca_2',
    title: 'Fiesta Patronal Señor de Ánimas de Chalhuanca',
    category: 'festividades',
    author: 'Entre Apus TV',
    description: 'Celebración declarada Patrimonio Cultural de la Nación, corrida de toros y procesión.',
    sourceType: 'youtube',
    originalUrl: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
    embedUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4?autoplay=1&enablejsapi=1&rel=0',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    videoId: 'ScMzIvxBSi4'
  },
  {
    id: 'pl_chalhuanca_3',
    title: 'Huaynos y Danzas Costumbristas de Apurímac',
    category: 'folklore',
    author: 'Producciones Entre Apus',
    description: 'Música autóctona, arpa y violín en las alturas de Aymaraes y comunidades andinas.',
    sourceType: 'youtube',
    originalUrl: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
    embedUrl: 'https://www.youtube.com/embed/kJQP7kiw5Fk?autoplay=1&enablejsapi=1&rel=0',
    thumbnailUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
    videoId: 'kJQP7kiw5Fk'
  }
];

// Helper to encode playlist for shareable link
export function encodePlaylistForUrl(items: PlaylistItem[]): string {
  try {
    const compact = items.map(i => ({
      t: i.title,
      c: i.category,
      a: i.author,
      d: i.description,
      s: i.sourceType,
      u: i.originalUrl,
      e: i.embedUrl,
      m: i.thumbnailUrl,
      v: i.videoId,
      f: i.fileId
    }));
    return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(compact)))));
  } catch (e) {
    return '';
  }
}

// Helper to decode playlist from shareable link
export function decodePlaylistFromUrl(encoded: string): PlaylistItem[] | null {
  try {
    const jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(encoded))));
    const compact = JSON.parse(jsonStr);
    if (!Array.isArray(compact) || compact.length === 0) return null;
    return compact.map((c: any, index: number) => ({
      id: 'pl_shared_' + index + '_' + Date.now(),
      title: c.t || 'Video Entre Apus TV',
      category: c.c || 'festividades',
      author: c.a || 'Entre Apus TV',
      description: c.d || '',
      sourceType: c.s || 'youtube',
      originalUrl: c.u || '',
      embedUrl: c.e || '',
      thumbnailUrl: c.m || 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=800&q=80',
      videoId: c.v,
      fileId: c.f
    }));
  } catch (e) {
    return null;
  }
}

