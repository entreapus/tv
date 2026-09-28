import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  SkipForward,
  SkipBack,
  Volume2,
  Maximize2,
  Radio,
  List,
  Layers,
  Settings,
  Youtube,
  HardDrive,
  Film,
  Repeat,
  Timer,
  ListPlus,
  RotateCcw
} from 'lucide-react';
import { PlaylistItem } from './videoService';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface VideoPlayerSectionProps {
  playlist: PlaylistItem[];
  currentIndex: number;
  onSelectVideo: (index: number) => void;
  onOpenManager: () => void;
  isAdmin: boolean;
  isLiveMode?: boolean;
}

export const VideoPlayerSection: React.FC<VideoPlayerSectionProps> = ({
  playlist,
  currentIndex,
  onSelectVideo,
  onOpenManager,
  isAdmin,
  isLiveMode = false
}) => {
  const currentItem: PlaylistItem | undefined = playlist[currentIndex] || playlist[0];

  // Auto-play and Loop continuous states
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Auto-advance timer for Google Drive (where iframe prevents cross-origin ended events)
  const [autoAdvanceTimerMode, setAutoAdvanceTimerMode] = useState<number>(180);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(180);

  const [playlistDrawerOpen, setPlaylistDrawerOpen] = useState(false);
  const [isMutedAutoplay, setIsMutedAutoplay] = useState(false);

  // References to ensure fresh state inside callbacks and listeners
  const containerRef = useRef<HTMLDivElement>(null);
  const html5VideoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const lastEndedTimeRef = useRef<number>(0);

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;

  const autoAdvanceRef = useRef(autoAdvance);
  autoAdvanceRef.current = autoAdvance;

  const onSelectVideoRef = useRef(onSelectVideo);
  onSelectVideoRef.current = onSelectVideo;

  // Handles video finish: advances to next or loops back to the very first video
  // Uses setTimeout to guarantee it NEVER runs during React render phase
  const handleVideoEnded = () => {
    const now = Date.now();
    // Guard against duplicate callbacks fired within 1.2s for the same video finish
    if (now - lastEndedTimeRef.current < 1200) {
      return;
    }
    lastEndedTimeRef.current = now;

    if (!autoAdvanceRef.current) return;

    const list = playlistRef.current;
    const current = currentIndexRef.current;

    if (!list || list.length === 0) return;

    // Asynchronously update to prevent React setState-in-render collision
    setTimeout(() => {
      if (current < list.length - 1) {
        // Advance to next video
        onSelectVideoRef.current(current + 1);
      } else {
        // Reached end of playlist! Loop back to first video (index 0)
        if (list.length > 1) {
          onSelectVideoRef.current(0);
        } else {
          // Only 1 video in list: restart it
          if (ytPlayerRef.current) {
            try {
              ytPlayerRef.current.seekTo(0, true);
              ytPlayerRef.current.playVideo();
            } catch (e) {}
          } else if (html5VideoRef.current) {
            try {
              html5VideoRef.current.currentTime = 0;
              html5VideoRef.current.play();
            } catch (e) {}
          }
        }
      }
    }, 0);
  };

  // Play Next Video manually
  const playNext = () => {
    const list = playlistRef.current;
    const current = currentIndexRef.current;
    if (!list || list.length === 0) return;

    setTimeout(() => {
      if (current < list.length - 1) {
        onSelectVideoRef.current(current + 1);
      } else {
        onSelectVideoRef.current(0);
      }
    }, 0);
  };

  // Play Previous Video manually
  const playPrev = () => {
    const list = playlistRef.current;
    const current = currentIndexRef.current;
    if (!list || list.length === 0) return;

    setTimeout(() => {
      if (current > 0) {
        onSelectVideoRef.current(current - 1);
      } else {
        onSelectVideoRef.current(list.length - 1);
      }
    }, 0);
  };

  // 1. Load YouTube Iframe API Script once
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // 2. Initialize YouTube Player with reliable onEnded callback and Autoplay
  useEffect(() => {
    if (!currentItem || currentItem.sourceType !== 'youtube' || !currentItem.videoId) {
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {}
        ytPlayerRef.current = null;
      }
      return;
    }

    let isSubscribed = true;

    const initYt = () => {
      if (!isSubscribed) return;

      const mountEl = document.getElementById('youtube-player-mount');
      if (!mountEl) {
        setTimeout(initYt, 100);
        return;
      }

      if (!window.YT || !window.YT.Player) {
        setTimeout(initYt, 150);
        return;
      }

      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {}
        ytPlayerRef.current = null;
      }

      try {
        ytPlayerRef.current = new window.YT.Player('youtube-player-mount', {
          videoId: currentItem.videoId,
          playerVars: {
            autoplay: 1,
            enablejsapi: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            controls: 1,
            origin: window.location.origin
          },
          events: {
            onReady: (event: any) => {
              if (!isSubscribed) return;
              try {
                const playPromise = event.target.playVideo();
                if (playPromise && typeof playPromise.catch === 'function') {
                  playPromise.catch(() => {
                    try {
                      event.target.mute();
                      event.target.playVideo();
                      setIsMutedAutoplay(true);
                    } catch (e) {}
                  });
                }
              } catch (e) {
                try {
                  event.target.mute();
                  event.target.playVideo();
                  setIsMutedAutoplay(true);
                } catch (err) {}
              }
            },
            onStateChange: (event: any) => {
              // YT.PlayerState.ENDED is 0
              if (event.data === 0) {
                setTimeout(() => {
                  handleVideoEnded();
                }, 0);
              }
            }
          }
        });
      } catch (err) {
        console.warn('Error mounting YouTube player:', err);
      }
    };

    const timer = setTimeout(initYt, 50);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {}
        ytPlayerRef.current = null;
      }
    };
  }, [currentIndex, currentItem?.id, currentItem?.videoId, currentItem?.sourceType]);

  // 3. Global postMessage Listener for YouTube iframe events
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      try {
        if (!event.data) return;
        let data = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (
          (data?.event === 'onStateChange' && data?.info === 0) ||
          (data?.info && typeof data.info === 'object' && data.info.playerState === 0)
        ) {
          setTimeout(() => {
            handleVideoEnded();
          }, 0);
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, []);

  // 4. Google Drive Countdown Timer for Auto-Advance
  // (Safely triggers handleVideoEnded outside the state updater function)
  useEffect(() => {
    if (!autoAdvance) return;

    const initialTime = autoAdvanceTimerMode > 0 ? autoAdvanceTimerMode : 180;
    setRemainingSeconds(initialTime);

    if (currentItem?.sourceType === 'drive') {
      const interval = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            // Trigger outside the React state updater
            setTimeout(() => {
              handleVideoEnded();
            }, 0);
            return initialTime;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [currentIndex, currentItem?.id, currentItem?.sourceType, autoAdvance, autoAdvanceTimerMode]);

  // Unmute function if browser forced muted autoplay
  const handleUnmute = () => {
    if (ytPlayerRef.current) {
      try {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume(100);
        setIsMutedAutoplay(false);
      } catch (e) {}
    }
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isLastVideo = playlist.length > 0 && currentIndex === playlist.length - 1;

  return (
    <div className="space-y-4">
      {/* Player Container */}
      <div
        ref={containerRef}
        className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black border border-slate-700 shadow-2xl flex items-center justify-center group"
      >
        {/* 1. YOUTUBE PLAYER CONTAINER */}
        {currentItem?.sourceType === 'youtube' && (
          <div
            key={`yt-player-container-${currentItem.id}-${currentIndex}`}
            className="w-full h-full relative"
          >
            <div id="youtube-player-mount" className="w-full h-full" />
          </div>
        )}

        {/* 2. GOOGLE DRIVE IFRAME PLAYER */}
        {currentItem?.sourceType === 'drive' && (
          <iframe
            key={currentItem.id}
            src={currentItem.embedUrl}
            title={currentItem.title}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        )}

        {/* 3. DIRECT HTML5 VIDEO */}
        {currentItem?.sourceType === 'direct' && (
          <video
            ref={html5VideoRef}
            key={currentItem.id}
            src={currentItem.embedUrl}
            autoPlay
            controls
            playsInline
            onEnded={() => {
              setTimeout(() => {
                handleVideoEnded();
              }, 0);
            }}
            className="w-full h-full object-contain"
          />
        )}

        {/* Empty state canvas fallback */}
        {!currentItem && (
          <div className="relative w-full h-full flex items-center justify-center bg-slate-950 p-6 text-center">
            <div className="flex flex-col items-center justify-center max-w-md">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-3 shadow-xl">
                <Radio className="w-8 h-8 animate-pulse" />
              </div>
              <h3 className="font-display font-extrabold text-xl sm:text-2xl text-white">
                Señal en Espera — Lista Vacía
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 mb-5">
                {isAdmin
                  ? 'No hay videos cargados en la lista de transmisión. Agrega enlaces de YouTube o Google Drive para iniciar la transmisión en vivo.'
                  : 'Nuestra transmisión continuará en breve con la mejor programación cultural de Chalhuanca y Aymaraes.'}
              </p>
              {isAdmin && (
                <button
                  onClick={onOpenManager}
                  className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition"
                >
                  <ListPlus className="w-4 h-4" />
                  <span>Agregar Videos a la Señal</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Unmute floating button if browser forced muted autoplay */}
        {isMutedAutoplay && (
          <button
            onClick={handleUnmute}
            className="absolute top-16 left-4 z-30 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-xl transition animate-bounce"
          >
            <Volume2 className="w-4 h-4" />
            <span>Activar Sonido</span>
          </button>
        )}

        {/* Top Badges */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 pointer-events-none">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-600 text-white text-xs font-extrabold tracking-wider uppercase shadow-xl border border-rose-400/40">
            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
            <span>TRANSMISIÓN VIVO</span>
          </div>
        </div>

        {/* Top Right Channel Badge and Admin Counter */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {isAdmin && playlist.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-white text-xs font-bold">
              <span className="text-amber-400">{currentIndex + 1}</span>
              <span className="text-slate-500">/</span>
              <span>{playlist.length}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>ENTRE APUS TV</span>
          </div>
        </div>

        {/* Bottom Video Information & Bar */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/85 to-transparent p-4 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pointer-events-auto">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={playPrev}
                title="Video anterior"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white hover:text-amber-400 transition"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={playNext}
                title={isLastVideo ? 'Volver al primer video (Video 1)' : 'Pasar al siguiente video'}
                className="p-2 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold transition flex items-center gap-1 shadow-lg"
              >
                {isLastVideo ? <RotateCcw className="w-4 h-4" /> : <SkipForward className="w-4 h-4" />}
                <span className="text-xs hidden sm:inline">
                  {isLastVideo ? 'Volver al 1' : 'Siguiente'}
                </span>
              </button>
            </div>

            <div className="truncate">
              <p className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-1.5">
                <span>{currentItem?.title || 'Señal Entre Apus TV'}</span>
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {currentItem?.category?.toUpperCase()} • {currentItem?.author || 'Chalhuanca'}
              </p>
            </div>
          </div>

          {/* Quick Controls */}
          <div className="flex items-center gap-2 flex-shrink-0 justify-end flex-wrap">
            {/* Auto-Advance / Loop Toggle */}
            <button
              onClick={() => setAutoAdvance(!autoAdvance)}
              title={
                autoAdvance
                  ? 'Bucle continuo activado: Avanza automáticamente y al terminar vuelve al video 1'
                  : 'Bucle continuo desactivado'
              }
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                autoAdvance
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              <Repeat className={`w-3.5 h-3.5 ${autoAdvance ? 'text-amber-400' : ''}`} />
              <span className="text-[11px]">{autoAdvance ? 'Bucle: ON' : 'Bucle: OFF'}</span>
            </button>

            {/* Google Drive Timer duration selector */}
            {currentItem?.sourceType === 'drive' && (
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-2 py-1 text-xs">
                <Timer className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
                <select
                  value={autoAdvanceTimerMode}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setAutoAdvanceTimerMode(val);
                    setRemainingSeconds(val);
                  }}
                  className="bg-transparent text-white text-[11px] font-semibold focus:outline-none cursor-pointer"
                  title="Tiempo para avanzar automáticamente para videos de Google Drive"
                >
                  <option value={60} className="bg-slate-900 text-white">1 min</option>
                  <option value={120} className="bg-slate-900 text-white">2 min</option>
                  <option value={180} className="bg-slate-900 text-white">3 min</option>
                  <option value={300} className="bg-slate-900 text-white">5 min</option>
                  <option value={600} className="bg-slate-900 text-white">10 min</option>
                  <option value={900} className="bg-slate-900 text-white">15 min</option>
                </select>
              </div>
            )}

            {/* Playlist Drawer Toggle - SOLO ADMINISTRADOR */}
            {isAdmin && (
              <button
                onClick={() => setPlaylistDrawerOpen(!playlistDrawerOpen)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition"
              >
                <List className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Lista</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-[10px] text-amber-300">
                  {playlist.length}
                </span>
              </button>
            )}

            {/* Admin Manage Button */}
            {isAdmin && (
              <button
                onClick={onOpenManager}
                title="Administrar videos"
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition shadow"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Gestionar</span>
              </button>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              title="Pantalla Completa"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Playlist Drawer / Bar - SOLO ADMINISTRADOR */}
      {isAdmin && playlistDrawerOpen && (
        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white">
                Lista de Reproducción Continua
              </h3>
              <span className="text-[11px] text-slate-400">
                ({playlist.length} videos programados en bucle infinito)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={onOpenManager}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  <span>Modificar Orden / Agregar</span>
                </button>
              )}
              <button
                onClick={() => setPlaylistDrawerOpen(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto pr-1">
            {playlist.map((item, idx) => {
              const active = idx === currentIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectVideo(idx)}
                  className={`flex items-center gap-2.5 p-2 rounded-xl text-left border transition ${
                    active
                      ? 'bg-amber-500/20 border-amber-500 text-white shadow'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="relative w-12 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-slate-900">
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      {active ? (
                        <Play className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      ) : item.sourceType === 'youtube' ? (
                        <Youtube className="w-3 h-3 text-red-500" />
                      ) : (
                        <HardDrive className="w-3 h-3 text-blue-400" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[11px] truncate">
                      {idx + 1}. {item.title}
                    </p>
                    <p className="text-[10px] text-slate-400 capitalize">
                      {item.sourceType === 'youtube' ? 'YouTube' : 'Drive'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
