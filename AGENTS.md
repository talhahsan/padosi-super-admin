# AGENTS.md

Guide for coding agents working in the **Padosi Admin Portal** repository.

## 1. Stack and Runtime

- Next.js App Router + TypeScript.
- React 19, Tailwind CSS, shadcn-style UI components.
- Package manager: `pnpm`.
- Main source folders: `app/`, `components/`, `hooks/`, `lib/`.

## 2. High-Level Architecture

### Routing layer (`app/`)

- `app/layout.tsx`: wraps app with `ThemeProvider`, `LocaleProvider`, `AuthProvider`, toaster, analytics.
- `app/page.tsx`: redirects to `/login`.
- `app/login/page.tsx`: login page.
- `app/communities/*`: authenticated community management routes.
- `app/api/proxy/[...path]/route.ts`: API proxy route used when `NEXT_PUBLIC_USE_API_PROXY=true`.

### Feature layer (`components/`)

Core feature components:

- `components/login-form.tsx`
- `components/community-list.tsx`
- `components/community-details-view.tsx`
- `components/community-create-form.tsx`
- `components/community-create-without-admin-form.tsx`
- `components/dashboard-header.tsx`

### Logic/data layer (`lib/` and `hooks/`)

- `lib/api.ts`: all backend requests, token refresh, API error handling.
- `lib/auth-context.tsx`: client auth state, login/logout behavior, cookie/session sync.
- `lib/locale-context.tsx`: translations (`en`, `ur`) and RTL behavior.
- `lib/auth-constants.ts`: cookie/storage key constants.
- `hooks/use-communities.ts`: cached/paginated community listing.

### Route protection

- `middleware.ts` protects `/communities/:path*` and redirects based on auth cookie.
- `app/communities/layout.tsx` also checks cookie server-side and redirects unauthenticated users.

## 3. Auth and Session Contract

- Login response is normalized via `normalizeLoginData()` in `lib/api.ts`.
- Access token + expiry data is stored in `sessionStorage`.
- Refresh token is intentionally **not persisted** to storage; it is held in volatile memory (`setRefreshToken`).
- Cookie (`AUTH_STATE_COOKIE=1`) is used for middleware/server checks.
- API code `419` triggers refresh retry logic.
- API code `498` triggers forced logout and client cleanup.

If auth behavior changes, update these together:

- `lib/api.ts`
- `lib/auth-context.tsx`
- `lib/auth-constants.ts`
- `middleware.ts`
- `app/communities/layout.tsx`

## 4. API and Environment Variables

Expected env vars (see `.env.example`):

- `NEXT_PUBLIC_USE_API_PROXY`
- `BACKEND_API_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_ADMIN_LOGIN_PATH`
- `NEXT_PUBLIC_ADMIN_REFRESH_PATH`
- `NEXT_PUBLIC_COMMUNITY_UPDATE_PATH`
- `NEXT_PUBLIC_COMMUNITY_DELETE_PATH`
- `NEXT_PUBLIC_AUTH_STORAGE_KEY`
- `NEXT_PUBLIC_AUTH_STATE_COOKIE`

Rules:

- If `NEXT_PUBLIC_USE_API_PROXY=true`, frontend calls `/api/proxy/*`.
- Otherwise, frontend calls `NEXT_PUBLIC_API_BASE_URL` directly.
- Keep tolerant response parsing in `lib/api.ts`; backend payload shape is not fully uniform.

## 5. i18n and RTL Requirements

- All user-facing copy should come from `lib/locale-context.tsx` via `t("...")`.
- Add/update both English and Urdu keys for new text.
- Respect `isRTL` class direction changes in layout and icon placement.
- Do not hardcode feature copy in components unless deliberately temporary and documented.

## 6. UI System Requirements

- Reuse primitives in `components/ui/*`.
- Use `cn()` from `lib/utils.ts` for class composition.
- Keep style consistent with existing theme tokens and animation classes from `app/globals.css`.
- Preserve responsive behavior across mobile and desktop.

## 7. Agent Workflow (Implementation Steps)

1. Read relevant route/component/hook/lib files before editing.
2. Confirm whether change affects API contract, auth flow, or i18n keys.
3. Implement the smallest safe change.
4. Update translations if UI text changes.
5. Verify manually and with commands in Section 8.
6. Summarize changed files, behavioral impact, and risks.

## 8. Validation and Testing

### Available scripts

- `pnpm dev`
- `pnpm build`
- `pnpm start`
- `pnpm lint` (currently broken in this repo because it runs `next lint`, which is not available in current Next CLI)

### Mandatory validation commands

1. `pnpm exec tsc --noEmit`
2. `pnpm build` when touching routing/config/API integration

Notes:

- `next.config.mjs` has `typescript.ignoreBuildErrors=true`; build success alone is not enough.
- In restricted/offline environments, `pnpm build` may fail because `next/font` fetches Google Fonts (`Inter`) at build time.

### Manual verification checklist

- Login success/failure behavior.
- Protected-route redirects (`/login` and `/communities/*`).
- Communities list search, pagination, status toggle.
- Create flows: with admin and without admin.
- Community details: update, delete, admin invite/assign, users list pagination.
- Theme toggle and language toggle (`en`/`ur`) including RTL layout.

### Testing gap

- No first-class unit/integration/e2e test suite is configured in the repository currently.
- Prefer adding tests when introducing critical logic.

## 9. Security and Platform Notes

- CSP and security headers are configured in `next.config.mjs`.
- Keep API proxy behavior minimal and avoid forwarding unnecessary sensitive headers.
- `images.unoptimized` is enabled; be careful with image payload size/handling.
- Next.js currently warns that `middleware.ts` convention is deprecated in favor of `proxy`; do not migrate casually without coordinated route-auth testing.

## 10. Persistent Keys and Compatibility

Do not change these session/local storage keys without full flow review:

- `padosi_selected_community`
- `padosi_community_count`
- `padosi_communities_view`
- `AUTH_STORAGE_KEY` and `AUTH_STATE_COOKIE` values from `lib/auth-constants.ts`

## 11. Definition of Done

A task is complete only if:

1. Requested behavior is implemented.
2. Existing behavior is not regressed.
3. `pnpm exec tsc --noEmit` passes.
4. Relevant manual flow checks are run.
5. i18n/RTL/theming impact is handled.
6. Any env/API contract changes are documented.

## 12. Quick Onboarding for New Agents

1. Read this file.
2. Read `package.json`, `lib/api.ts`, `lib/auth-context.tsx`, `middleware.ts`.
3. Read task-specific route and component files.
4. Implement minimal safe changes.
5. Run Section 8 validation and summarize outcomes.
