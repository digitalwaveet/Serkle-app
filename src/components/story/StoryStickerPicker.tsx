import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { X, MapPin, Hash, AtSign, Link2, Smile } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface StickerItem {
  id: string;
  type: 'emoji' | 'info';
  content: string;
  infoType?: 'location' | 'hashtag' | 'mention' | 'link';
  mentionUserId?: string;
  x: number;
  y: number;
}

const EMOJI_STICKERS = [
  { emoji: '😀', tags: ['smile', 'happy', 'face'] },
  { emoji: '😂', tags: ['laugh', 'cry', 'tears', 'joy'] },
  { emoji: '🥰', tags: ['love', 'hearts', 'face'] },
  { emoji: '😍', tags: ['heart', 'eyes', 'love'] },
  { emoji: '🤩', tags: ['star', 'eyes', 'excited'] },
  { emoji: '😎', tags: ['cool', 'glasses', 'shades'] },
  { emoji: '🥳', tags: ['party', 'celebrate', 'horn'] },
  { emoji: '🤗', tags: ['hug', 'hands', 'open'] },
  { emoji: '❤️', tags: ['heart', 'love', 'red'] },
  { emoji: '🔥', tags: ['fire', 'hot', 'lit'] },
  { emoji: '✨', tags: ['sparkles', 'magic', 'stars'] },
  { emoji: '🎉', tags: ['party', 'popper', 'celebrate'] },
  { emoji: '💯', tags: ['100', 'hundred', 'perfect'] },
  { emoji: '👑', tags: ['crown', 'king', 'queen'] },
  { emoji: '🌟', tags: ['star', 'glowing', 'shine'] },
  { emoji: '💕', tags: ['hearts', 'two', 'love'] },
  { emoji: '🎵', tags: ['music', 'note'] },
  { emoji: '🎶', tags: ['music', 'notes'] },
  { emoji: '🌈', tags: ['rainbow', 'colors'] },
  { emoji: '☀️', tags: ['sun', 'sunny', 'weather'] },
  { emoji: '🌙', tags: ['moon', 'night', 'sleep'] },
  { emoji: '⭐', tags: ['star', 'yellow'] },
  { emoji: '🦋', tags: ['butterfly', 'bug', 'insect'] },
  { emoji: '🌸', tags: ['flower', 'blossom', 'pink'] },
  { emoji: '🍕', tags: ['pizza', 'food', 'slice'] },
  { emoji: '🎂', tags: ['cake', 'birthday', 'dessert'] },
  { emoji: '🧁', tags: ['cupcake', 'sweet', 'dessert'] },
  { emoji: '☕', tags: ['coffee', 'cup', 'drink'] },
  { emoji: '🍷', tags: ['wine', 'glass', 'drink'] },
  { emoji: '🥂', tags: ['cheers', 'glasses', 'toast'] },
  { emoji: '🎁', tags: ['gift', 'present', 'box'] },
  { emoji: '💎', tags: ['gem', 'diamond', 'jewel'] },
  { emoji: '🏆', tags: ['trophy', 'win', 'award'] },
  { emoji: '🎯', tags: ['target', 'bullseye', 'goal'] },
  { emoji: '🚀', tags: ['rocket', 'launch', 'space'] },
  { emoji: '💪', tags: ['muscle', 'flex', 'strong'] },
  { emoji: '👏', tags: ['clap', 'hands', 'applause'] },
  { emoji: '🙌', tags: ['hands', 'raise', 'celebrate'] },
  { emoji: '✌️', tags: ['peace', 'victory', 'two'] },
  { emoji: '🤟', tags: ['love', 'sign', 'hand'] },
  { emoji: '📸', tags: ['camera', 'photo', 'picture'] },
  { emoji: '🎬', tags: ['clapper', 'movie', 'film'] },
  { emoji: '🎨', tags: ['palette', 'art', 'paint'] },
  { emoji: '📖', tags: ['book', 'read'] },
  { emoji: '🧳', tags: ['luggage', 'travel', 'bag'] },
  { emoji: '✈️', tags: ['airplane', 'flight', 'travel'] },
  { emoji: '🏖️', tags: ['beach', 'umbrella', 'vacation'] },
  { emoji: '🏔️', tags: ['mountain', 'snow', 'nature'] },
];

interface InfoStickerInput {
  type: 'location' | 'hashtag' | 'mention' | 'link';
  placeholder: string;
  icon: React.ReactNode;
  label: string;
}

