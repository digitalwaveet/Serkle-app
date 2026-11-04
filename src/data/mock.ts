// Mock data for posts, videos, and stories

export interface Post {
  id: string | number;
  user: { 
    id?: string;
    name: string; 
    initials: string; 
    avatarColor: string; 
    verified?: boolean;
    avatar?: string;
  };
  time: string;
  content: string;
  media?: { 
    kind: "image"; 
    alt?: string; 
    colorFrom?: string; 
    colorTo?: string; 
    url?: string;
    urls?: string[];
  };
  tags?: string[];
  stats: { likes: number; comments: number; shares: number };
  sponsored?: boolean;
  userHasLiked?: boolean;
  userReaction?: string;
  userHasUnlocked?: boolean;
  circleId?: string;
  circleName?: string;
  circleAvatar?: string;
  isPremium?: boolean;
  voiceUrl?: string;
  locationText?: string;
  totalMediaCount?: number;
  thumbnailUrl?: string;
  post_type?: 'photo' | 'video' | 'pdf' | 'text';
  original_pdf_url?: string | null;
  /** 'public' (default) or 'friends' — friends-only posts are limited to the author's connections. */
  visibility?: string;
  /** False when the current viewer is outside a friends-only post's audience (no comment/interact). */
  viewerCanInteract?: boolean;
}

export interface Comment {
  id: number;
  user: {
    name: string;
    initials: string;
    avatarColor: string;
  };
  content: string;
  time: string;
  likes: number;
}

export interface Video {
  id: number;
  user: {
    id?: string;
    name: string;
    initials: string;
    avatarColor: string;
    verified?: boolean;
    avatar?: string;
  };
  url: string;
  thumbnail: string;
  title: string;
  description: string;
  stats: { likes: number; comments: number; shares: number; saves: number };
  tags: string[];
}

export type { Story, StoryStickerData } from '@/types/storyTypes';

