# Changelog

**MomsNest — Changelog**  
All notable changes to MomsNest are documented in this file.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Planned
- Payment gateway integration (Chapa/Telebirr)
- Multi-language support (Amharic, English)
- AI parenting assistant
- Baby milestone tracker
- iOS native app release
- Dark mode toggle

---

## [1.0.0] — 2026-03-04

### 🎉 Initial Release — MVP Complete

#### Added — Social Feed
- Post creation with text and multi-image upload
- Like, comment (threaded replies), save, share functionality
- Story creation with 24-hour auto-expiration
- Story viewer with progress bar and likes
- Post statistics tracking (likes, comments, saves, shares)
- Premium/sponsored post support with coin unlock
- Real-time feed updates via Supabase Realtime

#### Added — Community Circles
- Circle creation with categories, descriptions, privacy settings
- Circle membership (admin, member roles)
- Circle events with RSVP, registration, and virtual meeting URLs
- Circle services with bookable providers and pricing
- Circle resources with downloads tracking and ratings
- Circle subscriptions for premium access
- Tipping system for circle post authors
- Circle statistics dashboard

#### Added — Marketplace (Shop)
- Product listing with multi-image, pricing, stock, condition
- Category-based browsing and search
- Shopping cart with quantity management
- Checkout flow with shipping address management
- Order lifecycle management (pending → confirmed → shipped → delivered)
- Flash sales with time-limited pricing
- Group buys with participant thresholds
- Seller profiles with verification (business license, tax ID)
- Seller statistics and analytics
- Product reviews with star ratings and images
- Review helpfulness voting
- Buyer-seller messaging system
- Wishlist/favorites functionality
- Dispute resolution system
- Refund processing

#### Added — Ask Q&A
- Question posting with categories and tags
- Anonymous posting with generated pseudonyms
- Community answers with voting system
- AI-generated insights via Supabase Edge Function
- Expert profiles with specialty, certifications, verified status
- Question bookmarks
- Answer voting system

#### Added — Safety/SOS Module
- Emergency SOS alert creation with categorized types
- Geolocation sharing with Mapbox maps
- Nearby helper discovery with availability status
- Helper request/response workflow
- Real-time SOS messaging
- Emergency contacts notification (Edge Function)
- Abuse reporting system with categories
- Location privacy controls
- Helper profiles with ratings, badges, and streaks
- Legal disclaimer modal before first SOS use

#### Added — Live Streaming
- WebRTC-based live streaming
- Real-time chat during live streams
- Viewer count tracking
- Live stream association with circles
- Stream start notification to followers (Edge Function)

#### Added — Video Feed
- TikTok-style vertical video consumption
- HLS streaming with hls.js
- Video prebuffering and virtual scrolling for performance
- Video creation and upload

#### Added — Wallet & Coins
- Virtual coin wallet with balance tracking
- Coin top-ups and withdrawal requests
- Transaction history with type categorization
- Premium content unlocking with coins
- Tip/reward system integration across features

#### Added — Messaging
- Direct messaging between users
- Real-time message delivery via Supabase Realtime
- Conversation list with last message preview
- Read receipts

#### Added — Notifications
- Push notifications via Firebase Cloud Messaging (FCM)
- In-app notification indicators
- Per-user notification preferences
- SOS, message, like, comment, order, and follow notifications

#### Added — Profile & Authentication
- Email/password registration and login via Supabase Auth
- Session persistence (localStorage + Capacitor Preferences)
- Profile management (avatar, bio, location, website)
- Profile stats (followers, following, posts, coins)
- Following/follower system
- Privacy settings

#### Added — Search
- Global search across posts, users, questions, shop items
- Category and tag filtering

#### Added — Native App
- Android native app via Capacitor
- Haptic feedback on interactions
- Native splash screen and status bar customization
- Android back button handling
- Safe area inset management
- Push notification registration

#### Added — PWA Features
- Service worker for offline caching
- PWA manifest for add-to-home-screen
- Cache version management and auto-update prompts

#### Infrastructure
- Supabase backend (PostgreSQL, Auth, Realtime, Storage, Edge Functions)
- 48+ database tables with Row Level Security
- 69 database migrations
- 8 Edge Functions (AI insights, notifications, maps)
- Vite build system with code splitting
- Tailwind CSS design system
- shadcn/ui component library (51 base components)
- React Query caching layer
- Error boundaries for graceful error handling
- Image compression before upload

---

## Release Notes Template

### [X.Y.Z] — YYYY-MM-DD

#### Added
- New features that were added

#### Changed
- Changes to existing functionality

#### Fixed
- Bug fixes

#### Deprecated
- Features that will be removed in future versions

#### Removed
- Features that were removed

#### Security
- Security-related changes

---

## Version Numbering

| Increment | When | Example |
|-----------|------|---------|
| **Major (X)** | Breaking changes, major redesigns | 1.0.0 → 2.0.0 |
| **Minor (Y)** | New features, backward compatible | 1.0.0 → 1.1.0 |
| **Patch (Z)** | Bug fixes, minor improvements | 1.0.0 → 1.0.1 |
