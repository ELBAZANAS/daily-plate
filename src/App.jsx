import { Component, useEffect, useState } from 'react'
import { RouteProvider } from './router.jsx'
import { useStore } from './store.jsx'
import { DateStepper } from './components/DateStepper.jsx'
import { Icon } from './components/Icon.jsx'
import { TodayPage } from './pages/TodayPage.jsx'
import { DiaryPage } from './pages/DiaryPage.jsx'
import { TrainPage } from './pages/TrainPage.jsx'
import { ExercisesPage } from './pages/ExercisesPage.jsx'
import { PlansPage } from './pages/PlansPage.jsx'
import { ProgressPage } from './pages/ProgressPage.jsx'
import { CalendarPage } from './pages/CalendarPage.jsx'
import { GoalsPage } from './pages/GoalsPage.jsx'
import { ScanPage } from './pages/ScanPage.jsx'
import { MyFoodsPage } from './pages/MyFoodsPage.jsx'
import { formatClock } from './lib/training.js'

const pages = {
  today: { title: 'Today', icon: 'home', render: () => <TodayPage />, dated: true },
  diary: { title: 'Food diary', short: 'Diary', icon: 'diary', render: () => <DiaryPage />, dated: true },
  foods: { title: 'My foods', icon: 'apple', render: () => <MyFoodsPage /> },
  scan: { title: 'Scan label', short: 'Scan', icon: 'scan', render: () => <ScanPage />, dated: true },
  train: { title: 'Workout', short: 'Train', icon: 'dumbbell', render: () => <TrainPage />, dated: true },
  plans: { title: 'Plans', icon: 'plans', render: () => <PlansPage /> },
  exercises: { title: 'Exercises', icon: 'grid', render: () => <ExercisesPage /> },
  progress: { title: 'Progress', icon: 'chart', render: () => <ProgressPage /> },
  calendar: { title: 'Calendar', icon: 'calendar', render: () => <CalendarPage /> },
  goals: { title: 'Goals & settings', short: 'Settings', icon: 'settings', render: () => <GoalsPage /> },
}

const navGroups = [
  { label: null, items: ['today'] },
  { label: 'Food', items: ['diary', 'foods', 'scan'] },
  { label: 'Training', items: ['train', 'plans', 'exercises'] },
  { label: 'Insights', items: ['progress', 'calendar'] },
]

const tabs = ['today', 'diary', 'train', 'progress']

function readRoute() {
  const name = window.location.hash.replace(/^#\/?/, '')
  return pages[name] ? name : 'today'
}

function useTheme(theme) {
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme !== 'light' && media.matches)
      root.dataset.theme = dark ? 'dark' : 'light'
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111316' : '#eceee9')
    }
    apply()
    media.addEventListener?.('change', apply)
    return () => media.removeEventListener?.('change', apply)
  }, [theme])
}

