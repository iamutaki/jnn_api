/**
 * Timestamp helper.
 *
 * Project rule (see README.md): all timestamps are stored and returned in
 * **ISO 8601** format — `YYYY-MM-DDTHH:MM:SSZ` in UTC.
 *
 * The source of truth for *stored* time is the DB column (SQL
 * `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` in INSERT/UPDATE/DELETE statements,
 * and `DEFAULT (strftime(...))` at the migration level). This helper exists
 * only for the rare places where TS must mint a timestamp itself (e.g. the
 * error envelope), so those stay consistent with stored values.
 */

const pad = (n: number): string => n.toString().padStart(2, '0')

/**
 * Returns the current UTC time as ISO 8601: `YYYY-MM-DDTHH:MM:SSZ`.
 * Prefer SQL `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` inside DB statements —
 * only use this when you cannot push the timestamp down into SQL.
 */
export function now(): string {
  const d = new Date()
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
  )
}