const INFO_STICKERS: InfoStickerInput[] = [
  { type: 'location', placeholder: 'Enter location...', icon: <MapPin className="size-5" />, label: 'Location' },
  { type: 'hashtag', placeholder: 'Enter hashtag...', icon: <Hash className="size-5" />, label: 'Hashtag' },
  { type: 'mention', placeholder: 'Search users...', icon: <AtSign className="size-5" />, label: 'Mention' },
  { type: 'link', placeholder: 'https://...', icon: <Link2 className="size-5" />, label: 'Link' },
];

interface UserResult {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  initials: string;
  avatar_color: string;
}

interface Props {
  onAdd: (sticker: StickerItem) => void;
  onClose: () => void;
}

const StoryStickerPicker: React.FC<Props> = ({ onAdd, onClose }) => {
  const [tab, setTab] = useState<'stickers' | 'info'>('stickers');
  const [infoInput, setInfoInput] = useState('');
  const [selectedInfoType, setSelectedInfoType] = useState<InfoStickerInput | null>(null);
  const [search, setSearch] = useState('');

  // Mention search state
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Location suggestion state
  const [locationResults, setLocationResults] = useState<string[]>([]);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Get user's location when location type is selected
  useEffect(() => {
    if (selectedInfoType?.type !== 'location') return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {} // silently fail
      );
    }
  }, [selectedInfoType?.type]);

  // Search locations using Nominatim when user types in location input
  useEffect(() => {
    if (selectedInfoType?.type !== 'location' || !infoInput.trim()) {
      setLocationResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingLocations(true);
      try {
        const params = new URLSearchParams({
          q: infoInput.trim(),
          format: 'json',
          addressdetails: '1',
          limit: '8',
        });
        if (userCoords) {
          params.set('lat', String(userCoords.lat));
          params.set('lon', String(userCoords.lon));
          params.set('bounded', '0');
        }
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { 'Accept-Language': 'en' },
        });
        const data = await res.json();
        const names = data.map((r: any) => r.display_name?.split(',').slice(0, 3).join(',').trim() || r.display_name);
        setLocationResults(names);
      } catch {
        setLocationResults([]);
      }
      setSearchingLocations(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [infoInput, selectedInfoType?.type, userCoords]);

  // Search users when mention type is selected
  useEffect(() => {
    if (selectedInfoType?.type !== 'mention' || !infoInput.trim()) {
      setUserResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingUsers(true);
      const query = infoInput.trim().replace(/^@/, '');
      const { data } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url, initials, avatar_color')
        .or(`name.ilike.%${query}%,username.ilike.%${query}%`)
        .limit(10);
      setUserResults((data as UserResult[]) || []);
      setSearchingUsers(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [infoInput, selectedInfoType?.type]);

  const handleEmojiSelect = (emoji: string) => {
    onAdd({
      id: `sticker-${Date.now()}`,
      type: 'emoji',
      content: emoji,
      x: 50,
      y: 50,
    });
  };

  const handleMentionSelect = (user: UserResult) => {
    onAdd({
      id: `info-${Date.now()}`,
      type: 'info',
      content: `@${user.username}`,
      infoType: 'mention',
      mentionUserId: user.id,
      x: 50,
      y: 30,
    });
    setInfoInput('');
    setSelectedInfoType(null);
  };

  const handleInfoAdd = () => {
    if (!selectedInfoType || !infoInput.trim()) return;
    let content = infoInput.trim();
    if (selectedInfoType.type === 'hashtag' && !content.startsWith('#')) content = `#${content}`;
    if (selectedInfoType.type === 'mention' && !content.startsWith('@')) content = `@${content}`;

    onAdd({
      id: `info-${Date.now()}`,
      type: 'info',
      content,
      infoType: selectedInfoType.type,
      x: 50,
      y: 30,
    });
    setInfoInput('');
    setSelectedInfoType(null);
  };

  return (
    <div className="absolute inset-0 z-20 bg-black/70 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <h3 className="text-white font-semibold text-lg">Stickers</h3>
        <button onClick={onClose} className="p-2 rounded-full bg-card/10 text-white">
          <X className="size-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-3 mb-3">
        <button onClick={() => { setTab('stickers'); setSelectedInfoType(null); }}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === 'stickers' ? 'bg-primary text-primary-foreground' : 'bg-card/10 text-white/70'}`}>
          <Smile className="size-4 inline mr-1" /> Emoji
        </button>
        <button onClick={() => setTab('info')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === 'info' ? 'bg-primary text-primary-foreground' : 'bg-card/10 text-white/70'}`}>
          <MapPin className="size-4 inline mr-1" /> Info
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {tab === 'stickers' && (
          <>
            <div className="mb-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stickers..."
                className="bg-card/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>
            <div className="grid grid-cols-8 gap-1">
              {(search.trim() === '' 
                ? EMOJI_STICKERS 
                : EMOJI_STICKERS.filter(s => s.tags.some(t => t.includes(search.toLowerCase())))
              ).map(({ emoji }) => (
                <button key={emoji} onClick={() => handleEmojiSelect(emoji)}
                  className="aspect-square flex items-center justify-center text-2xl rounded-lg hover:bg-card/10 active:scale-90 transition-all">
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}

        {tab === 'info' && !selectedInfoType && (
          <div className="grid grid-cols-2 gap-3">
            {INFO_STICKERS.map((info) => (
              <button key={info.type} onClick={() => setSelectedInfoType(info)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/10 hover:bg-card/20 transition-colors text-white">
                <div className="size-12 rounded-full bg-card/10 flex items-center justify-center">
                  {info.icon}
                </div>
                <span className="text-sm font-medium">{info.label}</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'info' && selectedInfoType && (
          <div className="space-y-4">
            <button onClick={() => { setSelectedInfoType(null); setInfoInput(''); setUserResults([]); setLocationResults([]); }}
              className="text-white/70 text-sm flex items-center gap-1 hover:text-white">
              ← Back
            </button>
            <div className="flex items-center gap-3 text-white">
              <div className="size-10 rounded-full bg-card/10 flex items-center justify-center">
                {selectedInfoType.icon}
              </div>
              <span className="font-medium">{selectedInfoType.label}</span>
            </div>
            <Input
              value={infoInput}
              onChange={(e) => setInfoInput(e.target.value)}
              placeholder={selectedInfoType.placeholder}
              autoFocus
              className="bg-card/10 border-white/20 text-white placeholder:text-white/40"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && selectedInfoType.type !== 'mention' && selectedInfoType.type !== 'location') handleInfoAdd();
              }}
            />

            {/* Location: show suggestions */}
            {selectedInfoType.type === 'location' && (
              <div className="space-y-1">
                {searchingLocations && (
                  <div className="flex items-center justify-center py-4">
                    <SerkleLoader size="xs" className="text-white/60" />
                  </div>
                )}
                {!searchingLocations && locationResults.length === 0 && infoInput.trim() && (
                  <p className="text-white/50 text-sm text-center py-3">No locations found</p>
                )}
                {locationResults.map((loc, idx) => (
                  <button key={idx} onClick={() => {
                    onAdd({
                      id: `info-${Date.now()}`,
                      type: 'info',
                      content: loc,
                      infoType: 'location',
                      x: 50,
                      y: 30,
                    });
                    setInfoInput('');
                    setSelectedInfoType(null);
                    setLocationResults([]);
                  }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-card/5 hover:bg-card/15 transition-colors text-white text-left">
                    <div className="size-9 rounded-full bg-card/10 flex items-center justify-center shrink-0">
                      <MapPin className="size-4" />
                    </div>
                    <p className="text-sm truncate">{loc}</p>
                  </button>
                ))}
                {/* Manual add button as fallback */}
                {infoInput.trim() && (
                  <button onClick={handleInfoAdd}
                    className="w-full py-2 rounded-xl bg-card/10 text-white/70 text-sm font-medium hover:bg-card/20 transition-colors mt-2">
                    Use "{infoInput.trim()}" as-is
                  </button>
                )}
              </div>
            )}

            {/* Mention: show user search results */}
            {selectedInfoType.type === 'mention' && (
              <div className="space-y-1">
                {searchingUsers && (
                  <div className="flex items-center justify-center py-4">
                    <SerkleLoader size="xs" className="text-white/60" />
                  </div>
                )}
                {!searchingUsers && userResults.length === 0 && infoInput.trim() && (
                  <p className="text-white/50 text-sm text-center py-3">No users found</p>
                )}
                {userResults.map((u) => (
                  <button key={u.id} onClick={() => handleMentionSelect(u)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-card/5 hover:bg-card/15 transition-colors text-white text-left">
                    <Avatar className="size-9">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="text-xs text-white" style={{ backgroundColor: u.avatar_color }}>
                        {u.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-xs text-white/50 truncate">@{u.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Non-mention, non-location: show add button */}
            {selectedInfoType.type !== 'mention' && selectedInfoType.type !== 'location' && (
              <button onClick={handleInfoAdd} disabled={!infoInput.trim()}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-40 transition-opacity">
                Add Sticker
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryStickerPicker;
