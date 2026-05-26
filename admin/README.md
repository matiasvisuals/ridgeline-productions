# Ridgeline Admin Dashboard — Setup

The admin dashboard lives at `/admin` on the deployed site. It lets the team
edit projects, About copy, the Creatives roster, and What We Do copy without
touching code.

## How it works

```
┌────────────┐   Save Draft    ┌──────────┐   Publish    ┌──────────┐   deploy   ┌────────────┐
│  /admin    │ ──────────────▶ │ Vercel KV│ ───────────▶ │ GitHub   │ ─────────▶ │ Live site  │
│  (browser) │                 │ (draft)  │              │ (commit) │            │            │
└────────────┘                 └──────────┘              └──────────┘            └────────────┘
```

- **Save Draft** writes the working copy to Vercel KV under one key. The
  team can preview the draft at `/?draft=1` (a small "DRAFT PREVIEW" badge
  shows in the bottom-left).
- **Publish** commits `data/content.json` to GitHub via the Contents API.
  Vercel auto-deploys the new commit. The draft in KV is cleared.
- The live site loads `data/content.json` at page load and hydrates the
  About, Creatives, What We Do, and project data into the DOM.

## Required environment variables (set in Vercel → Project → Settings → Environment Variables)

| Name | Value | Where to get it |
| --- | --- | --- |
| `ADMIN_PASSWORD` | The shared team password | You pick it. Strong, random. |
| `SESSION_SECRET` | 32+ char random string | `openssl rand -hex 32` |
| `GITHUB_TOKEN` | GitHub PAT with `repo` scope | github.com/settings/tokens (fine-grained, contents: write on this repo) |
| `GITHUB_REPO` | `owner/repo` | e.g. `matiasvisuals/ridgeline-productions` |
| `GITHUB_BRANCH` | (optional) defaults to `main` | only set if your deploy branch isn't `main` |

Plus these from **Vercel KV** (auto-injected when you connect a KV store
to the project):

| Name | Source |
| --- | --- |
| `KV_REST_API_URL` | Vercel KV integration |
| `KV_REST_API_TOKEN` | Vercel KV integration |

## One-time Vercel setup

1. Go to the Vercel project → **Storage** → **Create Database** → **KV**.
2. Connect it to this project (production + preview).
3. Add the four manual env vars above (`ADMIN_PASSWORD`, `SESSION_SECRET`,
   `GITHUB_TOKEN`, `GITHUB_REPO`).
4. Redeploy.

## Team workflow

1. Go to `https://<site>/admin`.
2. Enter the shared password.
3. Make edits in the tabs (Projects / About / Creatives / What We Do).
4. **Save Draft** to persist changes server-side, then click
   **Preview draft** to open the site with your changes applied.
5. When happy, **Publish** to deploy to the live site (~30–60s).

## Local development

```bash
npm install
npx vercel dev
```

For draft persistence locally, connect to a Vercel KV instance using
`npx vercel env pull .env.development.local` first.

## File map

- `admin/index.html` — dashboard shell
- `admin/admin.css` — styles
- `admin/admin.js` — UI logic, form bindings, save/publish
- `api/login.js` — POST `/api/login` → sets session cookie
- `api/logout.js` — POST `/api/logout`
- `api/me.js` — GET `/api/me` → session check
- `api/content.js` — GET `/api/content?draft=1` → returns draft or published
- `api/save-draft.js` — POST → writes to KV
- `api/publish.js` — POST → commits to GitHub
- `api/_lib/auth.js` — HMAC signed cookies
- `api/_lib/store.js` — KV + published JSON reader
- `api/_lib/github.js` — GitHub Contents API client
- `data/content.json` — published content (source of truth)
- `data-loader.js` — site-side hydration script
