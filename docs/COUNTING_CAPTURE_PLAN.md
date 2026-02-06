# Physical Counting Capture — Implementation Plan

## Executive Summary

Implement end-to-end physical counting capture: product lookup (search/barcode scan), quantity entry, persistence, audit trail, and activity feed. Ensure no breaking changes to existing flows.

---

## 1. Current State Analysis

### 1.1 Existing Modules

| Module | Path | Purpose | Status |
|--------|------|---------|--------|
| QuickCount | `components/quick-count.tsx` | Search → select → count → submit | Search + manual count works; scan mode placeholder only |
| Stock API Items | `app/api/stock/items/route.ts` | GET items with filters | Search: sku, name only; **no barcode** |
| Stock API PATCH | `app/api/stock/items/[id]/route.ts` | Update count | Hardcoded `lastCountedBy: "User"` |
| Session API | `app/api/stock/session/route.ts` | Session stats | Live from StockItem aggregates |
| Zones API | `app/api/stock/zones/route.ts` | Zone progress | Live from StockItem by location |
| StockTable | `components/stock-table.tsx` | Browse items, click to count | Uses `onSelectItem` → switches to Count tab |
| ActivityFeed | `components/activity-feed.tsx` | Live activity | **Simulated fake events** |
| SessionStats | `components/session-stats.tsx` | Counted/variance/verified | Live from session API |
| ZoneProgress | `components/zone-progress.tsx` | Per-zone progress | Live from zones API |

### 1.2 Data Model

- **StockItem**: id, sku, name, barcode, location, expectedQty, countedQty, variance, status, lastCountedBy, lastCountedAt, ...
- **StockSession**: id, organizationId, name, status, totalItems, countedItems, varianceItems, verifiedItems, ...
- **StockActivity**: exists — count/variance events; activity API returns them (currently empty, not populated on count)

### 1.3 Gaps

1. Items API does not search by `barcode`.
2. QuickCount "Scan" mode toggles placeholder only; no camera/scanner.
3. `lastCountedBy` is hardcoded; should use Clerk user.
4. Activity feed uses fake events; no real count events.
5. No CountRecord model for audit/activity.

---

## 2. Target Architecture

### 2.1 Flow

```
[Physical Product] → [Scan barcode / Search SKU] → [Select item] → [Enter qty] → [Confirm]
                                                       ↓
                                          PATCH /api/stock/items/:id
                                                       ↓
                                          StockItem updated + CountRecord created
                                                       ↓
                                          Session stats, zones, activity feed refresh
```

### 2.2 Module Map

| Area | Change | Risk |
|------|--------|------|
| API Items GET | Add barcode to search | Low |
| API PATCH | Clerk auth + CountRecord | Low |
| QuickCount | html5-qrcode camera scanner | Medium (new dep) |
| ActivityFeed | Consume real CountRecords | Low |
| DB | Add CountRecord model | Low (migration) |

---

## 3. Detailed Implementation Plan

### 3.1 Database

**Add CountRecord model** (Prisma):

```prisma
model CountRecord {
  id           String   @id @default(cuid())
  stockItemId  String
  stockItem    StockItem @relation(fields: [stockItemId], references: [id], onDelete: Cascade)
  countedQty   Int
  variance     Int
  countedBy    String   // Clerk user id or name
  countedAt    DateTime @default(now())

  @@index([stockItemId])
  @@index([countedAt])
}
```

- StockItem: add `countRecords CountRecord[]` relation.
- Migration: create table, add FK, index.

### 3.2 API Layer

**GET /api/stock/items**

- Extend `where.OR` to include `{ barcode: { contains: search, mode: 'insensitive' } }` when search is provided.
- Add `{ barcode: { equals: search } }` for exact barcode match (scans often exact).

**PATCH /api/stock/items/[id]**

- Require auth (Clerk); return 401 if unauthenticated.
- Use `auth().userId` or user fullName for `lastCountedBy`.
- After updating StockItem, create CountRecord with stockItemId, countedQty, variance, countedBy, countedAt.
- Return same shape as today for backward compatibility.

**GET /api/stock/activity** (new)

- Query CountRecords ordered by countedAt desc, limit 50.
- Join StockItem for name, sku, location.
- Return events: { id, type: 'count'|'variance', itemName, itemSku, location, qty, variance, user, timestamp }.

### 3.3 Frontend

**QuickCount**

- Add `html5-qrcode` dependency.
- When `showScanner === true`:
  - Render camera container div (`id="barcode-reader"`).
  - Use `Html5Qrcode` with formats: EAN_13, UPC_A, CODE_128, QR_CODE.
  - On scan success: set `onSearchChange(decodedText)` and optionally auto-select first match.
  - Stop scanner when switching to Manual or unmounting.
- When `showScanner === false`: keep existing search UX.
- Debounce/cooldown after scan to avoid duplicate triggers.

**ActivityFeed**

- Replace simulated events with `useQuery` on `/api/stock/activity`.
- Poll or refetch on count mutation success (queryClient.invalidateQueries).
- Map API response to existing `ActivityEvent` shape.

**stock-api.ts**

- Add `fetchActivity(): Promise<ActivityEvent[]>`.
- No changes to `updateItemCount` signature; backend handles CountRecord.

### 3.4 Auth Integration

- API route `/api/stock/items/[id]` PATCH: `const { userId } = await auth()`; use `userId` or fetch user for display name.
- API route `/api/stock/activity` GET: protected by same middleware; no additional checks.

---

## 4. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| html5-qrcode breaks SSR | Dynamic import with `next/dynamic` and `ssr: false` for scanner component |
| Camera permissions denied | Show fallback message; keep manual search always available |
| Breaking existing PATCH | Keep response shape; add CountRecord as side-effect |
| Session/zones stats break | No change to aggregation logic; CountRecord is additive |

---

## 5. File Change Summary

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add CountRecord, StockItem relation |
| `prisma/migrations/...` | New migration |
| `app/api/stock/items/route.ts` | Add barcode to search |
| `app/api/stock/items/[id]/route.ts` | Clerk auth, CountRecord create |
| `app/api/stock/activity/route.ts` | **New** GET handler |
| `lib/stock-api.ts` | Add fetchActivity |
| `components/quick-count.tsx` | Integrate html5-qrcode scanner |
| `components/activity-feed.tsx` | Use real activity API |
| `app/page.tsx` | Pass activity fetch to ActivityFeed (or use query inside) |
| `package.json` | Add html5-qrcode |

---

## 6. Verification Checklist

- [x] Search by barcode returns correct items (items API OR includes barcode)
- [x] PATCH updates count, variance, status, lastCountedBy, lastCountedAt
- [x] StockActivity created on each count (existing model)
- [x] Camera scanner works via html5-qrcode (EAN_13, UPC_A, CODE_128, QR)
- [x] Manual search still works when scanner unavailable
- [x] Activity feed shows real count events (fetchActivity + 10s poll)
- [x] Session stats and zone progress unchanged
- [x] StockTable onSelectItem switches to Count tab
- [x] Build passes

---

## 7. Implementation Summary (Completed)

1. **API items GET** – Added barcode to search OR (length >= 2)
2. **API PATCH** – Already had auth, StockActivity creation, currentUser displayName
3. **lib/stock-api** – Added fetchActivity, ActivityEvent type
4. **html5-qrcode** – Installed; BarcodeScanner component with camera
5. **QuickCount** – Integrated BarcodeScanner, auto-select on single match
6. **ActivityFeed** – Uses real events from API, removed simulation
7. **Page** – useQuery for activity, refetchInterval 10s
