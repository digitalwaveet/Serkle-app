# Privacy Policy

**MomsNest — Privacy Policy**  
**Effective Date:** March 4, 2026  
**Last Updated:** March 4, 2026  
**App Name:** MomsNest  
**App ID:** `com.momsnest.app`  
**Operated By:** MomsNest Technologies  

---

## 1. Introduction

Welcome to MomsNest. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and web platform (collectively, the "Service").

By using MomsNest, you agree to the collection and use of information in accordance with this policy. If you do not agree with the terms of this Privacy Policy, please do not access or use the Service.

---

## 2. Information We Collect

### 2.1 Information You Provide Directly

| Category | Data Collected | Purpose |
|----------|---------------|---------|
| **Account Information** | Name, email address, password, username | Account creation and authentication |
| **Profile Information** | Bio, avatar photo, cover photo, location, website URL, initials | Profile display and social networking |
| **Content** | Posts, comments, questions, answers, stories, videos, images | User-generated content sharing |
| **Marketplace Data** | Product listings, prices, descriptions, product images | E-commerce functionality |
| **Order Data** | Shipping address (full name, street, city, state, zip, country, phone) | Order fulfillment and delivery |
| **Payment Information** | Payment method type, last four digits of card, card brand | Transaction processing |
| **Emergency Contacts** | Contact name, phone number, relationship | SOS emergency notification |
| **Seller Information** | Business name, email, phone, location, business license, tax ID | Seller verification |
| **Expert Information** | Specialty, certifications, years of experience, bio | Expert profile verification |
| **Communication Data** | Direct messages, SOS messages, shop messages, live stream chat | In-app communication |

### 2.2 Information Collected Automatically

| Category | Data Collected | Purpose |
|----------|---------------|---------|
| **Device Information** | Device type, operating system, browser type | App optimization and compatibility |
| **Authentication Tokens** | JWT session tokens | Secure authentication |
| **Push Notification Tokens** | Firebase Cloud Messaging (FCM) token | Push notification delivery |
| **Network Status** | Online/offline status | Offline mode and connectivity features |
| **App Version** | Application version number | Cache management and update notifications |

### 2.3 Information Collected with Your Consent

| Category | Data Collected | Purpose |
|----------|---------------|---------|
| **Precise Location** | GPS latitude and longitude | SOS alerts, nearby helpers, shop item location |
| **Camera & Photos** | Camera access, photo library | Profile photos, post images, product photos, stories |
| **Notifications** | Notification permission | Push notifications for messages, alerts, updates |

> **Important:** Location data is collected **only when you explicitly enable it** for SOS/Safety features. We do not track your location in the background without your active consent.

---

## 3. How We Use Your Information

We use your personal information for the following purposes:

### 3.1 Core Service Operations
- **Account Management:** Create and manage your account, authenticate your identity
- **Social Features:** Display your profile, posts, comments, and stories to other users
- **Community Circles:** Facilitate group membership, events, services, and resource sharing
- **Marketplace:** Enable product listing, purchasing, order management, and seller-buyer communication
- **Q&A Platform:** Enable question posting, answering, and expert verification
- **Messaging:** Deliver direct messages, shop messages, and SOS messages between users
- **Video & Live Streaming:** Enable video uploads, live broadcasting, and viewer interaction

### 3.2 Safety & Emergency Features
- **SOS Alerts:** Process emergency alerts and share your location with nearby helpers
- **Emergency Contact Notification:** Alert your designated emergency contacts during SOS events
- **Helper Network:** Connect you with nearby community helpers during emergencies
- **Abuse Reports:** Investigate and act on reported safety violations

### 3.3 Financial Features
- **Coin Wallet:** Manage your virtual currency balance and transaction history
- **Payment Processing:** Process marketplace orders and coin purchases
- **Seller Analytics:** Provide sellers with aggregated sales and performance data

### 3.4 Platform Improvement
- **Performance Optimization:** Improve app speed, stability, and user experience
- **Bug Fixing:** Diagnose and resolve technical issues
- **Feature Development:** Understand user behavior to build relevant features

### 3.5 Communication
- **Push Notifications:** Send notifications about messages, likes, comments, orders, and SOS alerts
- **System Updates:** Notify you about app updates and new features

---

## 4. How We Share Your Information

### 4.1 With Other MomsNest Users
- **Public Profile:** Your name, username, avatar, bio, and publicly shared content are visible to other users
- **Private Profiles:** If you set your profile to private, only approved followers can see your posts
- **Circle Content:** Content posted in circles is visible to circle members
- **Shop Listings:** Product listings are publicly visible to all authenticated users
- **SOS Alerts:** During an emergency, your alert details and location may be shared with nearby helpers

### 4.2 With Service Providers (Sub-Processors)

