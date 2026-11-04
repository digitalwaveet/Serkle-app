# Contributing Guide

**MomsNest — Contributing Guide**  
**Version:** 1.0  
**Date:** March 4, 2026  

---

## 1. Thank You!

Thank you for your interest in contributing to MomsNest! Every contribution — whether it's a bug report, feature suggestion, code contribution, or documentation improvement — makes our platform better for mothers everywhere. 💜

---

## 2. Code of Conduct

All contributors must adhere to our [Community Guidelines](./legal/community-guidelines.md). We are committed to providing a welcoming and harassment-free environment for everyone.

**Key principles:**
- Be respectful and inclusive
- Provide constructive feedback
- Focus on what's best for the community
- Show empathy towards other community members

---

## 3. How to Contribute

### 3.1 Reporting Bugs

1. **Search first:** Check existing issues to avoid duplicates
2. **Create an issue** with the following template:

```markdown
## Bug Report

**Description:** Clear, concise description of the bug

**Steps to Reproduce:**
1. Go to '...'
2. Click on '...'
3. Scroll to '...'
4. See error

**Expected Behavior:** What you expected to happen

**Actual Behavior:** What actually happened

**Screenshots:** If applicable

**Environment:**
- Device: [e.g., Samsung Galaxy S23, iPhone 15, Chrome Desktop]
- OS: [e.g., Android 14, iOS 17, Windows 11]
- Browser: [e.g., Chrome 120, Safari 17] (if web)
- App Version: [e.g., 1.0.0]

**Severity:** [Critical / High / Medium / Low]

**Additional Context:** Any other relevant information
```

### 3.2 Suggesting Features

1. **Check the roadmap:** Review [Operations & PM docs](./09-operations-legal-project.md) for planned features
2. **Create a feature request** with:

```markdown
## Feature Request

**Problem:** What problem does this solve?

**Proposed Solution:** Describe your proposed feature

**User Story:** As a [type of user], I want [action] so that [benefit]

**Mockup/Wireframe:** If applicable, attach visual references

**Priority:** [Must-have / Nice-to-have / Future consideration]

**Alternatives Considered:** Other solutions you've considered
```

### 3.3 Contributing Code

Follow this workflow:

```
1. Fork the repository (or create a branch if you have access)
2. Create a feature branch from `main`
3. Make your changes
4. Write/update tests if applicable
5. Ensure linting passes
6. Submit a Pull Request
```

---

## 4. Development Setup

See the [Developer Onboarding Guide](./developer-onboarding.md) for full setup instructions.

**Quick start:**
```bash
git clone <repo-url>
cd heart-lens-studio-main
npm install
cp .env.example .env    # Add your Supabase credentials
npm run dev
```

---

## 5. Branch Strategy

### Branch Naming Convention
```
type/description-in-kebab-case
```

| Type | Usage | Example |
|------|-------|---------|
| `feature/` | New features | `feature/circle-event-rsvp` |
| `fix/` | Bug fixes | `fix/cart-quantity-bug` |
| `refactor/` | Code restructuring | `refactor/extract-shop-hooks` |
| `docs/` | Documentation | `docs/api-documentation` |
| `style/` | UI/CSS changes | `style/feed-card-redesign` |
| `test/` | Test additions | `test/auth-flow-e2e` |
| `chore/` | Tooling/config | `chore/update-dependencies` |

### Branch Flow
```
main (production)
  └── feature/my-feature (development)
      └── Pull Request → Review → Merge to main
```

---

## 6. Code Standards

### 6.1 TypeScript
- **Strict mode** enabled — avoid `any` type
- Use **interfaces** for component props
- Use **type** for unions and utility types
- Import types from `@/integrations/supabase/types`

```typescript
// ✅ Good
interface PostCardProps {
  post: Tables<'posts'>;
  onLike: (postId: string) => void;
}

// ❌ Bad
const PostCard = (props: any) => { ... }
```

### 6.2 Components
- **Functional components** only (no class components)
- **Named exports** (no default exports except pages)
- **Single responsibility** — keep components focused
- Use **shadcn/ui** components from `@/components/ui/`
- Use **Tailwind CSS** for all styling

