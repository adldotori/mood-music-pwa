'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface RecentMood {
  mood: string;
  timestamp: number;
}

const PRESET_MOODS = [
  { emoji: '🌊', label: '잔잔한', value: 'calm' },
  { emoji: '🔥', label: '신나는', value: 'energetic' },
  { emoji: '🌧️', label: '우울한', value: 'melancholy' },
  { emoji: '🎯', label: '집중', value: 'focus' },
  { emoji: '💕', label: '로맨틱', value: 'romantic' },
  { emoji: '🚗', label: '드라이브', value: 'drive' },
  { emoji: '💪', label: '운동', value: 'workout' },
  { emoji: '🌙', label: '새벽감성', value: 'late-night' },
  { emoji: '☕', label: '카페', value: 'cafe' },
  { emoji: '🎉', label: '파티', value: 'party' },
  { emoji: '🍂', label: '가을감성', value: 'autumn' },
  { emoji: '🎸', label: '록', value: 'rock' },
];

export default function Home() {
  const [customMood, setCustomMood] = useState('');
  const [recentMoods, setRecentMoods] = useState<RecentMood[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Load recent moods from localStorage
    const stored = localStorage.getItem('recentMoods');
    if (stored) {
      setRecentMoods(JSON.parse(stored));
    }
  }, []);

  const addToRecentMoods = (mood: string) => {
    const newMood: RecentMood = {
      mood,
      timestamp: Date.now(),
    };

    const updated = [newMood, ...recentMoods.filter(m => m.mood !== mood)]
      .slice(0, 5); // Keep only 5 recent moods

    setRecentMoods(updated);
    localStorage.setItem('recentMoods', JSON.stringify(updated));
  };

  const handleMoodSelect = (mood: string) => {
    addToRecentMoods(mood);
    router.push(`/play?mood=${encodeURIComponent(mood)}`);
  };

  const handleCustomMoodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customMood.trim()) {
      handleMoodSelect(customMood.trim());
    }
  };

  return (
    <div className="min-h-screen p-4 pb-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">무드뮤직</h1>
          <p className="text-gray-400">감정에 따른 맞춤 음악 추천</p>
        </div>

        {/* Recent Moods */}
        {recentMoods.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-gray-300">최근 감정</h2>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {recentMoods.map((recent, index) => (
                <button
                  key={index}
                  onClick={() => handleMoodSelect(recent.mood)}
                  className="flex-shrink-0 backdrop-blur-sm bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-2 text-sm transition-all duration-300 hover:bg-purple-500/20"
                >
                  {recent.mood}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Mood Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-300">빠른 선택</h2>
          <div className="grid grid-cols-2 gap-3">
            {PRESET_MOODS.map((mood) => (
              <button
                key={mood.value}
                onClick={() => handleMoodSelect(mood.label)}
                className="mood-card text-left"
              >
                <div className="text-2xl mb-2">{mood.emoji}</div>
                <div className="font-medium">{mood.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Mood Input */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-300">나만의 감정</h2>
          <form onSubmit={handleCustomMoodSubmit}>
            <div className="flex gap-2">
              <input
                type="text"
                value={customMood}
                onChange={(e) => setCustomMood(e.target.value)}
                placeholder="지금 기분을 설명해보세요..."
                className="flex-1 backdrop-blur-sm bg-purple-500/10 border border-purple-500/30 rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none transition-colors"
                maxLength={100}
              />
              <button
                type="submit"
                disabled={!customMood.trim()}
                className="gradient-button rounded-lg px-6 py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                시작
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          음악을 통해 감정을 표현해보세요 🎵
        </div>
      </div>
    </div>
  );
}