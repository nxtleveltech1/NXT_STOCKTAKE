export const ISSUE_CLASSIFICATIONS = [
  { value: "missing_item", label: "Missing Item" },
  { value: "new_product", label: "New Product" },
  { value: "incorrect_location", label: "Incorrect Location" },
  { value: "remove", label: "Remove" },
  { value: "duplication", label: "Duplication" },
  { value: "incorrect_description", label: "Incorrect Description" },
  { value: "incorrect_quantity", label: "Incorrect Quantity" },
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