export default function App() {
  const store = useStore()
  const [route, setRoute] = useState(readRoute)
  const [more, setMore] = useState(false)
  useTheme(store.state.settings?.theme || 'system')

  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.title = `${pages[route]?.title || 'Today'} · Daily Plate`
    document.querySelector('.main')?.scrollTo?.({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [route])

  function go(next) {
    if (window.location.hash !== `#/${next}`) window.location.hash = `#/${next}`
    else setRoute(next)
    setMore(false)
  }

  if (!store.state.profile) {
    return (
      <RouteProvider value={{ route: 'goals', go }}>
        <div className="onboarding-screen">
          <GoalsPage onboarding />
        </div>
      </RouteProvider>
    )
  }

  const page = pages[route] || pages.today

  return (
    <RouteProvider value={{ route, go }}>
      <div className="shell">
        <aside className="sidebar" aria-label="Main navigation">
          <div className="brand">
            <img className="logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
            <div>
              <span className="brand-name">Daily Plate</span>
              <small>Food · training · progress</small>
            </div>
          </div>
          <nav className="nav">
            {navGroups.map((group) => (
              <div key={group.label || 'main'} className="nav-group">
                {group.label && <p className="nav-label">{group.label}</p>}
                {group.items.map((id) => (
                  <button key={id} type="button" className={`nav-btn ${route === id ? 'on' : ''}`} aria-current={route === id ? 'page' : undefined} onClick={() => go(id)}>
                    <Icon name={pages[id].icon} />
                    <span>{pages[id].title}</span>
                    {id === 'train' && store.draft && <i className="live-dot" title="Workout in progress" />}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-foot">
            {store.draft && route !== 'train' && <LivePill draft={store.draft} onClick={() => go('train')} />}
            <button type="button" className={`nav-btn ${route === 'goals' ? 'on' : ''}`} onClick={() => go('goals')}>
              <Icon name="settings" /><span>Goals & settings</span>
            </button>
            <ThemeToggle />
            <DesktopInstall />
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="topbar-left">
              <img className="logo small mobile-only" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
              <span className="topbar-title">{page.title}</span>
            </div>
            {page.dated ? <DateStepper date={store.viewDate} onChange={store.setViewDate} /> : <span />}
            <div className="topbar-right">
              {route !== 'scan' && <button className="btn ghost small hide-narrow" type="button" onClick={() => go('scan')}><Icon name="scan" size={16} />Scan</button>}
            </div>
          </header>
          {store.storageError && <div className="page-banner bad" role="alert"><Icon name="alert" size={16} />{store.storageError}</div>}
          {store.draft && route !== 'train' && (
            <button className="page-banner live mobile-only" type="button" onClick={() => go('train')}>
              <i className="live-dot" />Workout in progress · {store.draft.name} — tap to continue
            </button>
          )}
          <main className="content" key={route}>{page.render()}</main>
        </div>

        <nav className="tabs" aria-label="Main">
          {tabs.map((id) => (
            <button key={id} type="button" className={route === id ? 'on' : ''} aria-current={route === id ? 'page' : undefined} onClick={() => go(id)}>
              <Icon name={pages[id].icon} size={21} />
              <span>{pages[id].short || pages[id].title}</span>
              {id === 'train' && store.draft && <i className="live-dot" />}
            </button>
          ))}
          <button type="button" className={more || !tabs.includes(route) ? 'on' : ''} aria-expanded={more} onClick={() => setMore((value) => !value)}>
            <Icon name="more" size={21} /><span>More</span>
          </button>
        </nav>
        {more && (
          <div className="sheet-back" onClick={() => setMore(false)}>
            <div className="sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="More pages">
              {['foods', 'scan', 'plans', 'exercises', 'calendar', 'goals'].map((id) => (
                <button key={id} type="button" className={route === id ? 'on' : ''} onClick={() => go(id)}>
                  <Icon name={pages[id].icon} size={22} /><span>{pages[id].title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {store.toast && (
          <div className="toast" role="status" key={store.toast.id}>
            <span>{store.toast.message}</span>
            {store.toast.undo && <button type="button" onClick={() => { store.toast.undo(); store.dismissToast() }}>Undo</button>}
            <button type="button" className="toast-x" aria-label="Dismiss" onClick={store.dismissToast}><Icon name="x" size={14} /></button>
          </div>
        )}
      </div>
    </RouteProvider>
  )
}

function LivePill({ draft, onClick }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <button className="live-pill" type="button" onClick={onClick}>
      <i className="live-dot" />
      <span><strong>{draft.name}</strong><small>{formatClock(now - new Date(draft.startedAt).getTime())} · tap to continue</small></span>
    </button>
  )
}

function ThemeToggle() {
  const { state, setTheme } = useStore()
  const theme = state.settings?.theme || 'system'
  const order = ['system', 'light', 'dark']
  const next = order[(order.indexOf(theme) + 1) % order.length]
  const label = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' }[theme]
  return (
    <button type="button" className="nav-btn" onClick={() => setTheme(next)} title={`Switch to ${next} theme`}>
      <Icon name={theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'monitor'} /><span>{label}</span>
    </button>
  )
}

function DesktopInstall() {
  const store = useStore()
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches)

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault()
      setPrompt(event)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || navigator.userAgent.includes('Electron') || window.dailyPlate) return null

  return (
    <button
      className="nav-btn"
      type="button"
      onClick={async () => {
        if (!prompt) {
          store.flash('Open the browser menu and choose “Install Daily Plate” to keep it on your desktop like an app.')
          return
        }
        prompt.prompt()
        const choice = await prompt.userChoice
        setPrompt(null)
        if (choice.outcome === 'accepted') setInstalled(true)
      }}
    >
      <Icon name="download" /><span>Install app</span>
    </button>
  )
}

export class Boundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Daily Plate crashed', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="onboarding-screen">
          <div className="card crash">
            <h1>Something went wrong</h1>
            <p className="muted">Your data is safe on this device. Reloading usually fixes this.</p>
            <pre>{String(this.state.error?.message || this.state.error)}</pre>
            <div className="row gap">
              <button className="btn primary" type="button" onClick={() => window.location.reload()}>Reload</button>
              <button className="btn ghost" type="button" onClick={() => { window.location.hash = '#/today'; window.location.reload() }}>Go to Today</button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
