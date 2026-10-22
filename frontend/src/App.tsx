import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import TodayPage from './pages/TodayPage'
import GoalsPage from './pages/GoalsPage'
import FocusPage from './pages/FocusPage'
import PlaceholderPage from './pages/PlaceholderPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TodayPage />} />
          <Route path="focus" element={<FocusPage />} />
          <Route path="weekly" element={<PlaceholderPage title="주간" stage="1-3단계" />} />
          <Route path="monthly" element={<PlaceholderPage title="월간" stage="1-3단계" />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="dashboard" element={<PlaceholderPage title="시간 대시보드" stage="1-4단계" />} />
          <Route path="checklist" element={<PlaceholderPage title="체크리스트" stage="1-4단계" />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
