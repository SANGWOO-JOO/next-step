import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthGate from './auth/AuthGate'
import Layout from './components/Layout'
import TodayPage from './pages/TodayPage'
import PlanPage from './pages/plan/PlanPage'
import LogPage from './pages/LogPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TodayPage />} />
          <Route path="goals" element={<PlanPage />} />
          {/* 2-2 용어 통일 전 주소. 목표 화면으로 넘긴다 */}
          <Route path="plan" element={<Navigate to="/goals" replace />} />
          <Route path="log" element={<LogPage />} />
          {/* 1-4c 전 주소. 계획 화면으로 옮겨 북마크가 깨지지 않게 한다 */}
          <Route path="weekly" element={<Navigate to="/goals" replace />} />
          <Route path="monthly" element={<Navigate to="/goals" replace />} />
          {/* 1-4e에서 집중 화면을 없앴다. 딴생각 메모는 기록 페이지에서 본다 */}
          <Route path="focus" element={<Navigate to="/log" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          {/* 2-2에서 체크리스트를 뺐다. 예전 주소는 일정으로 */}
          <Route path="checklist" element={<Navigate to="/" replace />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </AuthGate>
    </BrowserRouter>
  )
}
