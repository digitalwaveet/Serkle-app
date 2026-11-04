# QA Testing Guide

This document outlines testing procedures for the application.

## Table of Contents
- [Getting Started](#getting-started)
- [Test Categories](#test-categories)
- [Manual Testing Checklist](#manual-testing-checklist)
- [Automated Tests](#automated-tests)
- [Known Issues](#known-issues)

---

## Getting Started

### Prerequisites
- Node.js 18+
- Bun or npm
- Access to the Lovable preview environment

### Running the App Locally
```bash
npm install
npm run dev
```

### Running Tests
```bash
npx playwright test
```

---

## Test Categories

### 1. Authentication
- [ ] User signup with email
- [ ] User login with email
- [ ] Logout functionality
- [ ] Session persistence after refresh

### 2. Feed & Posts
- [ ] Posts load on home feed
- [ ] Like/unlike posts
- [ ] Save/unsave posts
- [ ] Share posts
- [ ] Comments modal opens and displays comments
- [ ] Add new comment
- [ ] Pull-to-refresh works

### 3. Video Feed (Relax View)
- [ ] Videos load correctly
- [ ] Swipe up/down navigation works
- [ ] Mute/unmute toggle
- [ ] Like/save/share actions
- [ ] Follow button on video overlay
- [ ] Video auto-plays when visible
- [ ] Video pauses when scrolled away

### 4. Stories
- [ ] Stories bar displays correctly
- [ ] Tap to view story
- [ ] Story navigation (next/previous)
- [ ] Story progress indicator

### 5. Circles
- [ ] Circle list loads
- [ ] Join/leave circle
- [ ] Circle posts display
- [ ] Circle events display
- [ ] Circle services display
- [ ] Create circle post

### 6. Shop
- [ ] Products load
- [ ] Product detail view
- [ ] Add to cart
- [ ] Cart functionality
- [ ] Checkout flow

### 7. Messages
- [ ] Conversations list loads
- [ ] Open conversation
- [ ] Send message
- [ ] Real-time message updates
- [ ] Typing indicator

### 8. Notifications
- [ ] Notifications list loads
- [ ] Mark as read
- [ ] Navigate from notification

### 9. Profile
- [ ] View own profile
- [ ] Edit profile
- [ ] View other user's profile
- [ ] Follow/unfollow users

### 10. Safe (SOS)
- [ ] Create SOS alert
- [ ] View nearby emergencies
- [ ] Helper response flow
- [ ] Emergency contacts

---

## Manual Testing Checklist

### Critical Path Testing
1. **New User Flow**
   - Sign up → Verify email → Complete profile → Browse feed

2. **Content Creation**
   - Create post → Add media → Publish → Verify in feed

3. **Social Interactions**
   - Like → Comment → Share → Save

4. **Video Experience**
   - Open Relax → Watch video → Interact → Navigate

### Responsive Testing
- [ ] Desktop (1920x1080)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)
- [ ] Mobile landscape

### Browser Testing
- [ ] Chrome
- [ ] Safari
- [ ] Firefox
- [ ] Edge

---

## Automated Tests

### E2E Tests Location
```
src/tests/navigation.e2e.test.ts
```

### Running Specific Tests
```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test src/tests/navigation.e2e.test.ts

# Run with UI
npx playwright test --ui
```

---

## Known Issues

| Issue | Status | Workaround |
|-------|--------|------------|
| Video may not autoplay on iOS Safari | Known | User must tap to start |
| Pull-to-refresh sensitivity varies by device | Under investigation | - |

---

## Reporting Bugs

When reporting bugs, include:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Screenshots/recordings
5. Browser/device info
6. Console errors (if any)

---

## Performance Benchmarks

| Metric | Target | Notes |
|--------|--------|-------|
| First Contentful Paint | < 1.5s | |
| Time to Interactive | < 3s | |
| Largest Contentful Paint | < 2.5s | |

---

*Last updated: December 2024*
