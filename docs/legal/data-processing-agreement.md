# Data Processing Agreement (DPA)

**MomsNest — Data Processing Agreement**  
**Effective Date:** March 4, 2026  
**Version:** 1.0  

---

## 1. Parties

This Data Processing Agreement ("DPA") is entered into between:

- **Data Controller:** MomsNest Technologies ("Controller," "MomsNest," "we")
- **Data Subjects:** Users of the MomsNest platform ("Users")

This DPA applies to the processing of personal data in connection with the MomsNest platform and supplements our Privacy Policy.

---

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Personal Data** | Any information relating to an identified or identifiable natural person |
| **Processing** | Any operation performed on personal data (collection, storage, use, disclosure, deletion) |
| **Data Controller** | MomsNest Technologies, which determines the purposes and means of processing |
| **Data Processor** | A third party that processes data on behalf of the Controller |
| **Sub-Processor** | A third party engaged by a Data Processor |
| **Data Subject** | An identified or identifiable natural person whose personal data is processed |
| **Supervisory Authority** | The relevant data protection authority in the applicable jurisdiction |

---

## 3. Scope of Processing

### 3.1 Purpose of Processing

Personal data is processed for the following purposes:

| Purpose | Legal Basis |
|---------|-------------|
| Account creation and authentication | Contract performance |
| Social networking features | Legitimate interest / Consent |
| Marketplace transactions | Contract performance |
| SOS emergency alerts | Vital interest / Consent |
| Push notifications | Consent |
| Location services | Explicit consent |
| Platform improvement | Legitimate interest |
| Legal compliance | Legal obligation |

### 3.2 Categories of Personal Data Processed

| Category | Examples |
|----------|---------|
| **Identity Data** | Name, username, email, avatar |
| **Profile Data** | Bio, location, website, preferences |
| **Content Data** | Posts, comments, questions, answers, stories, videos |
| **Transaction Data** | Orders, payments, coin transactions, refunds |
| **Location Data** | GPS coordinates (SOS alerts only, opt-in) |
| **Communication Data** | Messages, SOS chats, shop conversations |
| **Technical Data** | Device type, session tokens, FCM tokens |
| **Usage Data** | Interaction patterns, engagement metrics (aggregated) |

### 3.3 Categories of Data Subjects

| Category | Description |
|----------|-------------|
| **Users** | Registered MomsNest account holders |
| **Sellers** | Users with marketplace selling privileges |
| **Helpers** | Users registered as SOS community helpers |
| **Experts** | Users with verified professional profiles |
| **Circle Admins** | Users managing community circles |

---

## 4. Sub-Processors

MomsNest engages the following sub-processors:

| Sub-Processor | Service | Data Processed | Location | DPA Status |
|---------------|---------|---------------|----------|------------|
| **Supabase Inc.** | Database, Auth, Storage, Edge Functions | All application data | US / Configurable region | ✅ DPA available |
| **Cloudflare Inc.** | CDN, DDoS protection | IP addresses, cached content | Global | ✅ DPA available |
| **Google LLC (Firebase)** | Push notifications (FCM) | Device tokens, notification content | US / Global | ✅ DPA available |
| **Mapbox Inc.** | Map tile serving, geocoding | Anonymized location data | US | ✅ DPA available |

### Sub-Processor Changes
- We will provide notice before adding or replacing sub-processors
- Users may object to new sub-processors by contacting **privacy@momsnest.com**

---

## 5. Security Measures

The Controller implements the following technical and organizational measures:

### Technical Measures
| Measure | Implementation |
|---------|---------------|
| Encryption in transit | TLS 1.3 for all API communications |
| Encryption at rest | AES-256 for database and storage |
| Access control | JWT authentication + Row Level Security |
| Password protection | bcrypt hashing |
| Input validation | Zod schema validation |
| Session management | Auto-expiring tokens with refresh |
| Network security | HTTPS enforcement, Cloudflare WAF |

### Organizational Measures
| Measure | Implementation |
|---------|---------------|
| Access restriction | Least privilege principle for team members |
| Incident response | Documented procedure with 72-hour breach notification |
| Code review | All changes reviewed before production deployment |
| Dependency management | Regular vulnerability scanning (`npm audit`) |
| Training | Security awareness for all team members |

---

## 6. Data Subject Rights

The Controller ensures that data subjects can exercise the following rights:

| Right | Implementation | Response Time |
|-------|---------------|---------------|
| **Access** | Profile data viewable in-app; full export via request | 30 days |
| **Rectification** | Edit Profile feature in settings | Immediate |
| **Erasure** | Account deletion request via email | 30 days |
| **Portability** | JSON data export via request | 30 days |
| **Restriction** | Private profile setting; disable notifications | Immediate |
| **Objection** | Contact privacy@momsnest.com | 30 days |
| **Withdraw Consent** | Disable location, camera, notifications in device settings | Immediate |

---

## 7. Cross-Border Transfers

### Transfer Mechanisms
When personal data is transferred outside the user's country of residence:
- **Standard Contractual Clauses (SCCs)** are in place with all sub-processors
- **Adequacy decisions** are relied upon where available
- **Supplementary measures** (encryption, access controls) are applied

