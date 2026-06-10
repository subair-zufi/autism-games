import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

let supported: boolean | null = null
function webglSupported(): boolean {
  if (supported !== null) return supported
  try {
    const canvas = document.createElement('canvas')
    supported = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    supported = false
  }
  return supported
}

export function WebGLGate({ children }: { children: ReactNode }) {
  if (webglSupported()) return <>{children}</>
  return (
    <div className="start-screen">
      <div className="start-icon">🖥️</div>
      <h1>Oh no!</h1>
      <p>This game needs 3D graphics. Please try a newer browser like Chrome or Safari.</p>
      <Link to="/" className="big-btn home-link">🏠 Home</Link>
    </div>
  )
}
