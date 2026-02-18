# NXT_STOCKTAKE Setup

## 1. Clerk (required for build)

1. Create app at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Copy API keys to `.env.local`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

## 2. Neon

`DATABASE_URL` is pre-configured in `.env.local` for project **NXT_STOCKTAKE** (dry-snow-96214771).

## 3. Seed from Excel

```bash
bun run seed
```

Seeds 12,000 stock items from `odoo_soh_full_20260206_124339.xlsx`. Re-run to truncate and re-seed.

## 4. Invite team members

```bash
bun run invite:team
```

Adds Clerk users to the NXT Level Tech org. Uses `createOrganizationMembership` for existing users, `createOrganizationInvitation` for others. Optional: set `CLERK_ORG_ID` in `.env.local` to target a specific org.

**Stock item org scoping:** After migrations, run `bun run scripts/backfill-stock-item-org.ts` to set `organizationId` on existing StockItems. Requires `CLERK_ORG_ID` in `.env.local` (NXT STOCK org ID from Clerk).

## 5. Run

```bash
bun install
bun run dev
```

Routes: `/sign-in`, `/sign-up`. Protected routes require auth.
