import { api } from './client'

export type Health = {
  status: string
  database: string
  serverTime: string
  zone: string
}

export const getHealth = () => api.get<Health>('/api/health')
