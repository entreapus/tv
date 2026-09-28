import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Play,
  Radio,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
  Youtube,
  HardDrive,
  Film,
  Check,
  X,
  ListPlus,
  Share2
} from 'lucide-react';
import { PlaylistItem, detectAndParseVideoUrl, encodePlaylistForUrl, cleanRawVideoUrl } from './videoService';

interface VideoManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: PlaylistItem[];
  currentIndex: number;
  onSelectVideo: (index: number) => void;
  onUpdatePlaylist: (newPlaylist: PlaylistItem[]) => void;
  showToast: (title: string, message: string, type: 'success' | 'info' | 'error') => void;
}

export const VideoManagerModal: React.FC<VideoManagerModalProps> = ({
  isOpen,
  onClose,
  playlist,
  currentIndex,
  onSelectVideo,
  onUpdatePlaylist,
  showToast
}) => {
  // Tabs: 'list' | 'add' | 'bulk'
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'bulk'>('list');

  // Form State for Add / Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoTitleInput, setVideoTitleInput] = useState('');
  const [videoCategoryInput, setVideoCategoryInput] = useState<'festividades' | 'paisajes' | 'folklore' | 'comunidad'>('festividades');
  const [videoAuthorInput, setVideoAuthorInput] = useState('Entre Apus TV');
  const [videoDescInput, setVideoDescInput] = useState('');

  // Bulk Add State
  const [bulkText, setBulkText] = useState('');

  // Live Auto-Detection Preview
  const [detectionState, setDetectionState] = useState<{
    tested: boolean;
    isValid: boolean;
    sourceType?: 'youtube' | 'drive' | 'direct';
    identifier?: string;
    embedUrl?: string;
    thumbnailUrl?: string;
    error?: string;
  }>({ tested: false, isValid: false });

  // Reset or initialize on form open
  useEffect(() => {
    if (!videoUrlInput.trim()) {
      setDetectionState({ tested: false, isValid: false });
      return;
    }

    const res = detectAndParseVideoUrl(videoUrlInput);
    if (res.isValid) {
      setDetectionState({
        tested: true,
        isValid: true,
        sourceType: res.sourceType,
        identifier: res.identifier,
        embedUrl: res.embedUrl,
        thumbnailUrl: res.thumbnailUrl
      });
      // Auto-fill title if empty
      if (!videoTitleInput) {
        if (res.sourceType === 'youtube') {
          setVideoTitleInput(`Video de YouTube (${res.identifier})`);
        } else if (res.sourceType === 'drive') {
          setVideoTitleInput(`Video de Google Drive (${res.identifier.slice(0, 8)}...)`);
        }
      }
    } else {
      setDetectionState({
        tested: true,
        isValid: false,
        error: res.error
      });
    }
  }, [videoUrlInput]);

  if (!isOpen) return null;

  const startEdit = (item: PlaylistItem) => {
    setEditingId(item.id);
    setVideoUrlInput(item.originalUrl);
    setVideoTitleInput(item.title);
    setVideoCategoryInput(item.category);
    setVideoAuthorInput(item.author);
    setVideoDescInput(item.description);
    setActiveTab('add');
  };

  const handleSaveVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrlInput.trim() || !videoTitleInput.trim()) {
      showToast('Campos requeridos', 'Por favor ingresa la URL y el título del video.', 'error');
      return;
    }

    const detected = detectAndParseVideoUrl(videoUrlInput);
    if (!detected.isValid) {
      showToast('Enlace no válido', 'El enlace no corresponde a un video válido de YouTube o Google Drive.', 'error');
      return;
    }

    if (editingId) {
      // Update existing
      const updated = playlist.map(item => {
        if (item.id === editingId) {
          return {
            ...item,
            title: videoTitleInput.trim(),
            category: videoCategoryInput,
            author: videoAuthorInput.trim() || 'Entre Apus TV',
            description: videoDescInput.trim(),
            originalUrl: videoUrlInput.trim(),
            embedUrl: detected.embedUrl,
            sourceType: detected.sourceType,
            thumbnailUrl: detected.thumbnailUrl || item.thumbnailUrl,
            fileId: detected.sourceType === 'drive' ? detected.identifier : undefined,
            videoId: detected.sourceType === 'youtube' ? detected.identifier : undefined
          };
        }
        return item;
      });

      onUpdatePlaylist(updated);
      showToast('Video Actualizado', `"${videoTitleInput}" se ha modificado exitosamente.`, 'success');
      resetForm();
      setActiveTab('list');
    } else {
      // Add new
      const newItem: PlaylistItem = {
        id: 'vid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        title: videoTitleInput.trim(),
        category: videoCategoryInput,
        author: videoAuthorInput.trim() || 'Entre Apus TV',
        description: videoDescInput.trim() || 'Video de archivo de Entre Apus TV',
        originalUrl: videoUrlInput.trim(),
        embedUrl: detected.embedUrl,
        sourceType: detected.sourceType,
        thumbnailUrl: detected.thumbnailUrl || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
        fileId: detected.sourceType === 'drive' ? detected.identifier : undefined,
        videoId: detected.sourceType === 'youtube' ? detected.identifier : undefined
      };

      const updated = [...playlist, newItem];
      onUpdatePlaylist(updated);
      showToast('Video Agregado', `"${videoTitleInput}" se agregó a la lista de reproducción.`, 'success');
      resetForm();
      setActiveTab('list');
    }
  };

  const handleBulkAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) return;

    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    const addedItems: PlaylistItem[] = [];
    let failedCount = 0;

    lines.forEach((line, idx) => {
      // Support line formats:
      // 1) URL
      // 2) URL | Title
      // 3) Title | URL
      let url = line;
      let title = '';

      if (line.includes('|')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts[0].startsWith('http')) {
          url = parts[0];
          title = parts[1] || '';
        } else {
          title = parts[0];
          url = parts[1] || '';
        }
      }

      const cleanUrl = cleanRawVideoUrl(url);
      const detected = detectAndParseVideoUrl(cleanUrl);
      if (detected.isValid) {
        addedItems.push({
          id: 'vid_bulk_' + Date.now() + '_' + idx,
          title: title || (detected.sourceType === 'youtube' ? `YouTube (${detected.identifier})` : `Google Drive (${detected.identifier.substring(0, 8)})`),
          category: 'festividades',
          author: 'Entre Apus TV',
          description: 'Agregado en lote a la lista de reproducción.',
          originalUrl: url,
          embedUrl: detected.embedUrl,
          sourceType: detected.sourceType,
          thumbnailUrl: detected.thumbnailUrl || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
          fileId: detected.sourceType === 'drive' ? detected.identifier : undefined,
          videoId: detected.sourceType === 'youtube' ? detected.identifier : undefined
        });
      } else {
        failedCount++;
      }
    });

    if (addedItems.length > 0) {
      const updated = [...playlist, ...addedItems];
      onUpdatePlaylist(updated);
      showToast(
        'Videos Agregados en Lote',
        `Se agregaron ${addedItems.length} videos correctamente.${failedCount > 0 ? ` (${failedCount} ignorados por no ser válidos)` : ''}`,
        'success'
      );
      setBulkText('');
      setActiveTab('list');
    } else {
      showToast('Error', 'No se encontró ningún enlace válido de YouTube o Google Drive.', 'error');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setVideoUrlInput('');
    setVideoTitleInput('');
    setVideoAuthorInput('Entre Apus TV');
    setVideoDescInput('');
    setDetectionState({ tested: false, isValid: false });
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newList = [...playlist];
    const temp = newList[index - 1];
    newList[index - 1] = newList[index];
    newList[index] = temp;
    onUpdatePlaylist(newList);
  };

  const moveDown = (index: number) => {
    if (index >= playlist.length - 1) return;
    const newList = [...playlist];
    const temp = newList[index + 1];
    newList[index + 1] = newList[index];
    newList[index] = temp;
    onUpdatePlaylist(newList);
  };

  const clearAllVideos = () => {
    if (playlist.length === 0) return;
    if (window.confirm('¿Estás seguro de que deseas eliminar TODOS los videos de la lista de reproducción?')) {
      onUpdatePlaylist([]);
      showToast('Lista vaciada', 'Se han eliminado todos los videos de la lista.', 'info');
    }
  };

  const removeVideo = (id: string, title: string) => {
    const filtered = playlist.filter(item => item.id !== id);
    onUpdatePlaylist(filtered);
    showToast('Video Eliminado', `"${title}" ha sido eliminado de la lista.`, 'info');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative max-w-4xl w-full bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-700 shadow-2xl flex flex-col max-h-[92vh] my-auto overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Gestor de Videos & Lista de Reproducción</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {playlist.length} videos
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Soporte automático para <strong>Google Drive</strong> y <strong>YouTube</strong> con reproducción secuencial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                try {
                  const baseUrl = window.location.origin + window.location.pathname;
                  const encoded = encodePlaylistForUrl(playlist);
                  const shareUrl = encoded ? `${baseUrl}?pl=${encoded}` : baseUrl;
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(shareUrl);
                    showToast('Enlace Copiado', 'Enlace con los ' + playlist.length + ' videos listo para compartir.', 'success');
                  }
                } catch {
                  showToast('Error', 'No se pudo generar el enlace.', 'error');
                }
              }}
              title="Copiar enlace con esta lista de videos para compartir"
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Compartir Lista</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-900/50">
          <button
            onClick={() => { resetForm(); setActiveTab('list'); }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'list'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Lista Actual ({playlist.length})</span>
          </button>

          <button
            onClick={() => { resetForm(); setActiveTab('add'); }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'add'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {editingId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{editingId ? 'Editar / Reemplazar Enlace' : 'Agregar Nuevo Video'}</span>
          </button>

          <button
            onClick={() => { resetForm(); setActiveTab('bulk'); }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'bulk'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <ListPlus className="w-4 h-4" />
            <span>Carga en Lote (Varios Videos)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: LISTA & ORDENACIÓN */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2">
                <span>Orden de reproducción secuencial (automático de arriba a abajo)</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-amber-400">💡 Usa las flechas para reordenar</span>
                  {playlist.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllVideos}
                      className="px-2.5 py-1 rounded-lg bg-red-950/80 hover:bg-red-900 text-rose-300 border border-red-500/40 text-[11px] font-bold flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3 h-3 text-rose-400" />
                      <span>Vaciar Todos los Videos</span>
                    </button>
                  )}
                </div>
              </div>

              {playlist.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
                  <p className="text-slate-400 text-sm">No hay videos en la lista.</p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="mt-3 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                  >
                    Agregar primer video
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {playlist.map((item, index) => {
                    const isCurrent = index === currentIndex;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl border transition ${
                          isCurrent
                            ? 'bg-amber-500/10 border-amber-500/60 shadow-lg'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Number Index */}
                        <div className="w-7 text-center font-mono font-bold text-xs text-slate-400">
                          #{index + 1}
                        </div>

                        {/* Thumbnail */}
                        <div className="relative w-20 h-12 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0 border border-slate-700">
                          <img
                            src={item.thumbnailUrl || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80'}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            {item.sourceType === 'youtube' ? (
                              <Youtube className="w-5 h-5 text-red-500" />
                            ) : item.sourceType === 'drive' ? (
                              <HardDrive className="w-5 h-5 text-amber-400" />
                            ) : (
                              <Film className="w-5 h-5 text-blue-400" />
                            )}
                          </div>
                        </div>

                        {/* Title and details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                item.sourceType === 'youtube'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : item.sourceType === 'drive'
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {item.sourceType === 'youtube' ? 'YouTube' : item.sourceType === 'drive' ? 'Google Drive' : 'Video Local'}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1 animate-pulse">
                                <Radio className="w-3 h-3" />
                                <span>Reproduciendo Ahora</span>
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-xs sm:text-sm text-white truncate mt-1">
                            {item.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {item.originalUrl}
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Play Now Button */}
                          <button
                            onClick={() => {
                              onSelectVideo(index);
                              showToast('Video Seleccionado', `Reproduciendo "${item.title}"`, 'success');
                            }}
                            title="Reproducir este video ahora"
                            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                              isCurrent
                                ? 'bg-amber-500 text-slate-950 shadow-md'
                                : 'bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-white'
                            }`}
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span className="hidden sm:inline">{isCurrent ? 'Al Aire' : 'Elegir'}</span>
                          </button>

                          {/* Move Up */}
                          <button
                            onClick={() => moveUp(index)}
                            disabled={index === 0}
                            title="Subir en el orden"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 hover:text-white transition"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>

                          {/* Move Down */}
                          <button
                            onClick={() => moveDown(index)}
                            disabled={index === playlist.length - 1}
                            title="Bajar en el orden"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 hover:text-white transition"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>

                          {/* Edit / Replace link */}
                          <button
                            onClick={() => startEdit(item)}
                            title="Editar o reemplazar enlace"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-blue-900/60 text-slate-300 hover:text-blue-300 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => removeVideo(item.id, item.title)}
                            title="Eliminar de la lista"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-rose-400 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AGREGAR O EDITAR UN VIDEO */}
          {activeTab === 'add' && (
            <form onSubmit={handleSaveVideo} className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-300">Detección Inteligente Automática</p>
                  <p className="text-slate-300 mt-0.5">
                    Pega cualquier enlace de <strong>YouTube</strong> (completo, acortado <code>youtu.be</code>, shorts o en vivo) o de <strong>Google Drive</strong> (cualquier formato de enlace compartido). El sistema detectará la plataforma, extraerá el identificador y creará el reproductor adecuado.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Enlace del Video (Google Drive o YouTube) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={videoUrlInput}
                    onChange={e => {
                      const val = e.target.value;
                      const cleaned = cleanRawVideoUrl(val);
                      // If user pasted an iframe snippet, automatically extract and clean the URL
                      if (val.includes('<iframe') && cleaned) {
                        setVideoUrlInput(cleaned);
                      } else {
                        setVideoUrlInput(val);
                      }
                    }}
                    placeholder="https://drive.google.com/file/d/.../view o https://www.youtube.com/watch?v=..."
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-28 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
                    {detectionState.tested && (
                      detectionState.isValid ? (
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                          detectionState.sourceType === 'youtube'
                            ? 'bg-red-600/30 text-red-300 border border-red-500/40'
                            : 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                        }`}>
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          <span>{detectionState.sourceType === 'youtube' ? 'YouTube detectado' : 'Drive detectado'}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-rose-400" />
                          <span>No reconocido</span>
                        </span>
                      )
                    )}
                  </div>
                </div>

                {detectionState.tested && detectionState.isValid && detectionState.sourceType === 'drive' && (
                  <p className="text-[11px] text-blue-300 mt-1.5 flex items-center gap-1.5 bg-blue-950/40 p-2 rounded-lg border border-blue-500/30">
                    <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <span>Importante Google Drive: Asegúrate de que el archivo tenga permiso: <strong>"Cualquier persona con el enlace" (Lector)</strong> para que se reproduzca en la web.</span>
                  </p>
                )}

                {detectionState.tested && !detectionState.isValid && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" />
                    <span>{detectionState.error || 'Asegúrate de que la URL sea un enlace público de Google Drive o un video de YouTube.'}</span>
                  </p>
                )}
              </div>

              {/* Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Título del Video *</label>
                  <input
                    type="text"
                    value={videoTitleInput}
                    onChange={e => setVideoTitleInput(e.target.value)}
                    placeholder="Ej: Festividad del Señor de Ánimas 2026"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría</label>
                  <select
                    value={videoCategoryInput}
                    onChange={e => setVideoCategoryInput(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="festividades">Festividades</option>
                    <option value="paisajes">Paisajes & Apus</option>
                    <option value="folklore">Folklore & Danzas</option>
                    <option value="comunidad">Comunidad</option>
                  </select>
                </div>
              </div>

              {/* Author & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Autor / Cobertura</label>
                  <input
                    type="text"
                    value={videoAuthorInput}
                    onChange={e => setVideoAuthorInput(e.target.value)}
                    placeholder="Ej: Entre Apus TV"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción Breve</label>
                  <input
                    type="text"
                    value={videoDescInput}
                    onChange={e => setVideoDescInput(e.target.value)}
                    placeholder="Reseña del video, año o localidad..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Preview Box if valid */}
              {detectionState.isValid && detectionState.embedUrl && (
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img
                      src={detectionState.thumbnailUrl}
                      alt="Thumbnail"
                      className="w-16 h-10 object-cover rounded-lg border border-slate-700 flex-shrink-0"
                    />
                    <div className="truncate">
                      <p className="text-xs font-bold text-white truncate">Vista previa detectada</p>
                      <p className="text-[11px] text-slate-400 truncate">{detectionState.embedUrl}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 flex-shrink-0">
                    <Check className="w-4 h-4" />
                    <span>Listo para guardar</span>
                  </span>
                </div>
              )}

              {/* Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{editingId ? 'Guardar Cambios' : 'Agregar a la Lista'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { resetForm(); setActiveTab('list'); }}
                  className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: AGREGAR VARIOS VIDEOS EN LOTE */}
          {activeTab === 'bulk' && (
            <form onSubmit={handleBulkAdd} className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-xs text-blue-200">
                <p className="font-bold text-blue-300 flex items-center gap-1.5 mb-1">
                  <ListPlus className="w-4 h-4 text-blue-400" />
                  <span>Carga Rápida de Múltiples Videos</span>
                </p>
                <p className="text-slate-300 leading-relaxed">
                  Pega varios enlaces (uno por línea). Opcionalmente puedes agregar el título separándolo con una barra vertical <code>|</code>:
                </p>
                <pre className="mt-2 p-2.5 rounded-xl bg-slate-950 font-mono text-[11px] text-amber-300 border border-slate-800 overflow-x-auto">
{`https://www.youtube.com/watch?v=dQw4w9WgXcQ | Procesión Central
https://drive.google.com/file/d/1th_earNmAA5JojTVVutxh6wAC2zW0hW_/view | Huaylias de Chalhuanca
https://youtu.be/dQw4w9WgXcQ`}
                </pre>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pega aquí la lista de enlaces (uno por línea):
                </label>
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  rows={6}
                  placeholder="https://www.youtube.com/watch?v=...&#10;https://drive.google.com/file/d/.../view | Título opcional"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!bulkText.trim()}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Procesar y Agregar Todos</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setBulkText(''); setActiveTab('list'); }}
                  className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                >
                  Volver a la lista
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Youtube className="w-3.5 h-3.5 text-red-500" />
              <span>YouTube</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              <span>Google Drive</span>
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
          >
            Cerrar Panel
          </button>
        </div>

      </div>
    </div>
  );
};
