# Developer Onboarding Guide

**MomsNest — Developer Onboarding Guide**  
**Version:** 1.0  
**Date:** March 4, 2026  

---

## 1. Welcome

Welcome to the MomsNest development team! This guide will get you from zero to productive as quickly as possible. Follow these steps in order.

---

## 2. Prerequisites

### Required Software
| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | 18+ (LTS) | JavaScript runtime |
| **npm** | 9+ | Package manager |
| **Git** | 2.40+ | Version control |
| **VS Code** | Latest | Recommended editor |
| **Android Studio** | Latest | Android development (if doing mobile) |

### Recommended VS Code Extensions
| Extension | Purpose |
|-----------|---------|
| **ESLint** | Code linting |
| **Tailwind CSS IntelliSense** | Tailwind class autocomplete |
| **TypeScript Importer** | Auto-import resolution |
| **Prettier** | Code formatting |
| **GitLens** | Git history visualization |
| **ES7+ React Snippets** | React component snippets |
| **Thunder Client** | API testing (alternative to Postman) |
| **Playwright Test** | E2E test runner |

---

## 3. Project Setup

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd heart-lens-studio-main
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Environment Setup
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **Note:** Get these values from the team lead or Supabase dashboard.

### Step 4: Start Development Server
```bash
npm run dev
```
The app will be available at `http://localhost:5173`

### Step 5: Verify Everything Works
1. Open the development URL in your browser
2. You should see the MomsNest login/signup page
3. Create a test account or use provided test credentials
4. Navigate through Feed, Circles, Shop, and Safe tabs

---

## 4. Project Structure

```
heart-lens-studio-main/
├── docs/                         # 📖 Documentation (you are here)
├── public/                       # Static assets (icons, manifest)
├── src/
│   ├── App.tsx                   # 🏠 Root component (providers + routing)
│   ├── main.tsx                  # Entry point (ReactDOM.render)
│   ├── index.css                 # Global styles
│   ├── components/
│   │   ├── ui/                   # 🧩 shadcn/ui base components (51)
│   │   ├── safe/                 # 🆘 SOS/Safety components (25)
│   │   ├── shop/                 # 🛍️ Marketplace components (18)
│   │   ├── circles/              # ⭕ Circle components (20)
│   │   ├── ask/                  # ❓ Q&A components (8)
│   │   ├── live/                 # 📺 Live streaming components (5)
│   │   ├── wallet/               # 💰 Wallet components
│   │   ├── messages/             # 💬 Messaging components
│   │   └── [...shared]           # Header, footer, feed, etc.
│   ├── contexts/
│   │   ├── UserContext.tsx        # 👤 Auth + profile state
│   │   ├── CartContext.tsx        # 🛒 Shopping cart state
│   │   └── ThemeContext.tsx       # 🎨 Theme preferences
│   ├── hooks/                    # 🪝 76 custom hooks
│   ├── pages/                    # 📄 32 route pages
│   ├── types/                    # 📝 TypeScript type definitions
│   ├── utils/                    # 🔧 Utility functions
│   ├── data/                     # 📊 Mock/static data
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts         # Supabase client configuration
│   │       └── types.ts          # Auto-generated DB types (4,029 lines)
│   └── lib/
│       └── utils.ts              # Shared utility (cn(), etc.)
├── supabase/
│   ├── config.toml               # Supabase project config
│   ├── migrations/               # 69 database migrations
│   └── functions/                # 8 Edge Functions (Deno)
├── capacitor.config.json         # Native app configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── vite.config.ts                # Vite build configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies & scripts
```

---

## 5. Key Concepts to Understand

### 5.1 Supabase (Backend-as-a-Service)
- **What it is:** PostgreSQL database + Auth + Realtime + Storage + Edge Functions
- **Client:** `src/integrations/supabase/client.ts`
- **Types:** `src/integrations/supabase/types.ts` (auto-generated, DO NOT edit manually)
- **How to use:** `supabase.from('table').select('*')` — see [API Docs](./06-api-documentation.md)

