/**
 * Mentor app shell: a centered phone-width canvas with a tab bar that renders as
 * a bottom bar on mobile and a left sidebar on wider (web) viewports. Child
 * routes render through <Outlet/>.
 */
import { NavLink, Outlet } from 'react-router-dom'
import { ChartIcon, CohortIcon, HomeIcon, PeopleIcon, ProfileIcon } from './icons'
import { useSettings } from '../state/settings'

// Mentor-facing chrome stays English; the language setting only localizes
// in-game content (prompts, buttons, speech).
const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/participants', label: 'Participants', Icon: PeopleIcon, end: false },
  { to: '/progress', label: 'Progress', Icon: ChartIcon, end: false },
  { to: '/cohort', label: 'Cohort', Icon: CohortIcon, end: false },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon, end: false },
] as const

export function AppShell() {
  return (
    <div className="shell">
      <nav className="shell-nav" aria-label="Main">
        <div className="shell-brand">SocialSpark VR</div>
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
          >
            <Icon className="tab-icon" aria-hidden />
            <span className="tab-label">{label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="shell-main">
        <PlayModeToggle />
        <Outlet />
      </main>
    </div>
  )
}

/**
 * Persistent Desktop / VR HMD switch, pinned above every tab-shell page.
 * Lives in settings (localStorage) rather than page state so it survives
 * navigation and reloads — Home reads it to decide which build of each
 * skill's games to list.
 */
function PlayModeToggle() {
  const playMode = useSettings((s) => s.playMode)
  const setPlayMode = useSettings((s) => s.setPlayMode)
  return (
    <div className="mode-toggle" role="radiogroup" aria-label="Play mode">
      <button
        type="button"
        role="radio"
        aria-checked={playMode === 'desktop'}
        className={playMode === 'desktop' ? 'mode-toggle-btn active' : 'mode-toggle-btn'}
        onClick={() => setPlayMode('desktop')}
      >
        🖥️ Desktop
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={playMode === 'vr'}
        className={playMode === 'vr' ? 'mode-toggle-btn active' : 'mode-toggle-btn'}
        onClick={() => setPlayMode('vr')}
      >
        🥽 VR HMD
      </button>
    </div>
  )
}
