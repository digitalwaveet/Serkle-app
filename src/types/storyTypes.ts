export interface StoryUser {
  id?: string;
  name: string;
  initials: string;
  avatarColor: string;
  avatar?: string;
  username?: string;
  verified?: boolean;
}

export interface StoryFilter {
  id: string;
  name: string;
  css: string;
  canvasFilter?: string;
}

export interface DrawingPath {
  id: string;
  points: number[][]; // [x, y, pressure] points relative to 1080x1920
  color: string;
  size: number;
}

export interface StoryElement {
  id: string;
  type: 'text' | 'emoji' | 'info' | 'image' | 'video';
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  scale: number;
  rotation: number;
  zIndex: number;
  
  // Type-specific properties
  content?: string; // Text content, emoji character, or URL
  file?: File | Blob; // Raw file for uploading image stickers
  
  // For text
  fontSize?: number; // Base 1920 scale
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  bgColor?: string;
  
  // For info stickers
  infoType?: 'location' | 'hashtag' | 'mention' | 'link';
  mentionUserId?: string;
  
  // For media
  filterCss?: string; // Story filter + drop shadow
}

export interface StoryBackground {
  type: 'color' | 'gradient' | 'image' | 'video';
  value: string; // Hex color, gradient string, or media URL
  mediaWidth?: number;
  mediaHeight?: number;
  filterCss?: string; // Story filter for background
  objectFit?: 'cover' | 'contain'; // 'contain' = no crop + blurred bg, 'cover' = fill & crop
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
}

export interface StoryState {
  background: StoryBackground;
  elements: StoryElement[];
  drawingPaths: DrawingPath[];
}

export interface Story {
  id: number | string;
  user: StoryUser;
  image: string; // The flattened background/media (legacy fallback, or current bg)
  mediaType?: 'image' | 'video';
  
  // NEW: Unified state for the DOM-based renderer
  story_state?: StoryState;
  
  // Legacy fields (kept for backward compatibility with old drafts/stories)
  overlayUrl?: string;
  videoTransform?: { x: number; y: number; scale: number; rotation: number; canvasW: number; canvasH: number; };
  backgroundGradient?: { from: string; to: string; };
  stickerData?: any[]; // Legacy sticker array
  
  isOwn?: boolean;
  isViewed?: boolean;
  isLive?: boolean;
  liveStreamId?: string;
  allStories?: Story[];
  resharedPostId?: string;
  createdAt?: string;
  originalIndex?: number;
}

export interface StoryMention {
  user_id: string;
  username: string;
  name: string;
}

export interface StoryMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  profile?: {
    name: string;
    initials: string;
    avatar_color: string;
    avatar_url: string | null;
  };
}

export interface EditorExtraData {
  publicationId?: string;
  originalVideoUrl?: string;
  reshared_post_id?: string;
  reshared_story_id?: string;
  overlayBlob?: Blob;
  stickerData?: StoryStickerData[];
  mediaType: 'image' | 'video';
  story_state?: StoryState; // New field for saving state
  
  // Legacy fields
  overlayUrl?: string;
  videoTransform?: { x: number; y: number; scale: number; rotation: number; canvasW: number; canvasH: number; };
  backgroundGradient?: { from: string; to: string; };
}

export interface StoryStickerData {
  type: string;
  content: string;
  infoType?: 'location' | 'hashtag' | 'mention' | 'link';
  mentionUserId?: string;
  x: number;
  y: number;
}

export type PauseReason = 'hold' | 'menu' | 'input' | 'activity' | 'visibility' | 'link-overlay' | 'profile' | 'emoji-picker' | 'manual' | 'report' | 'confirm';