export const MOCK_POSTS: Post[] = [
  {
    id: 1,
    user: { name: "Sara Yonas", initials: "SY", avatarColor: "#E08ED1", verified: true },
    time: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    content: "First time back to yoga since baby 🧘‍♀️ Any gentle routines you recommend? I'm looking for something that won't be too intense but will help me get back into the groove. Has anyone tried prenatal yoga modifications for postpartum recovery?",
    media: {
      kind: "image",
      alt: "Yoga mat on floor",
      url: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=60",
      colorFrom: "#FEDAF7",
      colorTo: "#E08ED1",
    },
    tags: ["wellness", "postpartum"],
    stats: { likes: 48, comments: 12, shares: 3 },
  },
  {
    id: 2,
    user: { name: "Lily Getachew", initials: "LG", avatarColor: "#4B164C" },
    time: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    content: "Meal-prep hack: roast sweet potatoes, chickpeas, and broccoli together. 20 mins, 3 lunches! Perfect for busy mom life.",
    media: {
      kind: "image",
      alt: "Meal prep bowls",
      url: "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=1200&q=60",
      colorFrom: "#F4F4F6",
      colorTo: "#E5E6EB",
    },
    tags: ["food", "time-saver"],
    stats: { likes: 96, comments: 21, shares: 11 },
  },
  {
    id: 3,
    user: { name: "Mahi Tesfaye", initials: "MT", avatarColor: "#9EA3AE" },
    time: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    content: "Night feeds are tough. What helped you keep a routine without losing your mind? I'm struggling with the 3am wake-ups and could really use some solidarity and practical tips from other moms who've been there.",
    tags: ["sleep", "newborn"],
    stats: { likes: 30, comments: 44, shares: 2 },
  },
  {
    id: 4,
    user: { name: "Hana Berhane", initials: "HB", avatarColor: "#4B164C" },
    time: new Date(Date.now() - 1000 * 60 * 13).toISOString(),
    content: "Flash giveaway! Baby carrier from our shop partners. Comment your favorite lullaby 💜",
    media: {
      kind: "image",
      alt: "Baby carrier gift",
      url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=60",
      colorFrom: "#E08ED1",
      colorTo: "#4B164C",
    },
    tags: ["giveaway", "shop"],
    stats: { likes: 12, comments: 57, shares: 9 },
    sponsored: true,
  },
  {
    id: 5,
    user: { name: "Zara Ahmed", initials: "ZA", avatarColor: "#22C3A6", verified: true },
    time: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    content: "Just discovered this amazing playground with shade structures! Finally found a place where we can play even when it's sunny. Location is in my bio for anyone interested. It has toddler swings, climbing structures for different ages, and plenty of parking.",
    media: {
      kind: "image",
      alt: "Playground with shade",
      url: "https://images.unsplash.com/photo-1560114928-40f1f1eb26a0?auto=format&fit=crop&w=1200&q=60",
      colorFrom: "#E6F7FF",
      colorTo: "#22C3A6",
    },
    tags: ["playground", "outdoors"],
    stats: { likes: 67, comments: 18, shares: 24 },
  },
  {
    id: 6,
    user: { name: "Nina Patel", initials: "NP", avatarColor: "#B794F6" },
    time: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    content: "Naptime reading recommendations? Looking for something light but engaging. I have about 30 minutes when little one goes down and want to make the most of it. Fiction preferred!",
    tags: ["books", "self-care"],
    stats: { likes: 23, comments: 31, shares: 5 },
  },
  {
    id: 7,
    user: { name: "Amara Okafor", initials: "AO", avatarColor: "#ED8936" },
    time: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    content: "Toddler tantrum in Target today reminded me that we're all just doing our best. To the mom who smiled at me instead of judging - thank you. Sometimes a kind look is all we need to keep going.",
    tags: ["solidarity", "parenting"],
    stats: { likes: 142, comments: 38, shares: 19 },
  },
  {
    id: 8,
    user: { name: "Aya Hassan", initials: "AH", avatarColor: "#F093FB" },
    time: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    content: "Sunday batch cooking session complete! Made enough freezer meals for two weeks. Feeling prepared and proud. Here's my go-to list of freezer-friendly recipes that have saved my sanity multiple times.",
    media: {
      kind: "image",
      alt: "Freezer meal prep containers",
      url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=60",
      colorFrom: "#FFF5F5",
      colorTo: "#F093FB",
    },
    tags: ["meal-prep", "organization"],
    stats: { likes: 89, comments: 26, shares: 33 },
  },
];

export const MOCK_COMMENTS: { [postId: number]: Comment[] } = {
  1: [
    {
      id: 1,
      user: { name: "Maya Chen", initials: "MC", avatarColor: "#4B164C" },
      content: "Gentle flow videos on YouTube saved me! Try Yoga with Adriene's postpartum series.",
      time: "2h",
      likes: 8,
    },
    {
      id: 2,
      user: { name: "Sophie M", initials: "SM", avatarColor: "#E08ED1" },
      content: "Start with 10-minute sessions. Your body needs time to adjust. Be patient with yourself! 💕",
      time: "1h",
      likes: 12,
    },
    {
      id: 3,
      user: { name: "Priya Kumar", initials: "PK", avatarColor: "#22C3A6" },
      content: "Child's pose is your friend. I stayed there half the class when I started back 😅",
      time: "45m",
      likes: 6,
    },
    {
      id: 4,
      user: { name: "Elena Rodriguez", initials: "ER", avatarColor: "#B794F6" },
      content: "Make sure to modify core work! My PT gave me specific exercises to rebuild safely.",
      time: "30m",
      likes: 15,
    },
    {
      id: 5,
      user: { name: "Fatima Al-Zahra", initials: "FZ", avatarColor: "#ED8936" },
      content: "I love prenatal modifications even postpartum. They're gentle but effective.",
      time: "15m",
      likes: 4,
    },
  ],
  2: [
    {
      id: 6,
      user: { name: "Jessica Kim", initials: "JK", avatarColor: "#F093FB" },
      content: "This sounds amazing! What temperature and how long for roasting?",
      time: "5h",
      likes: 5,
    },
    {
      id: 7,
      user: { name: "Aisha Okonkwo", initials: "AO", avatarColor: "#4B164C" },
      content: "Adding quinoa makes this even more filling! Great tip 👏",
      time: "4h",
      likes: 7,
    },
    {
      id: 8,
      user: { name: "Rachel Green", initials: "RG", avatarColor: "#22C3A6" },
      content: "400°F for 20 mins works perfectly. I toss everything in olive oil and seasoning first.",
      time: "3h",
      likes: 9,
    },
  ],
  3: [
    {
      id: 9,
      user: { name: "Sarah Johnson", initials: "SJ", avatarColor: "#E08ED1" },
      content: "The nights are SO hard. Coffee and accepting help during the day saved me.",
      time: "1d",
      likes: 18,
    },
    {
      id: 10,
      user: { name: "Lisa Wang", initials: "LW", avatarColor: "#B794F6" },
      content: "Sleep when baby sleeps is terrible advice, but shifts with partner helped!",
      time: "20h",
      likes: 22,
    },
  ],
};

