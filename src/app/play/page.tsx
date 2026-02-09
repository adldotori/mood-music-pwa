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
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function PlayPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mood = searchParams.get('mood') || '잔잔한';
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [player, setPlayer] = useState<any>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube API Ready');
      };
    }
  }, []);

  // Get song recommendations
  const getRecommendations = useCallback(async (excludeSongs: string[] = []) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mood, 
          count: 10,
          exclude: excludeSongs 
        }),
      });

      if (!response.ok) throw new Error('추천 실패');
      
      const data = await response.json();
      return data.songs;
    } catch (error) {
      console.error('Error getting recommendations:', error);
      setError('음악 추천을 받는 중 오류가 발생했습니다.');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [mood]);

  // Search YouTube for song
  const searchYouTube = useCallback(async (song: Song): Promise<QueueItem | null> => {
    try {
      const query = `${song.artist} ${song.title}`;
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) throw new Error('검색 실패');
      
      const data = await response.json();
      return {
        ...song,
        id: `${song.artist}-${song.title}-${Date.now()}`,
        videoId: data.videoId,
        thumbnail: data.thumbnail,
      };
    } catch (error) {
      console.error('Error searching YouTube:', error);
      return null;
    }
  }, []);

  // Initialize player and load songs
  useEffect(() => {
    const initializePlayer = async () => {
      const recommendations = await getRecommendations();
      
      if (recommendations.length === 0) {
        setError('추천된 음악이 없습니다.');
        return;
      }

      // Search YouTube for each recommendation
      const queueItems: QueueItem[] = [];
      for (const song of recommendations) {
        const queueItem = await searchYouTube(song);
        if (queueItem && queueItem.videoId) {
          queueItems.push(queueItem);
        }
      }

      if (queueItems.length === 0) {
        setError('재생할 수 있는 음악을 찾을 수 없습니다.');
        return;
      }

      setQueue(queueItems);
      
      // Initialize YouTube player when API is ready
      const checkYT = () => {
        if (window.YT && window.YT.Player) {
          const ytPlayer = new window.YT.Player(playerRef.current, {
            height: '200',
            width: '100%',
            videoId: queueItems[0].videoId,
            playerVars: {
              autoplay: 1,
              controls: 1,
              modestbranding: 1,
              rel: 0,
            },
            events: {
              onReady: (event: any) => {
                setPlayer(event.target);
                setIsPlaying(true);
              },
              onStateChange: (event: any) => {
                if (event.data === window.YT.PlayerState.ENDED) {
                  playNext();
                }
                setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
              },
            },
          });
        } else {
          setTimeout(checkYT, 100);
        }
      };
      
      checkYT();
    };

    initializePlayer();
  }, [mood, getRecommendations, searchYouTube]);

  const playNext = useCallback(() => {
    const nextIndex = (currentIndex + 1) % queue.length;
    setCurrentIndex(nextIndex);
    if (player && queue[nextIndex]?.videoId) {
      player.loadVideoById(queue[nextIndex].videoId);
    }
  }, [currentIndex, queue, player]);

  const playPrevious = useCallback(() => {
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
    setCurrentIndex(prevIndex);
    if (player && queue[prevIndex]?.videoId) {
      player.loadVideoById(queue[prevIndex].videoId);
    }
  }, [currentIndex, queue, player]);

  const togglePlayPause = useCallback(() => {
    if (player) {
      if (isPlaying) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    }
  }, [player, isPlaying]);

  const getMoreSongs = async () => {
    const existingSongs = queue.map(item => `${item.artist} ${item.title}`);
    const newRecommendations = await getRecommendations(existingSongs);
    
    const newQueueItems: QueueItem[] = [];
    for (const song of newRecommendations) {
      const queueItem = await searchYouTube(song);
      if (queueItem && queueItem.videoId) {
        newQueueItems.push(queueItem);
      }
    }
    
    setQueue(prev => [...prev, ...newQueueItems]);
  };

  const currentSong = queue[currentIndex];

  if (error) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">❌ {error}</div>
          <button
            onClick={() => router.push('/')}
            className="gradient-button px-6 py-2 rounded-lg"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            ← 뒤로
          </button>
          <h1 className="text-lg font-medium gradient-text">{mood}</h1>
          <div></div>
        </div>

        {/* Current Song Info */}
        {currentSong && (
          <div className="backdrop-blur-sm bg-purple-500/10 border border-purple-500/20 rounded-2xl p-6 mb-6">
            {currentSong.thumbnail && (
              <img
                src={currentSong.thumbnail}
                alt={currentSong.title}
                className="w-full aspect-video object-cover rounded-lg mb-4"
              />
            )}
            <h2 className="text-xl font-semibold mb-1">{currentSong.title}</h2>
            <p className="text-gray-400 mb-4">{currentSong.artist}</p>
            
            {/* YouTube Player */}
            <div className="mb-4">
              <div ref={playerRef}></div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={playPrevious}
                className="backdrop-blur-sm bg-purple-500/10 border border-purple-500/20 rounded-full p-3 hover:bg-purple-500/20 transition-colors"
              >
                ⏮️
              </button>
              <button
                onClick={togglePlayPause}
                className="gradient-button rounded-full p-4 text-xl"
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>
              <button
                onClick={playNext}
                className="backdrop-blur-sm bg-purple-500/10 border border-purple-500/20 rounded-full p-3 hover:bg-purple-500/20 transition-colors"
              >
                ⏭️
              </button>
            </div>
          </div>
        )}

        {/* Queue */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-300">재생목록</h3>
            <button
              onClick={getMoreSongs}
              className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
              disabled={isLoading}
            >
              {isLoading ? '로딩...' : '더 추가하기'}
            </button>
          </div>
          
          <div className="space-y-2">
            {queue.map((song, index) => (
              <div
                key={song.id}
                onClick={() => {
                  setCurrentIndex(index);
                  if (player && song.videoId) {
                    player.loadVideoById(song.videoId);
                  }
                }}
                className={`backdrop-blur-sm bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 cursor-pointer transition-all duration-300 ${
                  index === currentIndex
                    ? 'bg-purple-500/30 border-purple-500/50'
                    : 'hover:bg-purple-500/10'
                }`}
              >
                <div className="font-medium text-sm">{song.title}</div>
                <div className="text-gray-400 text-xs">{song.artist}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center text-gray-400">
            🎵 음악을 찾는 중...
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-purple-400 mb-4">🎵 로딩 중...</div>
        </div>
      </div>
    }>
      <PlayPageContent />
    </Suspense>
  );
}