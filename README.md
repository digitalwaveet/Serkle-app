# Serkle

Serkle is a React and TypeScript application built with Vite, Tailwind CSS,
shadcn/ui, Supabase, and Capacitor for Android. It includes community Circles,
posts, videos, resources, memberships, and payments through the existing
Chapa-funded coin wallet.

## Local development

Install a current Node.js version that supports the project's test scripts, then:

```sh
git clone https://github.com/digitalwaveet/Serkle-app.git
cd Serkle-app
npm ci
npm run dev -- --host 0.0.0.0 --port 8082
```

Open http://localhost:8082. The Supabase client uses the project's existing public
configuration by default. To use another project, copy `.env.example` to
`.env.local` and replace the public settings. Keep payment secrets and the
Supabase service-role key in server secrets.

## Build and validation

```sh
npm run build
npm run test:payments
npm run test:payment-cors
npm run test:payment-return-ui
npm run test:shop-checkout-ui
npm run test:circle-entitlements
npm run test:circle-membership
npm run test:circle-collections
npm run test:circle-counts
npm run test:video-duration
npm run test:presence
```

`npm run test:circle-leave-ui` runs the isolated browser flow using a local Chrome
installation. Database integration tests use PGlite fixtures and a mocked payment
provider; they do not spend real coins or contact Chapa.

## Backend setup

Supabase migrations are in `supabase/migrations`, and Edge Functions are in
`supabase/functions`. Follow the deployment order and configuration in:

- [Circle entitlements and payments](docs/circle-entitlements.md)
- [Chapa verification, webhooks, and reconciliation](docs/chapa-payment-lifecycle.md)
- [Wallet audit deployment and recovery operations](docs/wallet-audit-deployment.md)
- [Circle membership and leaving](docs/circle-membership.md)

Chapa requires server secrets, a registered signed webhook, and the reconciliation
schedule described in the payment guide. Keep the frontend, migrations, and Edge
Functions in the same release window.

## Project layout

- `src/`: application screens, components, hooks, and shared logic
- `src/tests/`: unit, integration, and browser regression tests
- `public/`: public application assets
- `supabase/`: database migrations, Edge Functions, and setup scripts
- `android/`: Capacitor Android project
- `docs/`: product, implementation, and deployment documentation
- `serkle_codex_splash_handoff/`: source assets and design handoff for the opening animation

Local environment files, private keys, dependencies, build output, and temporary
deployment archives are excluded by `.gitignore`.