### 5.2 React Query (TanStack Query)
- **What it is:** Server state management and caching layer
- **Pattern:** All data fetching goes through React Query hooks
- **Cache config:** 5-min stale time, 30-min garbage collection
- **Example:**
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['posts', userId],
  queryFn: () => supabase.from('posts').select('*').eq('user_id', userId)
});
```

### 5.3 shadcn/ui Components
- **What it is:** Collection of accessible React components built on Radix UI + Tailwind
- **Location:** `src/components/ui/`
- **Usage:** Import from `@/components/ui/button`, `@/components/ui/card`, etc.
- **Customization:** Edit component files directly — they're not node_modules
- **Documentation:** [ui.shadcn.com](https://ui.shadcn.com)

### 5.4 Capacitor (Native Bridge)
- **What it is:** Bridge between web code and native iOS/Android APIs
- **Plugins used:** Camera, Haptics, Keyboard, Push Notifications, Preferences, etc.
- **Native use pattern:**
```typescript
import { Haptics, ImpactStyle } from '@capacitor/haptics';
await Haptics.impact({ style: ImpactStyle.Medium });
```

### 5.5 Row Level Security (RLS)
- **What it is:** Database-level access control — every table has RLS rules
- **Impact:** Your client queries will only return rows the current user is authorized to see
- **If a query returns empty:** Check RLS policies in Supabase dashboard

---

## 6. Common Tasks

### Adding a New Page
1. Create `src/pages/MyPage.tsx`
2. Add the route in `src/App.tsx`:
```tsx
<Route path="/my-page" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
```
3. Add navigation from relevant components

### Adding a New Component
1. Create `src/components/my-feature/MyComponent.tsx`
2. Use shadcn/ui primitives from `@/components/ui/*`
3. Use Tailwind CSS for styling
4. Add TypeScript props interface

### Fetching Data
1. Create a hook in `src/hooks/useMyData.ts`
2. Use `useQuery` from `@tanstack/react-query`
3. Call `supabase.from('table')...`
4. Handle loading, error, and empty states

### Adding a Database Table
1. Create a migration in `supabase/migrations/`
2. Apply with `supabase db push`
3. Regenerate types: `supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts`
4. Use new types in your components

---

## 7. Development Workflow

### Daily
```bash
git pull origin main            # Get latest changes
npm install                     # Install any new deps
npm run dev                     # Start dev server
# ... code ...
git add .
git commit -m "feat: description"
git push origin my-feature
```

### Commit Convention
| Prefix | Usage | Example |
|--------|-------|---------|
| `feat:` | New feature | `feat: add circle event RSVP` |
| `fix:` | Bug fix | `fix: resolve cart quantity update` |
| `refactor:` | Code restructuring | `refactor: extract useShopItems hook` |
| `style:` | CSS/UI changes | `style: improve feed card spacing` |
| `docs:` | Documentation | `docs: add API documentation` |
| `chore:` | Tooling/config | `chore: update vite config` |
| `test:` | Test changes | `test: add auth flow e2e tests` |

---

## 8. Useful Scripts

```bash
npm run dev              # Start Vite dev server (HMR)
npm run build            # Production build → dist/
npm run lint             # Run ESLint
npx cap sync             # Sync web → native projects
npx cap open android     # Open Android Studio
npx playwright test      # Run E2E tests
```

---

## 9. Key Files to Read First

| Priority | File | Why |
|----------|------|-----|
| 🔴 | `src/App.tsx` | Understand routing, providers, app flow |
| 🔴 | `src/contexts/UserContext.tsx` | Auth, profile management |
| 🟡 | `src/integrations/supabase/client.ts` | How Supabase is configured |
| 🟡 | `src/integrations/supabase/types.ts` | Database schema reference |
| 🟡 | `capacitor.config.json` | Native app settings |
| 🟢 | `tailwind.config.ts` | Design system configuration |
| 🟢 | `vite.config.ts` | Build configuration |

---

## 10. Getting Help

| Resource | Contact |
|----------|---------|
| **Architecture questions** | Read [System Architecture](./04-system-architecture.md) |
| **Database questions** | Read [Database Docs](./05-database-documentation.md) |
| **API questions** | Read [API Docs](./06-api-documentation.md) |
| **Design system** | Read [Brand Guidelines](./brand-guidelines.md) |
| **Team chat** | Internal Slack/Discord channel |
| **Urgent issues** | Contact team lead |
