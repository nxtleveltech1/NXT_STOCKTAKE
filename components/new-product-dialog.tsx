"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { getLocationDisplayName } from "@/lib/locations"
import {
  createStockItem,
  updateIssue,
  fetchLocations,
  fetchUoms,
  fetchSuppliers,
} from "@/lib/stock-api"
import { Package, ScanBarcode } from "lucide-react"
import { toast } from "sonner"

const schema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  location: z.string().min(1, "Location is required"),
  expectedQty: z.coerce.number().min(0),
  barcode: z.string().optional(),
  uom: z.string().optional(),
  category: z.string().optional(),
  supplier: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type NewProductDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultLocation?: string | null
  defaultName?: string | null
  issueId: string | null
  onSuccess: () => void
}

export function NewProductDialog({
  open,
  onOpenChange,
  defaultLocation,
  defaultName,
  issueId,
  onSuccess,
}: NewProductDialogProps) {
  const queryClient = useQueryClient()
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)

  const { data: locations = [] } = useQuery({
    queryKey: ["stock", "locations"],
    queryFn: fetchLocations,
    enabled: open,
  })

  const { data: uoms = [] } = useQuery({
    queryKey: ["stock", "uoms"],
    queryFn: fetchUoms,
    enabled: open,
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ["stock", "suppliers"],
    queryFn: fetchSuppliers,
    enabled: open,
  })

  const assignableLocations = useMemo(
    () => locations.filter((l) => l !== "All Zones"),
    [locations]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: "",
      name: "",
      location: "",
      expectedQty: 1,
      barcode: "",
      uom: "",
      category: "",
      supplier: "",
    },
  })

  useEffect(() => {
    if (open) {
      setShowBarcodeScanner(false)
      const loc =
        defaultLocation && assignableLocations.includes(defaultLocation)
          ? defaultLocation
          : assignableLocations[0] ?? ""
      form.reset({
        sku: "",
        name: defaultName ?? "",
        location: loc,
        expectedQty: 1,
        barcode: "",
        uom: "",
        category: "",
        supplier: "",
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form ref is stable
  }, [open, defaultLocation, defaultName, assignableLocations])

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      createStockItem({
        sku: values.sku,
        name: values.name,
        location: values.location,
        expectedQty: values.expectedQty,
        barcode: values.barcode || null,
        uom: values.uom || null,
        category: values.category || null,
        supplier: values.supplier || null,
      }),
    onSuccess: async (_, __, context) => {
      if (issueId) {
        await updateIssue(issueId, { status: "closed" })
        queryClient.invalidateQueries({ queryKey: ["stock", "issue", issueId] })
      }
      queryClient.invalidateQueries({ queryKey: ["stock", "issues"] })
      queryClient.invalidateQueries({ queryKey: ["stock", "items"] })
      onSuccess()
      onOpenChange(false)
      toast.success("Product added and issue closed")
    },
    onError: () => toast.error("Failed to add product"),
  })

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            New product
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col overflow-hidden"
          >
        <ScrollArea className="flex-1 min-h-0 max-h-[50vh] pr-4">
          <div className="flex flex-col gap-4 pt-2 pb-4">
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
                        onInvalidBarcode={(_, error) => {
                          toast.error(`Invalid barcode: ${error}`)
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
                        {assignableLocations.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {getLocationDisplayName(loc)}
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
                name="expectedQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? 0
                              : Number(e.target.value)
                          )
                        }
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
          </div>
        </ScrollArea>

        <div className="flex shrink-0 gap-2 border-t pt-4 mt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={createMutation.isPending}
              >
                Save & publish product
              </Button>
        </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
