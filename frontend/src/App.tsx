import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthGate from './auth/AuthGate'
import Layout from './components/Layout'
import TodayPage from './pages/TodayPage'
import PlanPage from './pages/plan/PlanPage'
import LogPage from './pages/LogPage'
import ChecklistPage from './pages/ChecklistPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TodayPage />} />
          <Route path="plan" element={<PlanPage />} />
          <Route path="log" element={<LogPage />} />
          {/* 1-4c 전 주소. 계획 화면으로 옮겨 북마크가 깨지지 않게 한다 */}
          <Route path="weekly" element={<Navigate to="/plan?level=week" replace />} />
          <Route path="monthly" element={<Navigate to="/plan?level=month" replace />} />
          {/* 1-4e에서 집중 화면을 없앴다. 딴생각 메모는 기록 페이지에서 본다 */}
          <Route path="focus" element={<Navigate to="/log" replace />} />
          <Route path="goals" element={<Navigate to="/plan?level=goal" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="checklist" element={<ChecklistPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </AuthGate>
    </BrowserRouter>
  )
}
