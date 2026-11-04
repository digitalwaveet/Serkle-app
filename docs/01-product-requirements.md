# 📘 MomsNest — Product Requirement Document (PRD)

**Version:** 1.0  
**Date:** March 4, 2026  
**Product:** MomsNest  
**App ID:** `com.momsnest.app`  
**Status:** Active Development  

---

## 1. Product Overview

MomsNest is a **comprehensive mobile-first social platform** designed exclusively for mothers. It combines social networking, community support, e-commerce, emergency safety tools, live streaming, and expert Q&A — all within a single unified application.

The platform is built as a Progressive Web App (PWA) with native Android/iOS wrappers via Capacitor, ensuring cross-platform reach with a native-app experience.

**Tagline:** *"Connect, Share, Support"*

---

## 2. Problem Statement

Mothers face fragmented digital experiences when seeking:

- **Community Support:** Parenting advice is scattered across generic social media platforms that are not designed for sensitive, mom-specific topics.
- **Safety Concerns:** No mainstream app provides real-time SOS alerts, nearby helper networks, and emergency contact notification — specifically tailored for mothers.
- **Trusted Marketplace:** Buying/selling mom & baby products requires trust verification, which general marketplaces (eBay, Facebook Marketplace) do not provide in a community context.
- **Expert Guidance:** Access to pediatricians, lactation consultants, child psychologists, etc., is typically expensive and disconnected from community context.
- **Anonymous Discussion:** Mothers need safe spaces to discuss sensitive topics (postpartum depression, relationship issues) without social stigma.

---

## 3. Target Users / Personas

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| **New Mom (Amira, 28)** | First-time mother, 0–12 months postpartum | Advice, emotional support, product recommendations |
| **Experienced Mom (Sara, 35)** | Mother of 2–3 children, active community contributor | Share knowledge, sell outgrown items, mentor others |
| **Expert Mom (Dr. Hana, 42)** | Pediatrician / lactation consultant | Provide verified advice, build professional presence |
| **Community Leader (Lina, 31)** | Runs a local mothers' group | Organize events, manage Circle, share resources |
| **Safety-Conscious Mom (Meron, 29)** | Lives in area with safety concerns | SOS alerts, emergency contacts, location sharing |

---

## 4. User Journey

### First-Time User Flow
```
Signup → Profile Setup → Feed (Home) → Explore Circles → Join Circle → Browse Shop → Enable Notifications
```

### Daily Active User Flow
```
Open App → View Stories → Scroll Feed → Like/Comment → Check Notifications → Browse Ask Q&A → Quick Shop → Messages
```

### Emergency User Flow
```
Open App → Navigate to Safe → Create SOS Alert → Select Category → Share Location → Notify Helpers/Contacts → Real-time Chat → Resolve
```

---

## 5. Features List

### MVP (Phase 1) — ✅ Implemented

| Module | Features |
|--------|----------|
| **Auth** | Email/password signup & login, session persistence, profile auto-creation |
| **Social Feed** | Posts (text + multi-image), likes, comments (threaded), saves, shares |
| **Stories** | 24-hour ephemeral stories, story viewer with progress bar, story likes |
| **Circles** | Community groups with posts, events, services, resources, subscriptions |
| **Shop** | Product listings, cart, checkout, order management, seller verification |
| **Ask Q&A** | Questions, answers, AI-generated insights, expert profiles, anonymous posting |
| **Safety/SOS** | Emergency alerts, helper network, geolocation, SOS messaging, abuse reports |
| **Messages** | Direct messaging, conversations, typing indicators, read receipts |
| **Video Feed** | TikTok-style vertical video feed, video creation, HLS streaming |
| **Live Streaming** | WebRTC-based live streaming with chat, viewer count |
| **Wallet/Coins** | Virtual currency, top-ups, withdrawals, coin transactions |
| **Profile** | Full user profiles, stats, followers/following, privacy settings |
| **Notifications** | Push notifications (FCM), in-app notifications, preferences |
| **Search** | Global search across posts, users, questions, shop items |

### Phase 2 — Planned

| Feature | Description |
|---------|-------------|
| **AI Parenting Assistant** | Contextual AI advice powered by child age and parenting stage |
| **Milestone Tracker** | Baby development milestones with photo timeline |
| **Circle Monetization** | Premium circles with subscription tiers |
| **Payment Gateway** | Chapa / Telebirr / Stripe integration for real transactions |
| **Push to iOS** | iOS native push notification support |
| **Multi-language** | Amharic, English, French support |
| **Dark Mode** | Full dark theme (infrastructure exists via `ThemeContext`) |
| **Analytics Dashboard** | User engagement metrics for circle and shop owners |
| **Referral System** | Invite-a-friend with coin rewards |
| **Scheduled Posts** | Queue posts for future publishing |

