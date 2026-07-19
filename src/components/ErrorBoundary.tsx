import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last-resort catch for render errors (e.g. malformed report data), so the app
 * shows a friendly recovery screen instead of unmounting to a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Unhandled render error:', error)
  }

  private reload = () => {
    window.location.hash = '#/'
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash-screen">
        <div className="crash-card">
          <span className="crash-emoji" aria-hidden>🛠️</span>
          <h1>Something went wrong</h1>
          <p>An unexpected error stopped this screen. Your data is safe — reloading usually fixes it.</p>
          <button className="btn-primary" onClick={this.reload}>Reload the app</button>
          <p className="crash-detail">{this.state.error.message}</p>
        </div>
      </div>
    )
  }
}
