# Contributing Guide

This document explains how to contribute to the **Padosi Admin Portal** project.

## 1. Contribution Principles

- Keep every change scoped to a single task/ticket.
- Prefer small, reviewable pull requests.
- Do not mix unrelated fixes/features in one PR.
- Preserve existing behavior unless the ticket explicitly asks to change it.

## 2. Prerequisites

Before contributing, make sure you have:

1. Node.js `20+` (LTS recommended)
2. `pnpm`
3. Git
4. Access to backend API and required environment variables

Setup:

```bash
pnpm install
cp .env.example .env
```

## 3. Local Development

Run dev server:

```bash
pnpm dev
```

Type-check (required before PR):

```bash
pnpm exec tsc --noEmit
```

Build check (recommended for routing/config/API changes):

```bash
pnpm build
```

## 4. Branching Strategy

Create a **task-related branch** from your main integration branch (usually `main` or `develop`, based on team convention).

### Branch naming rule (ticket-first)

Use the ticket ID as the branch prefix.

Pattern:

```text
<ticket-id>-<short-kebab-description>
```

Examples:

- `PAD-142-fix-login-redirect`
- `PAD-233-community-status-toggle`
- `PAD-310-add-admin-invite-validation`

If no ticket exists, create one first. Avoid generic branch names like `fix`, `test`, `new-feature`.

## 5. How to Work on a Ticket

1. Pull latest code from base branch.
2. Create your ticket branch.
3. Implement only the ticket scope.
4. Run validation checks.
5. Commit with clear messages.
6. Push branch and open PR.

Suggested commands:

```bash
git checkout main
git pull origin main
git checkout -b PAD-142-fix-login-redirect
```

## 6. Coding Guidelines

- Follow existing project patterns and architecture.
- Reuse existing components in `components/ui/*` where possible.
- Keep user-facing text translatable (`lib/locale-context.tsx`).
- Preserve RTL behavior for UI changes.
- Do not introduce breaking API/auth changes without updating all related layers.

Relevant files for common changes:

- API/auth: `lib/api.ts`, `lib/auth-context.tsx`, `middleware.ts`
- UI routes: `app/*`, `components/*`
- i18n: `lib/locale-context.tsx`

## 7. Commit Message Guidelines

Use concise, meaningful commits. Include ticket ID when possible.

Pattern:

```text
<ticket-id>: <short change summary>
```

Examples:

- `PAD-142: fix redirect loop after login`
- `PAD-233: add optimistic status toggle for communities`

Avoid:

- `update`
- `fix stuff`
- `changes`

## 8. Pull Request Guidelines

### PR title format

```text
<ticket-id>: <short title>
```

Example:

- `PAD-142: Fix login to communities redirect behavior`

### PR description should include

1. Ticket link/ID
2. What changed
3. Why it changed
4. Screenshots/video (for UI changes)
5. How it was tested
6. Any known limitations

### Keep PR task-focused

- One ticket = one PR.
- Do not include unrelated refactors.
- If you discover unrelated issues, create separate tickets/PRs.

## 9. Pre-PR Checklist

Before opening PR, verify:

1. Branch name follows ticket convention.
2. Change matches ticket scope only.
3. `pnpm exec tsc --noEmit` passes.
4. Manual flow testing completed for affected screens.
5. UI copy changes include translation updates.
6. No secrets or local-only files are committed.

## 10. Pushing Your Branch

```bash
git add .
git commit -m "PAD-142: fix login redirect"
git push -u origin PAD-142-fix-login-redirect
```

Then open a pull request from your ticket branch into the agreed base branch.

## 11. Review and Merge Expectations

- Address all review comments before merge.
- Keep discussion in PR comments for traceability.
- Update branch with latest base if needed and resolve conflicts cleanly.
- Merge only after approvals and required checks pass.

## 12. Things to Avoid

- Force-pushing over teammates' shared work without coordination.
- Large mixed PRs containing multiple features.
- Renaming/removing core keys/envs without migration plan.
- Skipping validation steps.

## 13. Need Help?

If requirements are unclear:

1. Ask for ticket clarification before implementing.
2. Document assumptions in the PR.
3. Prefer early draft PR for feedback on large changes.
