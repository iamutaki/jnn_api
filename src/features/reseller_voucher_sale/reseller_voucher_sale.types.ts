// DB row — mirrors reseller_voucher_sales table 1:1 (snake_case).
export interface ResellerVoucherSale {
  id: string
  reseller_id: string
  sale_no: string
  sale_date: string // YYYY-MM-DD
  sale_month: string // YYYY-MM
  total_qty: number
  total_amount: number // whole rupiah (matches vouchers.price)
  status: string // draft | completed | cancelled
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  created_by_user_id: string | null
  updated_by_user_id: string | null
  deleted_by_user_id: string | null
}

// DB row — mirrors reseller_voucher_sale_items table 1:1 (snake_case).
export interface ResellerVoucherSaleItem {
  id: string
  sale_id: string
  voucher_id: string
  qty: number
  unit_price: number
  total_amount: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  created_by_user_id: string | null
  updated_by_user_id: string | null
  deleted_by_user_id: string | null
}

// List item — header summary only. createdAt/updatedAt/deletedAt omitted
// (see README.md field-visibility rules).
export interface ResellerVoucherSaleListItem {
  id: string
  resellerId: string
  saleNo: string
  saleDate: string
  saleMonth: string
  totalQty: number
  totalAmount: number
  status: string
  completedAt: string | null
  cancelledAt: string | null
}

// A sale item in the detail response — includes the allocated codes' METADATA
// (id + status). The plaintext code is NEVER exposed here; use the digital_voucher
// detail endpoint to reveal a single code if authorized.
export interface SaleItemResponse {
  id: string
  voucherId: string
  qty: number
  unitPrice: number
  totalAmount: number
  allocatedCodes: { id: string; status: string }[]
}

// Detail — header + items (+ allocated code metadata per item).
export interface ResellerVoucherSaleDetail extends ResellerVoucherSaleListItem {
  items: SaleItemResponse[]
}

export interface CreateSaleItemRequest {
  voucherId: string
  qty: number
  unitPrice?: number // optional → defaults to vouchers.price
}

export interface CreateResellerVoucherSaleRequest {
  // resellerId is NOT accepted from the body — it's resolved server-side from the caller:
  // a reseller user is attributed to their own id; a non-reseller (admin) to the System
  // fallback reseller (see SYSTEM_RESELLER_ID).
  saleDate: string
  saleMonth?: string // optional → derived from saleDate (YYYY-MM-DD → YYYY-MM)
  saleNo?: string // optional → auto-generated from incremental_code_configs ('sale')
  items: CreateSaleItemRequest[]
}

export interface UpdateResellerVoucherSaleRequest {
  saleDate?: string
  saleMonth?: string
  saleNo?: string
  items?: CreateSaleItemRequest[]
}

// Audit log entry (append-only).
export interface ResellerVoucherSaleLog {
  id: string
  saleId: string
  action: string // created | completed | cancelled
  oldStatus: string | null
  newStatus: string
  changedByUserId: string | null
  changedAt: string
  note: string | null
}
