import { NextRequest, NextResponse } from 'next/server';
import YouTube from 'youtube-sr';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Search for videos on YouTube
    const searchResults = await YouTube.search(query, {
      limit: 1,
      type: 'video',
    });

    if (!searchResults || searchResults.length === 0) {
      return NextResponse.json(
        { error: 'No results found' },
        { status: 404 }
      );
    }

    const video = searchResults[0];

    // Extract video information
    const result = {
      videoId: video.id,
      title: video.title,
      thumbnail: video.thumbnail?.url || '',
      duration: video.duration,
      channel: video.channel?.name || '',
      views: video.views,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error searching YouTube:', error);
    
    return NextResponse.json(
      { error: 'Failed to search YouTube' },
      { status: 500 }
    );
  }
}