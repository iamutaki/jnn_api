/**
 * Simple validation utility for request bodies.
 *
 * Validates fields against rules and returns specific error messages.
 * Auto-trims all string fields in-place before validation.
 * Designed to be lightweight — no external deps needed for prototype.
 */

interface ValidationRule {
  required?: boolean
  type?: 'string' | 'number'
  minLength?: number
  optional?: boolean
}

interface ValidationSchema {
  [key: string]: ValidationRule
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  body: Record<string, unknown>
}

/**
 * Trim all string fields in-place, then validate against schema.
 *
 * Returns { valid, errors, body } where body is the trimmed version.
 */
export function validate(body: Record<string, unknown> | null | undefined, schema: ValidationSchema): ValidationResult {
  // Handle null/undefined body
  if (!body || typeof body !== 'object') {
    const requiredFields = Object.entries(schema)
      .filter(([, rule]) => rule.required)
      .map(([field]) => field)
    return {
      valid: false,
      errors: requiredFields.map((f) => `${f} is required`),
      body: {},
    }
  }

  // Trim all string fields in-place
  for (const key of Object.keys(body)) {
    if (typeof body[key] === 'string') {
      body[key] = (body[key] as string).trim()
    }
  }

  const errors: string[] = []

  for (const [field, rule] of Object.entries(schema)) {
    const value = body[field]

    // Required check (after trim, so "   " becomes "")
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`)
      continue
    }

    // Skip further validation if value is not provided and is optional
    if (value === undefined || value === null) continue

    // Type check
    if (rule.type === 'string' && typeof value !== 'string') {
      errors.push(`${field} must be a string`)
      continue
    }

    if (rule.type === 'number' && typeof value !== 'number') {
      errors.push(`${field} must be a number`)
      continue
    }

    // MinLength check
    if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
      errors.push(`${field} must be at least ${rule.minLength} characters`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    body,
  }
}