export const MOCK_VIDEOS: Video[] = [
  {
    id: 1,
    user: { name: "Sarah Chen", initials: "SC", avatarColor: "#E08ED1", verified: true },
    url: "https://littletigersholdinggroup.com/video/1.mp4",
    thumbnail: "",
    title: "Morning mom routine ✨",
    description: "POV: You're a mom who actually has her life together 😅 Quick 5-min routine that saves my sanity! #momlife #morningroutine #selfcare #busymom #momhacks",
    stats: { likes: 1247, comments: 89, shares: 156, saves: 234 },
    tags: ["morning", "routine", "self-care", "momlife", "momhacks"],
  },
  {
    id: 2,
    user: { name: "Maya Rodriguez", initials: "MR", avatarColor: "#4B164C" },
    url: "https://littletigersholdinggroup.com/video/2.mp4",
    thumbnail: "",
    title: "Toddler tantrum survival 🙃",
    description: "When your toddler has a meltdown in Target and you're just trying to survive 😭 Real strategies that actually work! #toddlerlife #parenting #momstruggles #tantrums #parentingtips",
    stats: { likes: 892, comments: 156, shares: 203, saves: 445 },
    tags: ["parenting", "toddler", "tips", "tantrums", "momstruggles"],
  },
  {
    id: 3,
    user: { name: "Zara Ali", initials: "ZA", avatarColor: "#22C3A6", verified: true },
    url: "https://littletigersholdinggroup.com/video/3.mp4",
    thumbnail: "",
    title: "Meal prep queen 👑",
    description: "15 minutes to prep breakfast for the ENTIRE week! ✨ No more morning chaos, coffee stays hot ☕ #mealprep #breakfast #momhacks #timesaver #busymomlife",
    stats: { likes: 2156, comments: 234, shares: 389, saves: 567 },
    tags: ["meal-prep", "breakfast", "time-saving", "momhacks", "busymomlife"],
  },
  {
    id: 4,
    user: { name: "Nina Park", initials: "NP", avatarColor: "#B794F6" },
    url: "https://littletigersholdinggroup.com/video/4.mp4",
    thumbnail: "",
    title: "Postpartum yoga flow 🧘‍♀️",
    description: "Gentle yoga for new mamas 💕 Your body has been through so much - be kind to yourself! Safe movements only ✨ #postpartumyoga #newmom #wellness #selfcare #gentleyoga",
    stats: { likes: 734, comments: 67, shares: 89, saves: 312 },
    tags: ["yoga", "postpartum", "wellness", "newmom", "selfcare"],
  },
  {
    id: 5,
    user: { name: "Ava Thompson", initials: "AT", avatarColor: "#ED8936" },
    url: "https://littletigersholdinggroup.com/video/5.mp4",
    thumbnail: "",
    title: "Baby sleep secrets 😴",
    description: "Sleep consultant spills the tea ☕ Evidence-based tips that actually work! Your baby (and you) deserve good sleep 💤 #babysleep #sleepconsultant #parentingtips #newmom #sleeptraining",
    stats: { likes: 1567, comments: 289, shares: 445, saves: 789 },
    tags: ["sleep", "baby", "tips", "sleepconsultant", "newmom"],
  },
];

