import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import TodayPage from './pages/TodayPage'
import PlanPage from './pages/plan/PlanPage'
import ChecklistPage from './pages/ChecklistPage'
import DashboardPage from './pages/DashboardPage'
import FocusPage from './pages/FocusPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TodayPage />} />
          <Route path="focus" element={<FocusPage />} />
          <Route path="plan" element={<PlanPage />} />
          {/* 1-4c 전 주소. 계획 화면으로 옮겨 북마크가 깨지지 않게 한다 */}
          <Route path="weekly" element={<Navigate to="/plan?level=week" replace />} />
          <Route path="monthly" element={<Navigate to="/plan?level=month" replace />} />
          <Route path="goals" element={<Navigate to="/plan?level=goal" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="checklist" element={<ChecklistPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
