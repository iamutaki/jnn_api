/**
 * Simple validation utility for request bodies.
 *
 * Validates fields against rules and returns specific error messages.
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
}

/**
 * Validate a body object against a schema.
 *
 * Returns { valid: true, errors: [] } if all good,
 * or { valid: false, errors: ['field x is required', ...] } if not.
 */
export function validate(body: Record<string, unknown> | null | undefined, schema: ValidationSchema): ValidationResult {
  if (!body || typeof body !== 'object') {
    // All required fields are missing
    const requiredFields = Object.entries(schema)
      .filter(([, rule]) => rule.required)
      .map(([field]) => field)
    return {
      valid: false,
      errors: requiredFields.map((f) => `${f} is required`),
    }
  }

  const errors: string[] = []

  for (const [field, rule] of Object.entries(schema)) {
    const value = body[field]

    // Required check
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
  }
}