```typescript
// ✅ Good
export const PostCard = ({ post, onLike }: PostCardProps) => {
  return (
    <Card className="p-4 rounded-xl">
      {/* ... */}
    </Card>
  );
};

// ❌ Bad
export default class PostCard extends React.Component { ... }
```

### 6.3 Hooks
- Custom hooks in `src/hooks/` with `use` prefix
- Data fetching hooks use `useQuery` / `useMutation` from React Query
- All Supabase calls go through hooks (not directly in components)

```typescript
// ✅ Good: src/hooks/usePostLike.ts
export const usePostLike = (postId: string) => {
  return useMutation({
    mutationFn: () => supabase.from('likes').insert({ post_id: postId, user_id: userId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
  });
};
```

### 6.4 File Naming
| Type | Convention | Example |
|------|-----------|---------|
| **Components** | PascalCase | `PostCard.tsx` |
| **Hooks** | camelCase with `use` prefix | `usePostLike.ts` |
| **Utilities** | camelCase | `imageCompression.ts` |
| **Pages** | PascalCase | `FeedPage.tsx` |
| **Types** | PascalCase | `PostTypes.ts` |
| **Constants** | camelCase file, UPPER_CASE values | `config.ts` → `MAX_UPLOAD_SIZE` |

### 6.5 Imports
Use the `@/` alias for all project imports:
```typescript
// ✅ Good
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';

// ❌ Bad
import { Button } from '../../../components/ui/button';
```

---

## 7. Pull Request Process

### 7.1 PR Template
```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring
- [ ] Documentation
- [ ] UI/Style change

## Changes Made
- List of specific changes

## Screenshots
If applicable, add screenshots of UI changes.

## Testing
- [ ] Tested locally on web
- [ ] Tested on Android emulator (if applicable)
- [ ] Verified no TypeScript errors (`npm run build`)
- [ ] Verified linting passes (`npm run lint`)
- [ ] Existing tests still pass

## Checklist
- [ ] Code follows project conventions
- [ ] Self-reviewed my code
- [ ] No console.log statements left
- [ ] No commented-out code
- [ ] Types are properly defined (no `any`)
- [ ] Responsive design verified (mobile-first)
```

### 7.2 Review Process
1. Submit PR with completed template
2. Automated checks run (build, lint)
3. At least **1 reviewer** must approve
4. Address all review comments
5. Merge after approval (squash merge preferred)

### 7.3 Review Guidelines
When reviewing PRs:
- ✅ Check for TypeScript correctness
- ✅ Verify responsive design
- ✅ Look for accessibility issues
- ✅ Check for performance concerns
- ✅ Verify error handling
- ✅ Ensure consistent styling with design system

---

## 8. Testing

### 8.1 Before Submitting
```bash
npm run build            # Verify it compiles
npm run lint             # Check for lint errors
npx playwright test      # Run E2E tests (if applicable)
```

### 8.2 Manual Testing Checklist
- [ ] Feature works on mobile viewport (375px)
- [ ] Feature works on tablet viewport (768px)
- [ ] Feature works on desktop viewport (1280px)
- [ ] No console errors
- [ ] Loading states are handled
- [ ] Error states are handled
- [ ] Empty states are handled

---

## 9. Database Changes

If your contribution requires database schema changes:

1. **Create a migration file** in `supabase/migrations/`
2. **Name it descriptively:** `YYYYMMDDHHMMSS_description.sql`
3. **Include RLS policies** for any new tables
4. **Regenerate types** after applying migration
5. **Document** the schema change in your PR description

> ⚠️ **Never modify existing migration files** — always create new ones.

---

## 10. Documentation

When contributing code, also update documentation if:
- You add a new feature (update PRD)
- You add a new API endpoint (update API docs)
- You modify the database schema (update Database docs)
- You change the project structure (update onboarding guide)
- You add new dependencies (update System Architecture)

---

## 11. Recognition

All contributors will be recognized in our contributors list. Significant contributions may include:
- Mention in release notes
- Contributor badge on MomsNest profile (future feature)
- Invitation to core contributor team

---

## 12. Questions?

If you have questions about contributing:
- Read the [Developer Onboarding Guide](./developer-onboarding.md)
- Check existing documentation in the `docs/` folder
- Reach out to the team on our internal communication channel
- Email: **developers@momsnest.com**