### Transfer Impact Assessment
| Sub-Processor | Country | Mechanism | Risk Level |
|---------------|---------|-----------|------------|
| Supabase | US | SCC + Encryption | Medium |
| Cloudflare | Global | SCC + CDN-only | Low |
| Firebase | US | SCC + Token-only | Low |
| Mapbox | US | SCC + Anonymized | Low |

---

## 8. Data Breach Procedures

### Breach Notification Timeline
```
Discovery → Internal assessment (< 24 hours)
         → Controller notification (< 48 hours)
         → Supervisory authority notification (< 72 hours)
         → Data subject notification (without undue delay)
```

### Breach Record
All data breaches, even those not meeting notification thresholds, will be documented with:
- Date and time of discovery
- Nature and scope of the breach
- Data categories and subjects affected
- Consequences of the breach
- Remedial measures taken

---

## 9. Data Protection Impact Assessment (DPIA)

Given the nature of MomsNest's data processing, DPIAs are conducted for:

| Processing Activity | Risk Level | DPIA Status |
|--------------------|------------|-------------|
| **User profiling** (profile stats, engagement) | Medium | ✅ Completed |
| **Location processing** (SOS alerts) | High | ✅ Completed |
| **Health-adjacent data** (pregnancy, parenting Q&A) | Medium | ✅ Completed |
| **Financial processing** (coin wallet, transactions) | Medium | ✅ Completed |
| **Children-related content** (parenting discussions) | Medium | ✅ Completed |
| **AI-generated insights** (Q&A module) | Medium | ✅ Completed |

---

## 10. Audit Rights

- The Controller maintains records of all processing activities
- Data subjects may request information about data processing by contacting **privacy@momsnest.com**
- Relevant supervisory authorities may audit data processing practices upon lawful request
- The Controller will cooperate fully with any lawful audit

---

## 11. Term and Termination

- This DPA is effective as long as the Controller processes personal data
- Upon termination of a user account, personal data is handled per the retention schedule in our Privacy Policy
- Upon request, data is deleted or returned in a machine-readable format
- Legally required data (financial records, safety records) is retained per statutory requirements

---

## 12. Contact

**Data Protection Officer (DPO):**  
Email: privacy@momsnest.com  
Subject: "DPA Inquiry"  
Response time: 30 days

---

# Cookie & Local Storage Policy

**MomsNest — Cookie & Local Storage Policy**  
**Effective Date:** March 4, 2026  

---

## 1. Overview

MomsNest primarily operates as a mobile application (PWA + Capacitor native app). We use **local storage and session storage** — not traditional browser cookies — to provide core functionality.

**We do NOT use third-party tracking cookies, advertising cookies, or analytics cookies.**

---

## 2. What We Use

### 2.1 Web Application (PWA)

| Storage Type | Key | Purpose | Duration |
|-------------|-----|---------|----------|
| **localStorage** | `sb-*-auth-token` | Supabase authentication session | Until sign-out |
| **localStorage** | `app-version` | Cache version checking | Until cleared |
| **localStorage** | `theme` | User theme preference (light/dark) | Persistent |
| **Service Worker Cache** | `sw-cache-*` | PWA offline support | Until app update |
| **sessionStorage** | React Query cache | API response caching | Until tab close |

### 2.2 Native Application (Android/iOS)

| Storage Type | Key | Purpose | Duration |
|-------------|-----|---------|----------|
| **Capacitor Preferences** | `sb-*-auth-token` | Authentication session (encrypted) | Until sign-out |
| **Capacitor Preferences** | `app-settings` | User preferences | Persistent |
| **Native Cache** | Web assets | Offline access to app | Until app update |

### 2.3 What We Do NOT Use
- ❌ **Third-party tracking cookies** (Google Analytics, Facebook Pixel, etc.)
- ❌ **Advertising cookies** (ad networks, retargeting)
- ❌ **Social media cookies** (Facebook, Twitter, LinkedIn tracking)
- ❌ **Fingerprinting** (browser fingerprinting for tracking)

---

## 3. Strictly Necessary Storage

All local storage used by MomsNest is **strictly necessary** for the operation of the application. Without these, the app cannot:
- Maintain your login session
- Display the correct theme
- Work offline (PWA)
- Cache API responses for performance

Because we only use strictly necessary storage and do not use tracking cookies, **cookie consent banners are generally not required** under GDPR and similar regulations.

---

## 4. Managing Your Storage

### Web Browser
You can clear MomsNest data from your browser at any time:
1. Open browser settings → Privacy → Clear browsing data
2. Select "Local storage" and "Cookies and site data"
3. Clear data for the MomsNest domain

> **Note:** Clearing storage will sign you out of the application.

### Native App
1. Go to device Settings → Apps → MomsNest
2. Select "Clear Data" or "Clear Cache"
3. Restart the app

---

## 5. Contact

For questions about our use of storage technologies:
- **Email:** privacy@momsnest.com
- **Subject:** "Cookie/Storage Inquiry"
