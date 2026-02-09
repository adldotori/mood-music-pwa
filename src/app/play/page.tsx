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

function PlayPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mood = searchParams.get('mood') || '잔잔한';
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('음악 추천 받는 중...');
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const initDoneRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
                  body: JSON.stringify({ query: `${song.artist} ${song.title}` }),
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
        setIsLoading(false);

      } catch (err) {
        console.error('Init error:', err);
        setError('음악을 불러오는 중 오류가 발생했습니다.');
        setIsLoading(false);
      }
    };

    init();
  }, [mood]);

  const playSongAtIndex = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const playNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % queue.length);
  }, [queue.length]);

  const playPrevious = useCallback(() => {
    setCurrentIndex(prev => prev > 0 ? prev - 1 : queue.length - 1);
  }, [queue.length]);

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
            body: JSON.stringify({ query: `${song.artist} ${song.title}` }),
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
        } catch { /* skip */ }
      }

      setQueue(prev => [...prev, ...newItems]);
    } catch { /* ignore */ }
    setLoadingStatus('');
  };

  // Save mood to recent history
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentMoods');
      const recent: string[] = stored ? JSON.parse(stored) : [];
      const updated = [mood, ...recent.filter(m => m !== mood)].slice(0, 10);
      localStorage.setItem('recentMoods', JSON.stringify(updated));
    } catch { /* ignore */ }
  }, [mood]);

  // Listen for iframe messages to detect video end (for auto-advance)
  useEffect(() => {
    // YouTube iframe with enablejsapi sends postMessage events
    const handleMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          // YouTube sends playerState changes via postMessage
          if (data.event === 'onStateChange' && data.info === 0) {
            // State 0 = ended
            playNext();
          }
        }
      } catch { /* not a YouTube message */ }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [playNext]);

  const currentSong = queue[currentIndex];

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
            {/* YouTube Player - Simple iframe embed */}
            <div className="rounded-2xl overflow-hidden mb-4 bg-black aspect-video">
              <iframe
                ref={iframeRef}
                key={currentSong.videoId}
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${currentSong.videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
                title={currentSong.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ border: 'none' }}
              />
            </div>

            {/* Current Song Info */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 mb-4">
              <h2 className="text-xl font-bold mb-1">{currentSong.title}</h2>
              <p className="text-gray-400">{currentSong.artist}</p>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6 mb-6">
              <button
                onClick={playPrevious}
                className="bg-white/5 border border-white/10 rounded-full w-14 h-14 flex items-center justify-center text-2xl hover:bg-white/10 transition-colors active:scale-95"
              >
                ⏮
              </button>
              <button
                onClick={playNext}
                className="bg-gradient-to-r from-purple-600 to-violet-600 rounded-full w-16 h-16 flex items-center justify-center text-3xl shadow-lg shadow-purple-500/30 active:scale-95"
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
                        {index === currentIndex ? '🔊' : index + 1}
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