| Provider | Purpose | Data Shared | Privacy Policy |
|----------|---------|-------------|----------------|
| **Supabase Inc.** | Database, authentication, storage, serverless functions | All application data | [supabase.com/privacy](https://supabase.com/privacy) |
| **Cloudflare Inc.** | Content delivery network, domain services | Cached content, IP addresses | [cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/) |
| **Google Firebase** | Push notifications (FCM) | Device tokens, notification content | [firebase.google.com/support/privacy](https://firebase.google.com/support/privacy) |
| **Mapbox Inc.** | Map tiles and geocoding | Anonymized location coordinates | [mapbox.com/legal/privacy](https://www.mapbox.com/legal/privacy) |

### 4.3 We Do NOT
- ❌ **Sell** your personal data to third parties
- ❌ **Share** your data with advertisers for targeted advertising (current version)
- ❌ **Use** your content to train AI models without explicit consent
- ❌ **Transfer** your data to countries without adequate data protection without safeguards

### 4.4 Legal Obligations
We may disclose your information if required by law, court order, or governmental request, or if we believe disclosure is necessary to:
- Comply with legal obligations
- Protect and defend the rights or property of MomsNest
- Prevent or investigate wrongdoing
- Protect the personal safety of users or the public

---

## 5. Data Storage & Security

### 5.1 Where Your Data Is Stored
- **Database:** Supabase cloud infrastructure (region-specific deployment)
- **File Storage:** Supabase Storage with CDN distribution
- **Authentication:** Supabase Auth (GoTrue) with encrypted credential storage
- **Local Storage:** Session tokens stored in device `localStorage` (web) or `Preferences` (native app)

### 5.2 Security Measures

| Measure | Description |
|---------|-------------|
| **Encryption in Transit** | All data transmitted via TLS 1.3 (HTTPS) |
| **Encryption at Rest** | Database and storage encrypted with AES-256 |
| **Password Security** | Passwords hashed using bcrypt (never stored in plain text) |
| **Authentication** | JWT-based with automatic token refresh |
| **Access Control** | Row Level Security (RLS) on all database tables |
| **Input Validation** | Zod schema validation on all user inputs |
| **API Security** | Parameterized queries preventing SQL injection |
| **Session Management** | Automatic invalidation on sign-out, token expiry |

### 5.3 Data Retention

| Data Type | Retention Period | Deletion Method |
|-----------|-----------------|-----------------|
| Account data | Until account deletion | Full deletion on request |
| Posts & comments | Until user deletion or account deletion | Soft delete, then hard delete after 30 days |
| Stories | 24 hours (auto-expiration) | Automatic cleanup |
| Messages | Until conversation deletion | User-initiated deletion |
| SOS alerts | 7 years (safety/legal records) | Retained for legal compliance |
| Orders & transactions | 7 years (financial records) | Retained for legal compliance |
| Coin transactions | Indefinite (financial ledger) | Cannot be deleted (audit trail) |
| Push notification tokens | Until app uninstall or token refresh | Automatic invalidation |
| Session data | Until sign-out or expiry | Automatic cleanup |

---

## 6. Your Rights

You have the following rights regarding your personal data:

### 6.1 Right to Access
You can view all your personal data through your profile settings at any time.

### 6.2 Right to Rectification
You can update your profile information, bio, avatar, and other personal details through the Edit Profile feature.

### 6.3 Right to Erasure ("Right to be Forgotten")
You can request deletion of your account and associated data by contacting us at **privacy@momsnest.com**. Upon request, we will:
- Delete your profile, posts, comments, and media within 30 days
- Anonymize content that cannot be deleted (e.g., comments on other users' posts)
- Retain legally required data (financial records, SOS safety records) for the mandatory retention period

### 6.4 Right to Data Portability
You can request an export of your data in a machine-readable format (JSON) by contacting **privacy@momsnest.com**.

### 6.5 Right to Restrict Processing
You can restrict your profile visibility by setting your account to "Private" in settings.

### 6.6 Right to Withdraw Consent
You can withdraw consent for optional data collection:
- **Location:** Disable location services in device settings
- **Camera:** Revoke camera permission in device settings
- **Notifications:** Disable push notifications in device or app settings

### 6.7 Right to Object
You can object to any data processing by contacting **privacy@momsnest.com**.

---

## 7. Children's Privacy

MomsNest is designed for mothers and parenting adults. **We do not knowingly collect personal information from anyone under the age of 18.** If we become aware that we have collected data from a child under 18, we will take immediate steps to delete that information.

If you believe a child under 18 has provided us with personal information, please contact us at **privacy@momsnest.com**.

---

## 8. Cookies & Local Storage

### Web Application
MomsNest uses **local storage** and **session storage** in your browser for:
- **Authentication tokens:** Maintaining your login session
- **Cache data:** Improving performance by caching API responses
- **User preferences:** Theme settings, notification preferences
- **App version:** Cache busting when a new version is released

We do **NOT** use third-party tracking cookies or advertising trackers.

### Native Application
The native app (Android/iOS) uses **Capacitor Preferences** (encrypted key-value store) for session persistence. No cookies are used.

---

## 9. International Data Transfers

Your data may be processed in countries other than your country of residence through our service providers:
- **Supabase:** Data processed in the configured deployment region
- **Cloudflare:** CDN nodes worldwide (cached content only)
- **Firebase:** Google's global infrastructure (notification tokens only)
- **Mapbox:** US-based (anonymized location data only)

We ensure all cross-border data transfers comply with applicable data protection regulations through contractual safeguards with our service providers.

---

## 10. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of material changes by:
- Posting the updated policy with a new "Last Updated" date
- Sending an in-app notification
- Requiring re-acceptance for significant changes

We encourage you to review this Privacy Policy periodically.

---

## 11. Contact Us

If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us:

- **Email:** privacy@momsnest.com
- **Subject Line:** "Privacy Inquiry — [Your Username]"
- **Response Time:** Within 30 days of receipt

For urgent privacy concerns or data breach reports:
- **Email:** security@momsnest.com
- **Response Time:** Within 72 hours
