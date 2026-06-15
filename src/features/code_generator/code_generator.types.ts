export interface CodeConfig {
  id: string
  code_type: string
  prefix: string
  reset_type: string // global | daily | monthly | yearly
  date_format: string | null // YYYYMM | YYMMDD | YYYY | null (global)
  sequence_length: number
  is_active: number // 0/1
}
