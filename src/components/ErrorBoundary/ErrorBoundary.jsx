import { Component } from 'react'
import { logger } from '../../services/logger'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    logger.error('ErrorBoundary', error?.stack || error?.message, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error)
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', padding: 40,
          background: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace',
        }}>
          <h2 style={{ color: '#f14c4c', margin: '0 0 12px' }}>Ein Fehler ist aufgetreten</h2>
          <pre style={{
            background: '#2d2d2d', padding: 16, borderRadius: 6,
            maxWidth: '90%', overflow: 'auto', fontSize: 13,
          }}>{msg}</pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20, padding: '10px 24px', background: '#0e7c7b',
              border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontSize: 14,
            }}
          >
            Neu laden
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
