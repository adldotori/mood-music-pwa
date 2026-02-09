import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  let mood = '';
  
  try {
    const body = await request.json();
    mood = body.mood;
    const count = body.count || 10;
    const exclude = body.exclude || [];

    if (!mood) {
      return NextResponse.json({ error: 'Mood is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const excludeText = exclude.length > 0 
      ? `\n\nDo NOT include these songs that were already recommended: ${exclude.join(', ')}`
      : '';

    const prompt = `You are a music curator. Given a mood/feeling, recommend ${count} songs that match that vibe.

Mood: "${mood}"

Please recommend ${count} diverse, well-known songs that match this mood. Include a mix of genres, eras, and artists but all should fit the emotional tone.

Return ONLY a JSON array in this exact format:
[
  {
    "title": "Song Title",
    "artist": "Artist Name"
  },
  ...
]

Guidelines:
- Include popular songs that are easy to find on YouTube
- Mix different genres and time periods
- Make sure all songs genuinely match the mood
- Use the exact song title as it appears on music platforms
- Include both Korean and international songs when appropriate${excludeText}

Return only the JSON array, no additional text.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let songs;
    try {
      // Clean the response in case there's extra text
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      songs = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Failed to parse song recommendations');
    }

    // Validate the response format
    if (!Array.isArray(songs)) {
      throw new Error('Invalid response format');
    }

    // Ensure all songs have required fields
    const validSongs = songs.filter(song => 
      song && 
      typeof song.title === 'string' && 
      typeof song.artist === 'string' &&
      song.title.trim() &&
      song.artist.trim()
    ).slice(0, count);

    if (validSongs.length === 0) {
      throw new Error('No valid songs in response');
    }

    return NextResponse.json({ songs: validSongs });
  } catch (error) {
    console.error('Error in recommend API:', error);
    
    // Fallback songs for different moods
    const fallbackSongs = {
      '잔잔한': [
        { title: 'River', artist: 'Joni Mitchell' },
        { title: 'Mad World', artist: 'Gary Jules' },
        { title: '봄날', artist: 'BTS' },
      ],
      '신나는': [
        { title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars' },
        { title: 'Dynamite', artist: 'BTS' },
        { title: 'Can\'t Stop the Feeling!', artist: 'Justin Timberlake' },
      ],
      '우울한': [
        { title: 'Hurt', artist: 'Johnny Cash' },
        { title: 'Black', artist: 'Pearl Jam' },
        { title: '그대라는 사치', artist: '한효주' },
      ],
    };

    const fallback = fallbackSongs[mood as keyof typeof fallbackSongs] || fallbackSongs['잔잔한'];
    
    return NextResponse.json(
      { 
        songs: fallback,
        warning: 'Using fallback songs due to API error'
      }, 
      { status: 200 }
    );
  }
}