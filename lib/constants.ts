export const ISSUE_CLASSIFICATIONS = [
  { value: "stock_damage", label: "Stock Damage" },
  { value: "missing_item", label: "Missing Item" },
  { value: "incorrect_quantity", label: "Incorrect Quantity" },
  { value: "incorrect_item", label: "Incorrect Item" },
  { value: "location_discrepancy", label: "Location Discrepancy" },
  { value: "system_error", label: "System Error" },
  { value: "supplier_error", label: "Supplier Error" },
  { value: "shipping_error", label: "Shipping Error" },
  { value: "quality_control_fail", label: "Quality Control Fail" },
  { value: "audit_flag", label: "Audit Flag" },
  { value: "other", label: "Other" },
] as const

export type IssueClassificationValue =
  (typeof ISSUE_CLASSIFICATIONS)[number]["value"]

export const VARIANCE_CLASSIFICATIONS = [
  { value: "counting_error", label: "Counting Error" },
  { value: "data_entry_error", label: "Data Entry Error" },
  { value: "location_mismatch", label: "Location Mismatch" },
  { value: "damaged_unusable", label: "Damaged/Unusable" },
  { value: "missing_from_expected", label: "Missing from Expected" },
  { value: "extra_found", label: "Extra/Found" },
  { value: "system_sync", label: "System Sync" },
  { value: "other", label: "Other" },
] as const
