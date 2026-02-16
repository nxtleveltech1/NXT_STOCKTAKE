"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BarcodeScanner } from "@/components/barcode-scanner"
import type { StockItem } from "@/lib/stock-store"
import { updateStockItem, type UpdateStockItemInput } from "@/lib/stock-api"
import { Check, Minus, Plus, Package, ScanBarcode } from "lucide-react"

const schema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  barcode: z.string().optional(),
  uom: z.string().optional(),
  location: z.string().min(1, "Location is required"),
  category: z.string().optional(),
  supplier: z.string().optional(),
  countedQty: z.union([z.number().min(0), z.literal("")]),
})

type FormValues = z.infer<typeof schema>

type ProductProfileSheetProps = {
  item: StockItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  locations: string[]
  uoms: string[]
  suppliers: string[]
  onSuccess: () => void
}

export function ProductProfileSheet({
  item,
  open,
  onOpenChange,
  locations,
  uoms,
  suppliers,
  onSuccess,
}: ProductProfileSheetProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: "",
      name: "",
      barcode: "",
      uom: "",
      location: "",
      category: "",
      supplier: "",
      countedQty: "" as number | "",
    },
  })

  const ALLOWED_LOCATIONS = ["NXT/NXT STOCK", "NXT/NXT STOCK/Rental"]

  useEffect(() => {
    if (item && open) {
      setShowBarcodeScanner(false)
      const location = ALLOWED_LOCATIONS.includes(item.location)
        ? item.location
        : ALLOWED_LOCATIONS[0]
      form.reset({
        sku: item.sku,
        name: item.name,
        barcode: item.barcode ?? "",
        uom: item.uom ?? "",
        location,
        category: item.category ?? "",
        supplier: item.supplier ?? "",
        countedQty: item.countedQty ?? ("" as number | ""),
      })
    }
  }, [item, open, form])

  const EDITABLE_LOCATIONS = ["NXT/NXT STOCK", "NXT/NXT STOCK/Rental"]
  const locationsForSelect = locations.filter((l) =>
    EDITABLE_LOCATIONS.includes(l)
  )

  const onSubmit = async (values: FormValues) => {
    if (!item) return
    const countedQty =
      values.countedQty === "" ? undefined : Number(values.countedQty)
    const data: UpdateStockItemInput = {
      sku: values.sku,
      name: values.name,
      barcode: values.barcode || null,
      uom: values.uom || null,
      location: values.location,
      category: values.category || null,
      supplier: values.supplier || null,
    }
    if (countedQty !== undefined) data.countedQty = countedQty

    await updateStockItem(item.id, data)
    onSuccess()
    onOpenChange(false)
  }

  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)

  const adjustCount = (delta: number) => {
    const current = form.getValues("countedQty")
    const num = current === "" ? 0 : Number(current)
    form.setValue("countedQty", Math.max(0, num + delta))
  }

  if (!item) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Profile
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 pr-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-6 pt-4"
            >
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input {...field} className="font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description / Name</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} className="resize-none" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Barcode</FormLabel>
                      <Button
                        type="button"
                        variant={showBarcodeScanner ? "default" : "outline"}
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => setShowBarcodeScanner((p) => !p)}
                      >
                        <ScanBarcode className="h-3.5 w-3.5" />
                        {showBarcodeScanner ? "Hide" : "Scan"}
                      </Button>
                    </div>
                    {showBarcodeScanner && (
                      <BarcodeScanner
                        active={showBarcodeScanner}
                        onScan={(value) => {
                          field.onChange(value)
                          setShowBarcodeScanner(false)
                        }}
                        onError={(msg) => {
                          if (msg && !msg.includes("No barcode found")) {
                            console.warn("Barcode scan error:", msg)
                          }
                        }}
                        className="mb-2"
                      />
                    )}
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Optional – type or scan"
                        className="font-mono"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="uom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit of Measure</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select UOM" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {uoms.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locationsForSelect.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Optional" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-lg border bg-muted/30 p-4">
                <Label className="text-sm font-medium">Stock Count</Label>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Expected: {item.expectedQty}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => adjustCount(-1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <FormField
                    control={form.control}
                    name="countedQty"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            className="h-10 text-center font-mono text-lg"
                            {...field}
                            value={field.value === "" ? "" : field.value}
                            onChange={(e) => {
                              const v = e.target.value
                              field.onChange(v === "" ? "" : Number(v))
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => adjustCount(1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 gap-2">
                  <Check className="h-4 w-4" />
                  Save & Update Count
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
