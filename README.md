# StockOut Inspection

A portal just for inspection work in the STOCKOUT marketplace. Inspectors sign in, see what's assigned to them,
run the checklist on site, add photo evidence straight from the phone camera and complete the inspection.
They can also follow up corrections and disputes. It uses the same STOCKOUT API gateway and staff accounts as
the admin console, with no extra backend.

Live: https://tsforcetech.github.io/STOCKOUT_INSPECTION/

## Works on every device

| Screen | Navigation | Lists |
|---|---|---|
| Phone (< 768px) | Top bar and a bottom tab bar (Home, My work, All, Corrections, Profile); the menu button opens the full menu | Touch-friendly cards, "More filters" toggle |
| Tablet (768–1023px) | Icon rail sidebar | Tables |
| Desktop (≥ 1024px) | Full sidebar, collapsible | Tables with all filters |

## Screens

| Route | Screen | APIs |
|---|---|---|
| `/login` | Sign in (with MFA, forgot and reset password) | `/api/v1/auth/*` |
| `/` | Dashboard: assigned to me, in progress, completed by me, waiting for an inspector, corrections and disputes follow-ups | `GET /admin/catalog/inspections/queue`, `/listing-corrections`, `/disputes` |
| `/my` | My inspections: To start, In progress, Completed, Cancelled | `queue?assignedInspectorUserId=<me>&status=…` |
| `/inspections` | All inspections with filters; supervisors can create and assign | `queue`, `POST /inspections`, `assign` |
| `/inspections/:id` | Start, checklist answers, evidence (file or **Take photo**), complete, cancel, re-inspection, propose a correction | `start`, `PUT responses`, `evidence`, `complete`, `cancel`, `authorize-reinspection` |
| `/corrections` | Listing corrections proposed after inspection | `/admin/catalog/listing-corrections/*` |
| `/disputes` | Seller appeals against inspection results | `/admin/catalog/disputes/*` |
| `/account` | Profile, password, MFA, sessions | `/api/v1/identity/*` |

## Access

Only accounts with an inspection permission (`inspections.view`, `inspections.perform`, `inspections.assign` or
`inspections.override`) can use the portal. Anyone else who signs in sees "Inspector access only" with a
sign-out button. Within the portal, actions follow the same permissions as the admin console.

## Quick start

```bash
npm ci
cp .env.example .env.local      # optional
npm run dev                     # http://localhost:5173 (proxies /api to VITE_DEV_PROXY_TARGET)
```

| Script | Purpose |
|---|---|
| `npm run build` | Type-check and production build to `dist/` |
| `npm run typecheck` / `npm run lint` / `npm test` | Checks (the deploy workflow runs all three) |

## Deployment

Each push to `main` runs typecheck, lint and tests, then builds with
`VITE_BASE_PATH=/STOCKOUT_INSPECTION/` and `VITE_API_BASE_URL` (repository variable, default
`https://stockout.flowb.io`), and publishes to GitHub Pages. `404.html` is a copy of `index.html`, so deep links
and refreshes work. For IIS hosting, `public/web.config` provides the same fallback.

Sessions are stored under `stockout.inspection.*` keys, so signing in here doesn't affect the admin console on
the same domain.

This repository is public. Don't commit credentials, tokens or data exports.
