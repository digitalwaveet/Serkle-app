/**
 * Anonymous Identity System for Serkle
 * 
 * Generates unique, friendly pseudonyms at the QUESTION/STORY THREAD level.
 * The same user will receive different pseudonyms for different questions,
 * but the pseudonym stays consistent within a single question thread
 * (original question, author replies, thread story updates).
 * 
 * PRIVACY: The database still links content to the authenticated user_id
 * for ownership/moderation, but the public UI never exposes real identity.
 */

// Word pools for pseudonym generation
const ADJECTIVES = [
  'Quiet', 'Brave', 'Gentle', 'Hopeful', 'Warm', 'Calm', 'Kind',
  'Bold', 'Bright', 'Soft', 'Wise', 'Swift', 'Tender', 'Shy',
  'Wild', 'Pure', 'Cool', 'Deep', 'Free', 'True', 'Blue',
  'Golden', 'Silver', 'Hidden', 'Honest', 'Caring', 'Joyful',
  'Patient', 'Mindful', 'Humble', 'Radiant', 'Serene', 'Vivid',
  'Cozy', 'Dreamy', 'Lively', 'Mellow', 'Steady', 'Lucky',
];

const NOUNS = [
  'Moon', 'River', 'Tiger', 'Star', 'Cloud', 'Leaf', 'Bird',
  'Rose', 'Lion', 'Fox', 'Oak', 'Rain', 'Sky', 'Wave',
  'Pearl', 'Spark', 'Flame', 'Bloom', 'Dove', 'Breeze',
  'Sage', 'Cedar', 'Iris', 'Lark', 'Fern', 'Dawn', 'Snow',
  'Pine', 'Coral', 'Maple', 'Nest', 'Petal', 'Haven', 'Stone',
  'Light', 'Gem', 'Heart', 'Path', 'Parent', 'Soul',
];

// Color palette for anonymous avatars — uses Serkle-compatible warm/earth tones
const AVATAR_COLORS = [
  '#4B164C', // Serkle primary dark purple
  '#6B3A6B', // Muted plum
  '#8B5E3C', // Warm brown
  '#5D7B6F', // Sage green
  '#4A6B8A', // Steel blue
  '#7B6B8A', // Dusty lavender
  '#8A6B5D', // Terracotta
  '#5B7B5D', // Forest green
  '#6B5B8A', // Deep violet
  '#8A7B5D', // Olive gold
  '#5D6B7B', // Slate
  '#7B5D6B', // Mauve
  '#5D8A7B', // Teal
  '#8A5D6B', // Berry
  '#6B8A5D', // Moss
  '#7B6B5D', // Copper
];

// Shape patterns for avatar variety
const SHAPES = ['circle', 'diamond', 'hexagon', 'rounded-square'] as const;
export type AvatarShape = typeof SHAPES[number];

/**
 * Simple deterministic hash from a string.
 * Used to pick consistent pseudonym components from the word pools.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a per-question pseudonym.
 * 
 * @param userId - The authenticated user's ID (never exposed publicly)
 * @param questionId - The question/thread ID (scope of anonymity)
 * @returns A friendly pseudonym like "QuietMoon42"
 */
export function generatePseudonym(userId: string, questionId: string): string {
  // Combine userId + questionId to create a unique-per-thread seed
  const seed = hashString(`${userId}::${questionId}`);
  
  const adjIndex = seed % ADJECTIVES.length;
  const nounIndex = Math.floor(seed / ADJECTIVES.length) % NOUNS.length;
  const number = (seed % 99) + 1; // 1-99
  
  return `${ADJECTIVES[adjIndex]}${NOUNS[nounIndex]}${number}`;
}

/**
 * Generate a pseudonym without a userId (for unauthenticated users).
 * Uses random generation since there's no user to tie it to.
 */
export function generateRandomPseudonym(): string {
  const adjIndex = Math.floor(Math.random() * ADJECTIVES.length);
  const nounIndex = Math.floor(Math.random() * NOUNS.length);
  const number = Math.floor(Math.random() * 99) + 1;
  
  return `${ADJECTIVES[adjIndex]}${NOUNS[nounIndex]}${number}`;
}

/**
 * Get a deterministic avatar color from a pseudonym.
 * Consistent for the same pseudonym string.
 */
export function getAvatarColor(pseudonym: string): string {
  const hash = hashString(pseudonym);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * Get a deterministic avatar shape from a pseudonym.
 */
export function getAvatarShape(pseudonym: string): AvatarShape {
  const hash = hashString(pseudonym + '_shape');
  return SHAPES[hash % SHAPES.length];
}

/**
 * Get the initials to display in the anonymous avatar.
 * Takes the first letter of each word in the pseudonym.
 * e.g. "QuietMoon42" → "QM"
 */
export function getAvatarInitials(pseudonym: string): string {
  // Split on capital letters to get word boundaries
  const words = pseudonym.replace(/[0-9]/g, '').match(/[A-Z][a-z]*/g);
  if (!words || words.length === 0) return '?';
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/**
 * Complete anonymous identity object for UI rendering.
 */
export interface AnonymousIdentity {
  pseudonym: string;
  color: string;
  shape: AvatarShape;
  initials: string;
}

/**
 * Get the full anonymous identity for display.
 * Use this in UI components for consistent rendering.
 */
export function getAnonymousIdentity(pseudonym: string): AnonymousIdentity {
  return {
    pseudonym,
    color: getAvatarColor(pseudonym),
    shape: getAvatarShape(pseudonym),
    initials: getAvatarInitials(pseudonym),
  };
}