---

## 6. Functional Requirements

### 6.1 Authentication
- Email + password registration and login via Supabase Auth
- Session persistence using `@capacitor/preferences` (native) or `localStorage` (web)
- Auto token refresh with graceful failure handling
- Profile auto-creation on first sign-up

### 6.2 Social Feed
- Create posts with text content and multiple image uploads
- Like, comment (with threaded replies), save, and share posts
- Real-time updates via Supabase Realtime subscriptions
- Premium/sponsored post support with coin unlock mechanism
- Post statistics tracking (likes, comments, saves, shares)

### 6.3 Community Circles
- Create and manage community groups with categories
- Circle events (virtual/in-person) with RSVP and payment
- Circle services (bookable with providers)
- Resource library with downloads tracking
- Membership roles (admin, member), subscription tiers
- Tipping system for circle post authors

### 6.4 Marketplace (Shop)
- List products with multi-image, pricing, stock, condition
- Shopping cart with quantity management
- Checkout flow with shipping address management
- Order lifecycle (pending → confirmed → shipped → delivered)
- Flash sales with time-limited pricing
- Group buys with participant thresholds
- Seller profiles with verification (business license, tax ID)
- Dispute resolution system with refunds
- Buyer-seller messaging
- Product reviews with images and helpfulness voting
- Wishlist/favorites

### 6.5 Ask Q&A
- Post questions with categories and tags
- Anonymous posting with generated pseudonyms
- Community answers with voting
- Expert profiles with certifications
- AI-generated insights via Supabase Edge Function
- Question bookmarks for saving

### 6.6 Safety/SOS Module
- Emergency SOS alert creation with categories
- Geolocation tracking with Mapbox maps
- Nearby helper discovery with availability status
- Helper request/response workflow
- Real-time SOS messaging
- Emergency contacts notification
- Abuse reporting system
- Location privacy controls
- Helper profiles with ratings, badges, and streaks

### 6.7 Wallet & Coins
- Virtual coin wallet with balance tracking
- Coin top-ups and withdrawals
- Transaction history with type categorization
- Premium content unlocking with coins
- Tips and rewards system

---

## 7. Non-Functional Requirements

| Requirement | Target |
|------------|--------|
| **Performance** | First Contentful Paint < 2s, Time to Interactive < 3.5s |
| **Offline Support** | PWA service worker caching, offline banner notification |
| **Responsiveness** | Mobile-first design (320px–428px primary), tablet and desktop support |
| **Accessibility** | Semantic HTML, ARIA labels, reduced motion support (`useReducedMotion` hook) |
| **Security** | Supabase RLS policies, JWT auth, environment variable secrets |
| **Scalability** | Supabase auto-scaling, CDN for static assets |
| **Data Caching** | React Query with 5-min stale time, 30-min GC time |
| **Image Optimization** | Client-side compression before upload (`imageCompression.ts`) |
| **Video Performance** | HLS streaming, virtual scrolling, prebuffering (`useVideoPrebuffering`) |
| **Native Experience** | Haptic feedback, Android back button handling, splash screen |

---

## 8. Success Metrics (KPIs)

| KPI | Target | Measurement |
|-----|--------|-------------|
| **Daily Active Users (DAU)** | 10,000+ within 6 months | Supabase Auth session tracking |
| **User Retention (D30)** | 40%+ | Cohort analysis |
| **Posts Per User/Month** | 5+ | Posts table aggregation |
| **Circle Engagement** | 60% of users join ≥1 circle | Circle membership query |
| **Shop Conversion Rate** | 3%+ | Orders / product views |
| **SOS Response Time** | < 5 minutes average | Helper request timestamps |
| **App Session Duration** | > 8 minutes avg | Analytics events |
| **NPS Score** | > 50 | In-app survey |
| **Crash Rate** | < 1% | Error boundary tracking |
| **Push Notification Opt-in** | > 70% | FCM token registration rate |

---

## 9. Out of Scope (v1)

- Payment processing (live transactions)
- Video/voice calling between users
- Government ID verification
- Multi-tenant white-label deployment
- Web admin panel
- Automated moderation (AI content filtering)
