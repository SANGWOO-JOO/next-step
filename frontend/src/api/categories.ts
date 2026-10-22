import { api } from './client'

export type Category = {
  id: number
  name: string
  color: string
  sortOrder: number
  targetRatio: number | null
  weeklyTargetMinutes: number | null
  active: boolean
}

export type CategoryInput = {
  name: string
  color: string
  targetRatio: number | null
  weeklyTargetMinutes: number | null
  active: boolean
}

export const getCategories = (includeInactive = false) =>
  api.get<Category[]>(`/api/categories?includeInactive=${includeInactive}`)

export const createCategory = (input: CategoryInput) => api.post<Category>('/api/categories', input)

export const updateCategory = (id: number, input: CategoryInput) =>
  api.put<Category>(`/api/categories/${id}`, input)

export const reorderCategories = (ids: number[]) => api.put<Category[]>('/api/categories/order', { ids })
