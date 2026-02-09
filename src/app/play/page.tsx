'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface Song {
  title: string;
  artist: string;
  videoId?: string;
  thumbnail?: string;
}

interface QueueItem extends Song {
  id: string;
}

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

function PlayPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mood = searchParams.get('mood') || '잔잔한';
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('음악 추천 받는 중...');
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [needsUserTap, setNeedsUserTap] = useState(false);
  
  const playerInstanceRef = useRef<YT.Player | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const currentIndexRef = useRef(0);
  const ytReadyRef = useRef(false);
  const initDoneRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      ytReadyRef.current = true;
      return;
    }

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) return;

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      ytReadyRef.current = true;
    };
  }, []);

  const playNext = useCallback(() => {
    const q = queueRef.current;
    const idx = currentIndexRef.current;
    if (q.length === 0) return;
    
    const nextIdx = (idx + 1) % q.length;
    setCurrentIndex(nextIdx);
    currentIndexRef.current = nextIdx;
    
    if (playerInstanceRef.current && q[nextIdx]?.videoId) {
      playerInstanceRef.current.loadVideoById(q[nextIdx].videoId!);
    }
  }, []);

  const playPrevious = useCallback(() => {
    const q = queueRef.current;
    const idx = currentIndexRef.current;
    if (q.length === 0) return;
    
    const prevIdx = idx > 0 ? idx - 1 : q.length - 1;
    setCurrentIndex(prevIdx);
    currentIndexRef.current = prevIdx;
    
    if (playerInstanceRef.current && q[prevIdx]?.videoId) {
      playerInstanceRef.current.loadVideoById(q[prevIdx].videoId!);
    }
  }, []);

  const playNextRef = useRef(playNext);
  playNextRef.current = playNext;

  // Create YouTube player on a specific video
  const createPlayer = useCallback((videoId: string) => {
    // Destroy existing player
    if (playerInstanceRef.current) {
      try { playerInstanceRef.current.destroy(); } catch {}
      playerInstanceRef.current = null;
    }

    const waitForYT = () => {
      if (window.YT && window.YT.Player) {
        const container = document.getElementById('yt-player-container');
        if (!container) return;
        
        // Create a fresh div for the player
        container.innerHTML = '<div id="yt-player"></div>';
        
        playerInstanceRef.current = new window.YT.Player('yt-player', {
          height: '220',
          width: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,  // Critical for iOS
          },
          events: {
            onReady: (event: YT.PlayerEvent) => {
              setPlayerReady(true);
              // Try to play - might be blocked on mobile
              try {
                event.target.playVideo();
                setIsPlaying(true);
                setNeedsUserTap(false);
              } catch {
                setNeedsUserTap(true);
              }
            },
            onStateChange: (event: YT.OnStateChangeEvent) => {
              if (event.data === YT.PlayerState.ENDED) {
                playNextRef.current();
              }
              if (event.data === YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                setNeedsUserTap(false);
              }
              if (event.data === YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              }
              // Detect if autoplay was blocked (unstarted state)
              if (event.data === YT.PlayerState.CUED || event.data === -1) {
                setNeedsUserTap(true);
              }
            },
            onError: () => {
              // Skip to next song on error
              playNextRef.current();
            },
          },
        });
      } else {
        setTimeout(waitForYT, 200);
      }
    };
    
    waitForYT();
  }, []);

  // Get recommendations and search YouTube
  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    const init = async () => {
      try {
        setIsLoading(true);
        setLoadingStatus('🎵 무드에 맞는 음악 추천 받는 중...');

        const recResponse = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mood, count: 10 }),
        });

        if (!recResponse.ok) throw new Error('추천 실패');
        const recData = await recResponse.json();
        const songs: Song[] = recData.songs;

        if (!songs || songs.length === 0) {
          setError('추천된 음악이 없습니다.');
          return;
        }

        setLoadingStatus(`🔍 ${songs.length}곡 YouTube에서 검색 중...`);

        // Search YouTube for all songs in parallel (batch of 3)
        const queueItems: QueueItem[] = [];
        for (let i = 0; i < songs.length; i += 3) {
          const batch = songs.slice(i, i + 3);
          const results = await Promise.all(
            batch.map(async (song) => {
              try {
                const res = await fetch('/api/search', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ query: `${song.artist} ${song.title} official` }),
                });
                if (!res.ok) return null;
                const data = await res.json();
                if (!data.videoId) return null;
                return {
                  ...song,
                  id: `${song.artist}-${song.title}-${Date.now()}-${Math.random()}`,
                  videoId: data.videoId,
                  thumbnail: data.thumbnail,
                } as QueueItem;
              } catch {
                return null;
              }
            })
          );
          queueItems.push(...results.filter((r): r is QueueItem => r !== null));
          setLoadingStatus(`🔍 ${Math.min(i + 3, songs.length)}/${songs.length}곡 검색 완료`);
        }

        if (queueItems.length === 0) {
          setError('재생할 수 있는 음악을 찾을 수 없습니다.');
          return;
        }

        setQueue(queueItems);
        queueRef.current = queueItems;
        setIsLoading(false);
        setLoadingStatus('');

        // Start playing the first song
        createPlayer(queueItems[0].videoId!);

      } catch (err) {
        console.error('Init error:', err);
        setError('음악을 불러오는 중 오류가 발생했습니다.');
        setIsLoading(false);
      }
    };

    init();
  }, [mood, createPlayer]);

  const togglePlayPause = useCallback(() => {
    const p = playerInstanceRef.current;
    if (!p) return;
    try {
      if (isPlaying) {
        p.pauseVideo();
      } else {
        p.playVideo();
      }
    } catch {}
  }, [isPlaying]);

  const handleUserTap = useCallback(() => {
    const p = playerInstanceRef.current;
    if (p) {
      try { p.playVideo(); } catch {}
    }
    setNeedsUserTap(false);
  }, []);

  const playSongAtIndex = useCallback((index: number) => {
    setCurrentIndex(index);
    currentIndexRef.current = index;
    const song = queueRef.current[index];
    if (song?.videoId && playerInstanceRef.current) {
      playerInstanceRef.current.loadVideoById(song.videoId);
    }
  }, []);

  const getMoreSongs = async () => {
    const existingSongs = queue.map(item => `${item.artist} ${item.title}`);
    setLoadingStatus('🎵 더 많은 음악 찾는 중...');
    
    try {
      const recResponse = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, count: 10, exclude: existingSongs }),
      });

      if (!recResponse.ok) return;
      const recData = await recResponse.json();
      const songs: Song[] = recData.songs;

      const newItems: QueueItem[] = [];
      for (const song of songs) {
        try {
          const res = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `${song.artist} ${song.title} official` }),
          });
          if (!res.ok) continue;
          const data = await res.json();
          if (!data.videoId) continue;
          newItems.push({
            ...song,
            id: `${song.artist}-${song.title}-${Date.now()}-${Math.random()}`,
            videoId: data.videoId,
            thumbnail: data.thumbnail,
          });
        } catch {}
      }

      setQueue(prev => [...prev, ...newItems]);
    } catch {}
    setLoadingStatus('');
  };

  const currentSong = queue[currentIndex];

  // Save mood to recent history
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentMoods');
      const recent: string[] = stored ? JSON.parse(stored) : [];
      const updated = [mood, ...recent.filter(m => m !== mood)].slice(0, 10);
      localStorage.setItem('recentMoods', JSON.stringify(updated));
    } catch {}
  }, [mood]);

  if (error) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4 text-lg">❌ {error}</div>
          <button
            onClick={() => router.push('/')}
            className="bg-gradient-to-r from-purple-600 to-violet-600 px-6 py-3 rounded-xl font-medium"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-32">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-purple-400 hover:text-purple-300 transition-colors text-lg"
          >
            ← 뒤로
          </button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
            {mood}
          </h1>
          <div className="w-12"></div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-4xl mb-4 animate-bounce">🎵</div>
            <div className="text-gray-300 text-lg mb-2">{loadingStatus}</div>
            <div className="w-48 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full animate-pulse" style={{width: '60%'}}></div>
            </div>
          </div>
        )}

        {/* Player Area */}
        {!isLoading && currentSong && (
          <>
            {/* YouTube Player */}
            <div className="rounded-2xl overflow-hidden mb-4 bg-black">
              <div id="yt-player-container">
                <div id="yt-player"></div>
              </div>
            </div>

            {/* Tap to Play overlay for mobile */}
            {needsUserTap && (
              <button
                onClick={handleUserTap}
                className="w-full bg-gradient-to-r from-purple-600 to-violet-600 py-4 rounded-xl text-lg font-bold mb-4 animate-pulse"
              >
                ▶️ 탭하여 재생
              </button>
            )}

            {/* Current Song Info */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 mb-4">
              <h2 className="text-xl font-bold mb-1">{currentSong.title}</h2>
              <p className="text-gray-400">{currentSong.artist}</p>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6 mb-6">
              <button
                onClick={playPrevious}
                className="bg-white/5 border border-white/10 rounded-full w-14 h-14 flex items-center justify-center text-2xl hover:bg-white/10 transition-colors"
              >
                ⏮
              </button>
              <button
                onClick={togglePlayPause}
                className="bg-gradient-to-r from-purple-600 to-violet-600 rounded-full w-16 h-16 flex items-center justify-center text-3xl shadow-lg shadow-purple-500/30"
              >
                {isPlaying ? '⏸' : '▶️'}
              </button>
              <button
                onClick={playNext}
                className="bg-white/5 border border-white/10 rounded-full w-14 h-14 flex items-center justify-center text-2xl hover:bg-white/10 transition-colors"
              >
                ⏭
              </button>
            </div>

            {/* Queue */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-300">
                  재생목록 ({queue.length}곡)
                </h3>
                <button
                  onClick={getMoreSongs}
                  className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
                >
                  + 더 추가
                </button>
              </div>
              
              <div className="space-y-2">
                {queue.map((song, index) => (
                  <button
                    key={song.id}
                    onClick={() => playSongAtIndex(index)}
                    className={`w-full text-left rounded-xl p-3 transition-all duration-200 ${
                      index === currentIndex
                        ? 'bg-purple-500/20 border border-purple-500/40'
                        : 'bg-white/5 border border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-sm w-6 text-center">
                        {index === currentIndex ? (isPlaying ? '🔊' : '⏸') : index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{song.title}</div>
                        <div className="text-gray-400 text-xs truncate">{song.artist}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {loadingStatus && (
              <div className="text-center text-gray-400 text-sm mt-4">{loadingStatus}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-4xl animate-bounce">🎵</div>
      </div>
    }>
      <PlayPageContent />
    </Suspense>
  );
}
