import { ulid } from '../../../lib/ulid'
import type { CodeConfig } from '../code_generator.types'

const ISO = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"

/**
 * Token-parses date_format: replaces YYYY/YY/MM/DD, keeps literals (so 'YYYYMM-'
 * → '202606-', 'YYYY-MM' → '2026-06', etc.). null/empty → no date segment.
 */
function formatDate(fmt: string | null, d: Date): string {
  if (!fmt) return ''
  const yyyy = String(d.getUTCFullYear())
  const yy = yyyy.slice(-2)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  // YYYY before YY so the 4-char token wins.
  return fmt.replace(/YYYY/g, yyyy).replace(/YY/g, yy).replace(/MM/g, mm).replace(/DD/g, dd)
}

/** period_key from reset_type — the counter-reset boundary. */
function periodKey(resetType: string, d: Date): string {
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  switch (resetType) {
    case 'daily':
      return `${yyyy}-${mm}-${dd}`
    case 'monthly':
      return `${yyyy}-${mm}`
    case 'yearly':
      return `${yyyy}`
    case 'global':
    default:
      return 'global'
  }
}

export class CodeGeneratorError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export const codeGeneratorService = {
  /**
   * Generate the next code for a code_type. Atomic sequence allocation via
   * UPSERT+RETURNING — concurrent calls never receive the same number.
   * Throws CodeGeneratorError('CG_NO_CONFIG') if no active config exists.
   */
  generate: async (db: D1Database, codeType: string, userId: string): Promise<string> => {
    const config = await db
      .prepare(
        `SELECT id, code_type, prefix, reset_type, date_format, sequence_length, is_active
           FROM incremental_code_configs
          WHERE code_type = ? AND is_active = 1 AND deleted_at IS NULL`,
      )
      .bind(codeType)
      .first<CodeConfig>()

    if (!config) {
      throw new CodeGeneratorError('CG_NO_CONFIG', `No active code config for type '${codeType}'`)
    }

    const now = new Date()
    const pk = periodKey(config.reset_type, now)
    const dateStr = formatDate(config.date_format, now)

    const row = await db
      .prepare(
        `INSERT INTO incremental_code_sequences
           (id, code_config_id, period_key, current_sequence, created_by_user_id, updated_by_user_id)
         VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(code_config_id, period_key) WHERE deleted_at IS NULL
         DO UPDATE SET current_sequence = current_sequence + 1,
                       updated_at = ${ISO},
                       updated_by_user_id = excluded.updated_by_user_id
         RETURNING current_sequence`,
      )
      .bind(ulid(), config.id, pk, userId, userId)
      .first<{ current_sequence: number }>()

    if (!row) {
      throw new CodeGeneratorError('CG_SEQ_FAILED', 'Sequence allocation returned no row')
    }

    const seq = String(row.current_sequence).padStart(config.sequence_length, '0')
    return `${config.prefix}${dateStr}${seq}`
  },
}
