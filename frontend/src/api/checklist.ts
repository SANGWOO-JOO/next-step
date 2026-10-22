import { api } from './client'
import type { CategoryRef } from './goals'

export type ChecklistItem = { id: number; category: CategoryRef; content: string; done: boolean; sortOrder: number }

export type ChecklistItemInput = { categoryId: number; content: string; done: boolean }

export const toChecklistInput = (i: ChecklistItem): ChecklistItemInput => ({
  categoryId: i.category.id,
  content: i.content,
  done: i.done,
})

export const getChecklistItems = () => api.get<ChecklistItem[]>('/api/checklist/items')

export const createChecklistItem = (input: ChecklistItemInput) => api.post<ChecklistItem>('/api/checklist/items', input)

export const updateChecklistItem = (id: number, input: ChecklistItemInput) =>
  api.put<ChecklistItem>(`/api/checklist/items/${id}`, input)

export const deleteChecklistItem = (id: number) => api.delete<void>(`/api/checklist/items/${id}`)
