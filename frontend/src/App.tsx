import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import TodayPage from './pages/TodayPage'
import GoalsPage from './pages/GoalsPage'
import ChecklistPage from './pages/ChecklistPage'
import DashboardPage from './pages/DashboardPage'
import MonthlyPage from './pages/MonthlyPage'
import FocusPage from './pages/FocusPage'
import SettingsPage from './pages/SettingsPage'
import WeeklyPage from './pages/WeeklyPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TodayPage />} />
          <Route path="focus" element={<FocusPage />} />
          <Route path="weekly" element={<WeeklyPage />} />
          <Route path="monthly" element={<MonthlyPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="checklist" element={<ChecklistPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
