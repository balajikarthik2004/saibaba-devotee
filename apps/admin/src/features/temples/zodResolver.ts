import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form'
import type { ZodType } from 'zod'

/**
 * A minimal zod resolver for react-hook-form, so the console does not need the
 * `@hookform/resolvers` package for three forms.
 */
export function zodResolver<T extends FieldValues>(schema: ZodType): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values)
    if (result.success) return { values: result.data as T, errors: {} }
    const errors: Record<string, unknown> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root'
      if (!errors[path]) errors[path] = { type: issue.code, message: issue.message }
    }
    // Nest dotted paths so `errors.a.b` works.
    const nested: Record<string, unknown> = {}
    for (const [path, err] of Object.entries(errors)) {
      const parts = path.split('.')
      let node = nested
      parts.forEach((part, i) => {
        if (i === parts.length - 1) node[part] = err
        else node = (node[part] ??= {}) as Record<string, unknown>
      })
    }
    return { values: {}, errors: nested as FieldErrors<T> }
  }
}
