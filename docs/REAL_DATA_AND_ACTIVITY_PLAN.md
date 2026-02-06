# Real Data & Activity Monitoring – Plan & Implementation Summary

## 1. Scope

- **Remove** all mock user and mock data across the platform.
- **Replace** with real activity monitoring, real team data, and real session/items/zones from the database and Clerk.

## 2. Modules & Capabilities Mapped

| Module / Area | Before | After |
|---------------|--------|--------|
| **Dashboard (app/page.tsx)** | `EMPTY_TEAM`, `EMPTY_ACTIVITY` passed to TeamPanel and ActivityFeed | Real team from Clerk `useOrganization`; real activity from `GET /api/stock/activity` with `useQuery` + 10s refetch |
| **Team panel** | Received empty array | Receives org members (mapped from Clerk memberships) |
| **Activity feed (activity-feed.tsx)** | Fake `liveMessages` + `setInterval` injecting mock events | Only renders events from props (API); no internal mock or simulation |
| **Stock items PATCH (api/stock/items/[id])** | `lastCountedBy: 'User'`; no activity record | Uses `auth()` + `currentUser()` for real name; writes to `StockActivity` on each count/variance |
| **Activity API** | Did not exist | `GET /api/stock/activity` – reads from `StockActivity`, scoped by `organizationId`, returns list for feed |
| **Session / Items / Zones / Locations** | Already from DB via existing APIs | Unchanged (already real) |
| **Prisma** | No activity table | New `StockActivity` model; migration applied (Neon + local migration file) |

## 3. Data Flow (Real)

- **Session:** `GET /api/stock/session` → Prisma `StockSession` (or computed default).
- **Items:** `GET /api/stock/items` → Prisma `StockItem`; `PATCH` updates item and creates `StockActivity`, uses Clerk user for `lastCountedBy` and activity `userName`.
- **Zones:** `GET /api/stock/zones` → Prisma `StockItem.groupBy` by location (real counts).
- **Locations:** `GET /api/stock/locations` → Prisma distinct locations.
- **Team:** Clerk `useOrganization({ memberships })` → mapped to `TeamMember[]` for TeamPanel.
- **Activity:** `GET /api/stock/activity` → Prisma `StockActivity` (org-scoped); dashboard polls every 10s; each count/variance from PATCH inserts a row.

## 4. Changes Made (Summary)

1. **Prisma**
   - Added `StockActivity` (id, organizationId, sessionId, type, message, userId, userName, zone, itemId, createdAt) and indexes.
   - Migration applied on Neon (NXT_STOCKTAKE project); local migration file added under `prisma/migrations/`.

2. **API**
   - **PATCH /api/stock/items/[id]:** Uses `auth()` and `currentUser()` for display name; sets `lastCountedBy` and creates `StockActivity` (type `count` or `variance`, message, userName, zone, itemId).
   - **GET /api/stock/activity:** Returns recent `StockActivity` scoped by `organizationId` (or null-org), limit 50; maps to feed shape (id, type, message, user, timestamp, zone).

3. **Client**
   - **lib/stock-api.ts:** Added `fetchActivity(limit)` and `ActivityEvent` type.
   - **app/page.tsx:** Removed `EMPTY_TEAM` and `EMPTY_ACTIVITY`; added `useOrganization` + `mapOrgMembersToTeam` for team; added `useQuery(['stock', 'activity'], fetchActivity, { refetchInterval: 10_000, refetchIntervalInBackground: true })`; passed `teamMembers` and `activityEvents` to TeamPanel and ActivityFeed.
   - **components/activity-feed.tsx:** Removed `useState(initialEvents)`, all `liveMessages`, and `setInterval`; component is purely presentational from `events` prop.

4. **Verification**
   - Build succeeds; no remaining references to `EMPTY_*` or mock activity in app/components.

## 5. What Was Not Changed (No Regressions)

- Session, items, zones, locations APIs and UI unchanged.
- Team management (settings/team, Clerk invite/remove/role) unchanged.
- Middleware, auth, and org requirement unchanged.
- Stock table, quick count, session stats, zone progress unchanged except that they now receive only real data (team and activity from API/Clerk).

## 6. Optional Next Steps (Not Done)

- **Join / zone_complete events:** Could be added when a user opens the dashboard (join) or when a zone is marked complete (e.g. manual action or threshold).
- **Verify events:** If you add an explicit “verify” action, create a `StockActivity` with type `verify`.
- **Zone assignee:** Zones API currently returns `assignee: ''`; could later be derived from recent activity or a dedicated assignment model.
- **Real-time:** For true live updates without polling, consider WebSockets or Server-Sent Events; current 10s refetch is a simple, robust approach.
