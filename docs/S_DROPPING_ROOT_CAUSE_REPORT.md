# S-Dropping Bug: Root Cause Report

## Summary

**Root cause:** SheetJS (xlsx) `sheet_to_json(..., { raw: false })` drops the letter "s" when returning formatted cell text.

**Fix:** Use `raw: true` in all `sheet_to_json` calls to preserve raw cell values.

---

## Discovery

- Diagnostic script `scripts/diagnose-s-dropping.ts` compared DB product names with Odoo source
- Result: 20/20 sampled items showed DB ≠ Odoo; DB had dropped "s" (e.g. "Bass" → "Ba ", "Classic" → "Cla ic", "Acoustic" → "Acou tic")
- Odoo MCP returns correct data; bug is in ingest path

## Identification

- All Excel-based ingest uses `XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })`
- `raw: false` returns formatted display text; SheetJS formatting path corrupts "s"
- Affected files: seed-from-excel, seed-data-vault, restore-nxt-stock, import route, diagnose scripts

## Resolution

1. **Preventive:** Changed `raw: false` → `raw: true` in:
   - `scripts/seed-from-excel.ts`
   - `scripts/seed-data-vault.ts`
   - `scripts/restore-nxt-stock.ts`
   - `app/api/stock/items/import/route.ts`
   - `scripts/diagnose-missing-skus.ts`
   - `scripts/diagnose-s-dropping.ts`

2. **Corrective:** One-time fix script `scripts/fix-s-dropping.ts`:
   - Fetches correct names from Odoo for suspected corrupted items
   - Updates DB. Run: `bun run scripts/fix-s-dropping.ts` (use `--dry-run` first)

## Verification

- Re-seed from Excel with `raw: true` will preserve "s"
- Run `bun run scripts/fix-s-dropping.ts --dry-run` to preview corrections
- Run `bun run scripts/diagnose-s-dropping.ts` after fix; mismatches should drop to 0
