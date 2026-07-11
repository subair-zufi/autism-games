/**
 * Mentor app shell: a centered phone-width canvas with a tab bar that renders as
 * a bottom bar on mobile and a left sidebar on wider (web) viewports. Child
 * routes render through <Outlet/>.
 */
import { NavLink, Outlet } from 'react-router-dom'
import { ChartIcon, CohortIcon, HomeIcon, PeopleIcon, ProfileIcon } from './icons'

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
        <Outlet />
      </main>
    </div>
  )
}
