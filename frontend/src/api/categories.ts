import { api } from './client'

export type Category = {
  id: number
  name: string
  color: string
  sortOrder: number
  targetRatio: number | null
  weeklyTargetMinutes: number | null
  active: boolean
  /** 시간표 블록 이름 앞 이모지(1-4f ㊻) */
  icon?: string | null
  /** 한 번도 쓰이지 않아 지울 수 있는지(1-4f ㊶) */
  deletable?: boolean
}

export type CategoryInput = {
  name: string
  color: string
  targetRatio: number | null
  weeklyTargetMinutes: number | null
  active: boolean
  icon: string | null
}

export const getCategories = (includeInactive = false) =>
  api.get<Category[]>(`/api/categories?includeInactive=${includeInactive}`)

export const createCategory = (input: CategoryInput) => api.post<Category>('/api/categories', input)

export const updateCategory = (id: number, input: CategoryInput) =>
  api.put<Category>(`/api/categories/${id}`, input)

export const reorderCategories = (ids: number[]) => api.put<Category[]>('/api/categories/order', { ids })

export const deleteCategory = (id: number) => api.delete<void>(`/api/categories/${id}`)
