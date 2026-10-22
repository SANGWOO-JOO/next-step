export type FieldError = { field: string; message: string }

export type ErrorResponse = {
  code: string
  message: string
  fieldErrors: FieldError[]
  timestamp: string
}

export class ApiError extends Error {
  readonly status: number
  readonly body?: ErrorResponse

  constructor(status: number, body?: ErrorResponse) {
    super(body?.message ?? `요청 실패 (${status})`)
    this.status = status
    this.body = body
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!res.ok) {
    let errorBody: ErrorResponse | undefined
    try {
      errorBody = (await res.json()) as ErrorResponse
    } catch {
      errorBody = undefined
    }
    throw new ApiError(res.status, errorBody)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
