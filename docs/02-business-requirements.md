# 💼 MomsNest — Business Requirement Document (BRD)

**Version:** 1.0  
**Date:** March 4, 2026  
**Product:** MomsNest  

---

## 1. Business Goals

| # | Goal | Description |
|---|------|-------------|
| BG-1 | **Build the #1 mothers' community platform** | Become the go-to app for mothers in Ethiopia and East Africa, then expand globally |
| BG-2 | **Achieve product-market fit within 6 months** | Reach 10K DAU with 40%+ D30 retention |
| BG-3 | **Generate sustainable revenue** | Multiple revenue streams operational by Month 9 |
| BG-4 | **Enable mother-to-mother commerce** | Facilitate trusted peer-to-peer and B2C sales within the ecosystem |
| BG-5 | **Ensure safety for all users** | Zero-tolerance moderation + industry-leading SOS response system |

---

## 2. Revenue Model

| Stream | Model | Projected % of Revenue |
|--------|-------|----------------------|
| **Marketplace Commission** | 5–10% on each shop transaction | 35% |
| **Premium Circles** | Monthly subscription for premium community access | 20% |
| **Coin Economy** | Users purchase coins for premium content, tips, and boosts | 18% |
| **Promoted Listings** | Sellers pay to boost product visibility | 12% |
| **Sponsored Posts** | Brand partnerships for sponsored content in feed | 10% |
| **Expert Services** | Commission on bookable expert consultations | 5% |

### Coin Economy Detail
- **Purchase:** 100 coins = $1.00 (top-up via payment gateway)
- **Earn:** Daily login (+5), first post (+10), helpful answer (+15), SOS help (+50)
- **Spend:** Premium content unlock, tips to creators, boost posts
- **Withdraw:** Minimum 1,000 coins, payout via mobile money

---

## 3. Market Opportunity

### Total Addressable Market (TAM)
- **Global mothers' market:** 2+ billion mothers worldwide
- **Digital mothers' market:** ~600M mothers active on social platforms
- **Parenting app market:** $2.1B in 2025, growing at 9.8% CAGR

### Serviceable Addressable Market (SAM)
- **East Africa mothers (Ethiopia, Kenya, Tanzania):** ~40M mothers aged 18–45
- **Smartphone penetration:** 35% and growing rapidly (Telecom reports)
- **Target:** Urban and peri-urban mothers with smartphone access

### Serviceable Obtainable Market (SOM)
- **Year 1 target:** 50,000 registered users, 10,000 DAU
- **Year 2 target:** 250,000 registered users, 50,000 DAU
- **Year 3 target:** 1M registered users, 200,000 DAU

---

## 4. Stakeholders

| Stakeholder | Role | Interest |
|------------|------|----------|
| **Founders / Product Team** | Build & operate the platform | Growth, retention, revenue |
| **Mothers (Users)** | Primary users | Community, safety, shopping |
| **Expert Professionals** | Verified advisors (doctors, counselors) | Professional visibility, income |
| **Sellers / Small Businesses** | Marketplace vendors | Sales channel, customer access |
| **Community Leaders** | Circle admins and moderators | Influence, monetization |
| **Investors** | Financial backers | ROI, user growth metrics |
| **Regulatory Bodies** | Government / data protection | Compliance, user safety |
| **Payment Partners** | Chapa, Telebirr, Stripe | Transaction volume |
| **Mapbox** | Map services provider | API usage, partnership |

---

## 5. Constraints

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| **Internet reliability** | Connectivity issues in target markets | PWA offline support, data caching, optimistic UI |
| **Payment infrastructure** | Limited payment gateway options in Ethiopia | Start with coin economy; integrate Chapa/Telebirr as available |
| **Smartphone diversity** | Wide range of device capabilities | Progressive enhancement, image compression, lazy loading |
| **Content moderation** | Risk of harmful/inappropriate content | Abuse reporting, community guidelines, future AI moderation |
| **Data storage costs** | Growing media/video storage | Supabase storage with CDN, image compression before upload |
| **Regulatory compliance** | Ethiopian data protection laws evolving | Local data residency awareness, privacy-first design |
| **Small development team** | Limited engineering bandwidth | Lovable AI-assisted development, component reuse, Supabase BaaS |

---

## 6. Risk Assessment

| Risk | Probability | Impact | Severity | Mitigation |
|------|------------|--------|----------|------------|
| **Low initial adoption** | Medium | High | 🟠 High | Pre-launch community building, influencer partnerships, referral rewards |
| **User safety incident** | Low | Critical | 🔴 Critical | SOS module, moderation tools, legal disclaimers, emergency contacts |
| **Data breach** | Low | Critical | 🔴 Critical | Supabase RLS, encrypted connections, regular security audits |
| **Marketplace fraud** | Medium | High | 🟠 High | Seller verification, dispute system, order escrow (Phase 2) |
| **Platform downtime** | Low | High | 🟡 Medium | Supabase SLA, CDN distribution, service worker caching |
| **Content quality decline** | Medium | Medium | 🟡 Medium | Community guidelines, expert verification badges, content curation |
| **Competitor entry** | Medium | Medium | 🟡 Medium | First-mover advantage, deep feature set, local community focus |
| **Regulatory changes** | Low | Medium | 🟢 Low | Modular compliance architecture, legal counsel |
| **Scaling costs** | Medium | Medium | 🟡 Medium | Supabase Pro plan, CDN optimization, lazy loading |

---

## 7. Business Rules

1. **Account Requirement:** All features except public circle browsing require authentication
2. **Seller Verification:** Sellers must provide business name, email, and location to list products
3. **SOS Responsibility:** Legal disclaimer required before first SOS use; platform is not a substitute for 911/emergency services
4. **Content Ownership:** Users retain ownership of content; platform gets license to display
5. **Coin Non-Refundable:** Purchased coins are non-refundable but can be converted to cash via withdrawal
6. **Dispute Window:** 14 days from delivery to file a dispute
7. **Helper Accountability:** Helpers are community volunteers, not employees; no guaranteed response
8. **Minimum Age:** Users must be 18+ to register (mothers focus)
