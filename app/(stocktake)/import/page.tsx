"use client"

import { useState, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { StockHeader } from "@/components/stock-header"
import {
  fetchStockSession,
  importStockItems,
  type ImportStockItemsResult,
} from "@/lib/stock-api"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Download, Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"
import { ALLOWED_LOCATIONS } from "@/lib/locations"

const ACCEPTED_TYPES = ".csv,.xlsx,.xls"
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export default function ImportPage() {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult] = useState<ImportStockItemsResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: session } = useQuery({
    queryKey: ["stock", "session"],
    queryFn: fetchStockSession,
  })

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (!dropped) return
    const ext = dropped.name.split(".").pop()?.toLowerCase()
    if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
      toast.error("Use CSV or XLSX files only")
      return
    }
    if (dropped.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum 5MB.")
      return
    }
    setFile(dropped)
    setResult(null)
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    const ext = selected.name.split(".").pop()?.toLowerCase()
    if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
      toast.error("Use CSV or XLSX files only")
      return
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum 5MB.")
      return
    }
    setFile(selected)
    setResult(null)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!file) {
      toast.error("Select a file first")
      return
    }
    setIsSubmitting(true)
    setResult(null)
    try {
      const res = await importStockItems(file)
      setResult(res)
      queryClient.invalidateQueries({ queryKey: ["stock", "items"] })
      if (res.created > 0) {
        toast.success(`Imported ${res.created} product${res.created !== 1 ? "s" : ""}`)
      }
      if (res.failed > 0 && res.errors.length > 0) {
        toast.error(`${res.failed} row${res.failed !== 1 ? "s" : ""} failed validation`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed")
    } finally {
      setIsSubmitting(false)
    }
  }, [file, queryClient])

  const handleReset = useCallback(() => {
    setFile(null)
    setResult(null)
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      {session && (
        <StockHeader session={session} onlineMembers={[]} />
      )}
      <main className="flex-1 px-4 py-6 lg:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/" aria-label="Back to dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Bulk Import Products</h1>
              <p className="text-sm text-muted-foreground">
                Upload a CSV or XLSX file to add new products in bulk
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload file
              </CardTitle>
              <CardDescription>
                Download the template, fill in your products, then upload. Required columns:
                SKU, Name, Location, Expected. Max 5,000 rows, 5MB.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href="/api/stock/items/import/template" download="products-import-template.csv">
                    <Download className="h-3.5 w-3.5" />
                    Download template
                  </a>
                </Button>
                <span className="text-xs text-muted-foreground">
                  Allowed locations: {ALLOWED_LOCATIONS.join(", ")}
                </span>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
              >
                <input
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={handleFileChange}
                  className="hidden"
                  id="import-file"
                />
                <label
                  htmlFor="import-file"
                  className="cursor-pointer"
                >
                  <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {file ? file.name : "Drag and drop or click to select"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    CSV or XLSX, max 5MB
                  </p>
                </label>
              </div>

              {file && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Importing…" : `Import ${file.name}`}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    Clear
                  </Button>
                </div>
              )}

              {result && result.created > 0 && (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-4">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
                  <div>
                    <p className="font-medium">Imported {result.created} product{result.created !== 1 ? "s" : ""}</p>
                    <p className="text-sm text-muted-foreground">
                      <Link href="/" className="underline hover:no-underline">
                        View in stock table
                      </Link>
                    </p>
                  </div>
                </div>
              )}

              {result && result.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                  <p className="font-medium text-destructive">
                    {result.failed} row{result.failed !== 1 ? "s" : ""} failed
                  </p>
                  <ul className="mt-2 max-h-40 overflow-y-auto text-sm">
                    {result.errors.slice(0, 20).map((err, i) => (
                      <li key={i}>
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                    {result.errors.length > 20 && (
                      <li className="text-muted-foreground">
                        …and {result.errors.length - 20} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
