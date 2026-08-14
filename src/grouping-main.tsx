import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GatheringHome } from './components/GatheringHome'
import { StudentGrouping } from './components/StudentGrouping'
import './grouping-root.css'

function GroupingApp() {
  const [page, setPage] = useState<'home' | 'tool'>('home')
  return page === 'home'
    ? <GatheringHome onStart={() => setPage('tool')} />
    : <StudentGrouping onBack={() => setPage('home')} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><GroupingApp /></StrictMode>,
)