export const MOCK_STORIES: Story[] = [
  {
    id: 0,
    user: { name: "Your story", initials: "+", avatarColor: "#E6E8EB" },
    image: "",
    isOwn: true,
  },
  // Emma's stories
  {
    id: 1,
    user: { name: "Emma", initials: "EM", avatarColor: "#E08ED1", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma" },
    image: "https://picsum.photos/400/700?random=1",
  },
  {
    id: 2,
    user: { name: "Emma", initials: "EM", avatarColor: "#E08ED1", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma" },
    image: "https://picsum.photos/400/700?random=11",
  },
  {
    id: 3,
    user: { name: "Emma", initials: "EM", avatarColor: "#E08ED1", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma" },
    image: "https://picsum.photos/400/700?random=21",
  },
  // Sofia's stories
  {
    id: 4,
    user: { name: "Sofia", initials: "SF", avatarColor: "#4B164C", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sofia" },
    image: "https://picsum.photos/400/700?random=2",
  },
  {
    id: 5,
    user: { name: "Sofia", initials: "SF", avatarColor: "#4B164C", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sofia" },
    image: "https://picsum.photos/400/700?random=12",
  },
  // Aria's stories
  {
    id: 6,
    user: { name: "Aria", initials: "AR", avatarColor: "#22C3A6", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aria" },
    image: "https://picsum.photos/400/700?random=3",
  },
  {
    id: 7,
    user: { name: "Aria", initials: "AR", avatarColor: "#22C3A6", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aria" },
    image: "https://picsum.photos/400/700?random=13",
  },
  {
    id: 8,
    user: { name: "Aria", initials: "AR", avatarColor: "#22C3A6", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aria" },
    image: "https://picsum.photos/400/700?random=23",
  },
  {
    id: 9,
    user: { name: "Aria", initials: "AR", avatarColor: "#22C3A6", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aria" },
    image: "https://picsum.photos/400/700?random=33",
  },
  // Luna's story
  {
    id: 10,
    user: { name: "Luna", initials: "LU", avatarColor: "#B794F6", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna" },
    image: "https://picsum.photos/400/700?random=4",
  },
  // Maya's stories
  {
    id: 11,
    user: { name: "Maya", initials: "MY", avatarColor: "#F093FB", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maya" },
    image: "https://picsum.photos/400/700?random=5",
  },
  {
    id: 12,
    user: { name: "Maya", initials: "MY", avatarColor: "#F093FB", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maya" },
    image: "https://picsum.photos/400/700?random=15",
  },
  // Zoe's stories
  {
    id: 13,
    user: { name: "Zoe", initials: "ZO", avatarColor: "#ED8936", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe" },
    image: "https://picsum.photos/400/700?random=6",
  },
  {
    id: 14,
    user: { name: "Zoe", initials: "ZO", avatarColor: "#ED8936", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe" },
    image: "https://picsum.photos/400/700?random=16",
  },
  {
    id: 15,
    user: { name: "Zoe", initials: "ZO", avatarColor: "#ED8936", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe" },
    image: "https://picsum.photos/400/700?random=26",
  },
  // Isla's story
  {
    id: 16,
    user: { name: "Isla", initials: "IS", avatarColor: "#4B164C", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Isla" },
    image: "https://picsum.photos/400/700?random=7",
  },
  // Nova's stories
  {
    id: 17,
    user: { name: "Nova", initials: "NV", avatarColor: "#E08ED1", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nova" },
    image: "https://picsum.photos/400/700?random=8",
  },
  {
    id: 18,
    user: { name: "Nova", initials: "NV", avatarColor: "#E08ED1", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nova" },
    image: "https://picsum.photos/400/700?random=18",
  },
];