# Padosi Admin Portal

Super Admin web portal for managing Padosi communities.

This project is built with Next.js App Router and provides admin workflows for:

- Admin login
- Viewing/searching communities
- Creating communities (with admin and without admin)
- Updating community details and status
- Deleting communities
- Inviting/assigning community admins
- Viewing community users
- Language switching (English/Urdu) with RTL support
- Light/Dark theme support

## Tech Stack

- Next.js `16.1.6` (App Router)
- React `19`
- TypeScript
- Tailwind CSS + shadcn-style UI components
- `pnpm` package manager
- `sonner` for toast notifications

## Project Structure

```text
app/
  api/proxy/[...path]/route.ts   # Optional backend proxy
  communities/                   # Protected admin routes
  login/                         # Login page
  layout.tsx                     # Global providers and app shell
components/
  ui/                            # Shared UI primitives
  community-*.tsx                # Community feature UI
  dashboard-header.tsx
  login-form.tsx
hooks/
  use-communities.ts             # Communities fetch + cache + pagination
lib/
  api.ts                         # API client + token refresh behavior
  auth-context.tsx               # Auth state lifecycle
  locale-context.tsx             # i18n + RTL
  auth-constants.ts              # Auth key constants
middleware.ts                    # Route guard (cookie-based)
```

## Prerequisites

Install the following on your system:

1. Node.js `20.x` or newer (LTS recommended)
2. `pnpm` (latest stable recommended)
3. Git
4. Access to the backend API used by this portal

## Environment Variables

Create a `.env` file in project root (or copy `.env.example`).

```bash
cp .env.example .env
```

Set these variables:

- `NEXT_PUBLIC_USE_API_PROXY`
- `BACKEND_API_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_ADMIN_LOGIN_PATH`
- `NEXT_PUBLIC_ADMIN_REFRESH_PATH`
- `NEXT_PUBLIC_COMMUNITY_UPDATE_PATH`
- `NEXT_PUBLIC_COMMUNITY_DELETE_PATH`
- `NEXT_PUBLIC_AUTH_STORAGE_KEY`
- `NEXT_PUBLIC_AUTH_STATE_COOKIE`

### What each variable does

- `NEXT_PUBLIC_USE_API_PROXY`
  - `true`: frontend calls Next proxy (`/api/proxy/*`)
  - `false`: frontend calls backend directly via `NEXT_PUBLIC_API_BASE_URL`
- `BACKEND_API_BASE_URL`
  - Base URL used by the Next proxy route.
  - Required when proxy mode is enabled.
- `NEXT_PUBLIC_API_BASE_URL`
  - Direct backend base URL for browser requests (non-proxy mode).
  - Also used as fallback by proxy route if `BACKEND_API_BASE_URL` is not set.
- `NEXT_PUBLIC_ADMIN_LOGIN_PATH`
  - Login endpoint path (default: `/auth/signup-admin`)
- `NEXT_PUBLIC_ADMIN_REFRESH_PATH`
  - Refresh-token endpoint path (default: `/auth/refresh-token`)
- `NEXT_PUBLIC_COMMUNITY_UPDATE_PATH`
  - Community update endpoint path (default: `/community/update`)
- `NEXT_PUBLIC_COMMUNITY_DELETE_PATH`
  - Community delete endpoint base path (default: `/community/delete`)
- `NEXT_PUBLIC_AUTH_STORAGE_KEY`
  - Session storage key for auth session (default: `padosi_auth_tokens`)
- `NEXT_PUBLIC_AUTH_STATE_COOKIE`
  - Cookie key used for route access checks (default: `padosi_auth_state`)

## Installation

```bash
pnpm install
```

## Run the Project (Development)

```bash
pnpm dev
```

- Starts Next.js dev server (Turbopack).
- Default URL: `http://localhost:3000`

## Production Build and Start

Build:

```bash
pnpm build
```

Start production server:

```bash
pnpm start
```

## Available Scripts

From `package.json`:

- `pnpm dev` -> runs `next dev --turbo`
- `pnpm build` -> runs `next build`
- `pnpm start` -> runs `next start`
- `pnpm lint` -> runs `next lint`

## Authentication and Route Protection

- Auth state is managed in `lib/auth-context.tsx`.
- Middleware checks `NEXT_PUBLIC_AUTH_STATE_COOKIE` to protect `/communities/*`.
- Login page redirects to `/communities` when already authenticated.
- Community routes redirect to `/login` when unauthenticated.
- Access token/session metadata is stored in `sessionStorage`.
- Refresh token is kept in volatile memory only.

## API Behavior Notes

- Centralized API client: `lib/api.ts`.
- API code `419` triggers token refresh and request retry.
- API code `498` triggers force logout.
- Login response is normalized to support multiple backend payload shapes.

## i18n and RTL

- Translation source: `lib/locale-context.tsx`
- Supported locales: `en`, `ur`
- RTL mode is enabled automatically for Urdu.
- New UI text should be added for both locales.

## Theming and UI

- Theme provider is wired globally in `app/layout.tsx`.
- Design tokens and motion classes are in `app/globals.css`.
- Shared components are under `components/ui/*`.

## Verification and Quality Checks

Run strict TypeScript check:

```bash
pnpm exec tsc --noEmit
```

Recommended manual checks after changes:

1. Login success and error handling
2. Redirect behavior for protected routes
3. Communities list search and pagination
4. Status toggle updates
5. Create community (both flows)
6. Community details update/delete/invite admin
7. Theme toggle
8. Language toggle + RTL layout

## Known Caveats

1. `pnpm lint` currently fails in this repo because script uses `next lint`, while current Next CLI in this setup does not expose that command.
2. `pnpm build` may fail in restricted/offline environments due to Google Fonts fetch (`next/font` Inter download).
3. `next.config.mjs` currently has `typescript.ignoreBuildErrors=true`, so build success alone is not a full type-safety guarantee.

## Troubleshooting

### App cannot reach backend API

- Verify `NEXT_PUBLIC_USE_API_PROXY` mode.
- If proxy mode is on, ensure `BACKEND_API_BASE_URL` is set and reachable.
- If direct mode is on, ensure `NEXT_PUBLIC_API_BASE_URL` is set correctly.

### Redirect loop between login and communities

- Check cookie key/value setup (`NEXT_PUBLIC_AUTH_STATE_COOKIE`).
- Clear browser cookies/sessionStorage and login again.

### Build fails with Google Fonts fetch error

- Ensure outbound network access to `fonts.googleapis.com` during build.
- Or replace remote font loading strategy for fully offline builds.

## Deployment Notes

- Build command: `pnpm build`
- Start command: `pnpm start`
- Ensure all required env vars are present in deployment environment.
- If using proxy mode in production, route `/api/proxy/*` must have access to backend URL.

## Contribution Guidelines (Recommended)

1. Keep changes scoped and minimal.
2. Reuse existing UI primitives from `components/ui/*`.
3. Preserve i18n/RTL behavior for any new UI text/layout.
4. Run `pnpm exec tsc --noEmit` before submitting changes.
5. Include manual test notes for changed workflows.

## License

No license file is currently defined in this repository.
