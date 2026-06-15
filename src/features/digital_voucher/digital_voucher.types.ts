// DB row — mirrors digital_voucher_imports table 1:1 (snake_case).
export interface DigitalVoucherImport {
  id: string
  voucher_id: string
  sub_district_id: string | null
  total_codes: number
  notes: string | null
  created_at: string
  created_by_user_id: string
}

// DB row — mirrors digital_vouchers table 1:1 (snake_case). The plaintext code is
// never on this object; only the crypto material + hash.
export interface DigitalVoucher {
  id: string
  voucher_id: string
  sub_district_id: string | null
  import_id: string | null
  code_hash: string
  encrypted_code: string
  encryption_iv: string
  encryption_tag: string
  encryption_key_version: number
  status: string
  sold_to_reseller_id: string | null
  sold_sale_id: string | null
  sold_at: string | null
  sold_by_user_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  created_by_user_id: string | null
  updated_by_user_id: string | null
  deleted_by_user_id: string | null
}

// API response for import history.
export interface DigitalVoucherImportItem {
  id: string
  voucher: {
    id: string
    name: string
    price: number
  }
  subDistrict: {
    id: string
    name: string
    district: {
      id: string
      name: string
    }
  } | null
  totalCodes: number
  notes: string | null
  createdAt: string
  createdByUserId: string
}

// List item — metadata only, NEVER the decrypted code (security + perf).
export interface DigitalVoucherListItem {
  id: string
  voucherId: string
  subDistrictId: string | null
  importId: string | null
  status: string
  soldToResellerId: string | null
  soldSaleId: string | null
  soldAt: string | null
}

// Detail — single-item get. `code` is the plaintext when the caller is authorized (the
// seller of a sold code, sold_by_user_id); otherwise it is the mask "******". Every code
// is non-null in the DB, so "******" always means "exists but you're not allowed to see it".
export interface DigitalVoucherDetail extends DigitalVoucherListItem {
  code: string
}

export interface CreateDigitalVoucherRequest {
  voucherId: string
  subDistrictId?: string | null
  code: string
}

export interface BulkCreateDigitalVoucherRequest {
  items: CreateDigitalVoucherRequest[]
}
