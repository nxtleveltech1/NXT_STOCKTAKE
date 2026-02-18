# NXT Stocktake Full System Review and Enhancement Plan

**Last updated:** With resolved decisions (Part 6)

---

## Part 6: Resolved Decisions (No Open Questions)

| Question | Decision |
|----------|----------|
| **StockItem organizationId** | Add now. Single org only: **NXT STOCK**. Ensure 100% implementation of org scoping across all modules. |
| **Default session** | Use explicit **Start Session** function. No auto-create on first visit. Require user to start session. |
| **Report format** | Create **PDF creation and preview** function. Not HTML-only. |
| **meta-WhatsApp MCP** | **No WhatsApp integration required.** Remove from scope. |

---

## Part 1: Current Architecture Map

- **Frontend:** app/page.tsx, StockHeader, SessionStats, ZoneProgress, TeamPanel, ActivityFeed, QuickCount, StockTable, ProductProfileSheet, AssignZonesSheet
- **API:** GET/PATCH session, GET items, PATCH items/[id], GET zones, PATCH zones/assign, GET activity, GET export, GET report, GET locations, ref APIs
- **DB:** StockItem, StockSession, StockActivity, ZoneAssignment
- **Auth:** Clerk, middleware.ts

---

## Part 2: Module-by-Module Assessment

### Session Lifecycle
- **Before:** No session in DB → synthetic default; PATCH returns 404. Need explicit Start Session.
- **During:** Pause/Resume works. Block count when paused/completed.
- **After:** Status = completed. Add Start New Session action.

### Actions Dropdown
- Export, Report, Assign Zones, End Session implemented. Add Start Session when no active session.
- Mobile: Expose Actions in mobile menu.

### Counting Flow
- Block count when session paused/completed (QuickCount, ProductProfileSheet, Item PATCH API).
- Add Verify action for variance items.

### Team and Zones
- TeamPanel: Sync zone and itemsCounted from ZoneAssignment + Activity.
- ZoneProgress and ZoneAssignment: Working.

### Activity
- Add join/zone_complete events.
- Add empty state ("No activity yet").

### API Security
- Add auth() to items, export, report, locations, ref APIs.
- Scope all data by NXT STOCK org.

---

## Part 3: New Features (Prioritized)

### Tier 1: Critical
1. Block count when paused/completed
2. Start Session flow (POST /api/stock/session, Start Session in Actions)
3. API auth and NXT STOCK org-scoping
4. StockItem organizationId (or session-based org scoping) — single org NXT STOCK

### Tier 2: High Value
5. Verify action
6. Team member stats sync (zone, itemsCounted)
7. Join/zone_complete events
8. Mobile Actions

### Tier 3: Enhanced
9. PDF report creation and preview
10. Session history
11. Variance resolution workflow
12. Real-time updates (SSE/WebSocket)
13. Empty states

### Out of Scope
- WhatsApp integration (removed)

---

## Part 4: Implementation Plan

### Phase 1: Session Integrity
- Block count when paused/completed
- POST /api/stock/session (create)
- Start Session in Actions
- API auth + NXT STOCK org-scoping

### Phase 2: Verify and Team Stats
- Verify action
- Team zone/itemsCounted
- Join/zone_complete events
- Mobile Actions

### Phase 3: Polish
- PDF report creation and preview
- Empty states
- Session history

---

## Part 5: Execution Order

1. Phase 1.1 — Block count when paused/completed
2. Phase 1.2 — POST session create + Start Session action
3. Phase 1.3 — API auth + NXT STOCK org-scoping
4. Phase 2.1 — Verify action
5. Phase 2.2 — Team stats
6. Phase 2.3 — Join/zone_complete events
7. Phase 2.4 — Mobile Actions
8. Phase 3.1 — PDF report creation and preview
9. Phase 3.2 — Empty states

---

## Part 6: Files to Modify (Summary)

| Area | Files |
|------|-------|
| Block count | app/page.tsx, quick-count.tsx, product-profile-sheet.tsx, items/[id]/route.ts |
| Start Session | session/route.ts, stock-api.ts, stock-header.tsx, page.tsx |
| API auth | export, report, items, locations, categories, warehouses, suppliers, uoms routes |
| Org scoping | All stock APIs; ensure NXT STOCK orgId |
| Verify | stock-table.tsx, product-profile-sheet.tsx, items/[id]/route.ts |
| PDF report | report/route.ts, new PDF lib |
| Team stats | page.tsx, ZoneAssignment + Activity aggregation |
