const FIELD_MESSAGES: Record<string, Record<string, string>> = {
  gameIds: {
    default: 'Please select at least one game',
  },
  title: {
    default: 'Title is required',
  },
  description: {
    default: 'Description is required',
  },
  zipCode: {
    default: 'ZIP code is required',
  },
  startsAt: {
    custom: 'Start date must be in the future',
    default: 'Start date and time is required',
  },
  durationMinutes: {
    too_small: 'Duration must be a positive number',
    default: 'Duration must be a positive number',
  },
  maxPlayers: {
    too_small: 'Max players must be at least 1',
    default: 'Max players must be at least 1',
  },
}

interface ZodIssue {
  path?: (string | number)[]
  code?: string
  message?: string
}

export function parseGatheringErrors(error: unknown): Record<string, string> {
  const message = error instanceof Error ? error.message : 'Something went wrong'

  try {
    const issues: ZodIssue[] = JSON.parse(message)
    if (!Array.isArray(issues)) {
      return { form: message }
    }

    const errors: Record<string, string> = {}
    for (const issue of issues) {
      const field = issue.path?.[0]
      if (typeof field !== 'string') continue

      const fieldMessages = FIELD_MESSAGES[field]
      if (fieldMessages) {
        const codeKey = issue.code ?? ''
        errors[field] = fieldMessages[codeKey] || fieldMessages['default'] || 'Invalid value'
      } else {
        errors[field] = issue.message ?? 'Invalid value'
      }
    }

    return Object.keys(errors).length > 0 ? errors : { form: message }
  } catch {
    return { form: message }
  }
}
