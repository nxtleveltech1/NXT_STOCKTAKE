import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const TEMPLATE_CSV = `SKU,Name,Location,Expected,Counted,Counted By,Counted At,Barcode,UOM,Category,Supplier,Warehouse,Serial Number,Owner,Verified
SKU-001,Sample Product,NXT/NXT STOCK,1,,,,"",Each,Electronics,,,,"","",`

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 403 })

  const csv = TEMPLATE_CSV

  const filename = 'products-import-template.csv'

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
