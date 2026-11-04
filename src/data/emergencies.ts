export interface Emergency {
  id: string;
  type: 'medical' | 'safety' | 'fire' | 'accident' | 'natural' | 'other';
  status: 'active' | 'responding' | 'resolved';
  description: string;
  requester: {
    id: string;
    name: string;
    avatar: string;
  };
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  timeAgo: string;
  distance: string;
  helpers: number;
  messages: number;
  priority: 'low' | 'medium' | 'high';
  estimatedResponseTime?: string;
}

export const mockEmergencies: Emergency[] = [
  {
    id: 'emergency_1',
    type: 'medical',
    status: 'active',
    description: 'Person collapsed at park, appears unconscious. Need immediate medical assistance.',
    requester: {
      id: 'user_1',
      name: 'Sarah Johnson',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b17c?w=100&h=100&fit=crop&crop=face',
    },
    location: {
      latitude: 37.7749,
      longitude: -122.4194,
      address: 'Golden Gate Park, San Francisco',
    },
    timeAgo: '3 min ago',
    distance: '0.3 miles',
    helpers: 2,
    messages: 5,
    priority: 'high',
    estimatedResponseTime: '2-5 min',
  },
  {
    id: 'emergency_2',
    type: 'accident',
    status: 'responding',
    description: 'Car accident at intersection, minor injuries. Traffic blocked.',
    requester: {
      id: 'user_2',
      name: 'Mike Chen',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    },
    location: {
      latitude: 37.7849,
      longitude: -122.4094,
      address: 'Market St & 4th St, San Francisco',
    },
    timeAgo: '8 min ago',
    distance: '0.7 miles',
    helpers: 4,
    messages: 12,
    priority: 'medium',
    estimatedResponseTime: '5-10 min',
  },
  {
    id: 'emergency_3',
    type: 'safety',
    status: 'active',
    description: 'Feel unsafe walking alone, suspicious person following me.',
    requester: {
      id: 'user_3',
      name: 'Emma Davis',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    },
    location: {
      latitude: 37.7649,
      longitude: -122.4294,
      address: 'Mission District, San Francisco',
    },
    timeAgo: '12 min ago',
    distance: '1.2 miles',
    helpers: 1,
    messages: 3,
    priority: 'high',
    estimatedResponseTime: '3-7 min',
  },
  {
    id: 'emergency_4',
    type: 'fire',
    status: 'resolved',
    description: 'Small kitchen fire in apartment building, need evacuation assistance.',
    requester: {
      id: 'user_4',
      name: 'Robert Wilson',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop&crop=face',
    },
    location: {
      latitude: 37.7549,
      longitude: -122.4394,
      address: 'Castro District, San Francisco',
    },
    timeAgo: '1 hour ago',
    distance: '2.1 miles',
    helpers: 6,
    messages: 18,
    priority: 'high',
  },
  {
    id: 'emergency_5',
    type: 'other',
    status: 'active',
    description: 'Elderly person fell and can\'t get up, needs assistance but not critical.',
    requester: {
      id: 'user_5',
      name: 'Lisa Thompson',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    },
    location: {
      latitude: 37.7949,
      longitude: -122.3994,
      address: 'SOMA, San Francisco',
    },
    timeAgo: '15 min ago',
    distance: '0.9 miles',
    helpers: 1,
    messages: 2,
    priority: 'medium',
    estimatedResponseTime: '10-15 min',
  },
];