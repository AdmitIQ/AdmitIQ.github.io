import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { captureAuthRedirect } from './lib/services';

const authRedirect = captureAuthRedirect();
if (authRedirect?.error) { try { sessionStorage.setItem('admitiq:authError', authRedirect.error); } catch { /* ignore */ } }

class Boundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 520, margin: '15vh auto', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ color: '#5d6675' }}>AdmitIQ hit an unexpected error. Your saved data is safe in this browser. Try reloading; if it keeps happening, export your data from Data &amp; privacy.</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f0f1ee', padding: 12, borderRadius: 8 }}>{String(this.state.error.message)}</pre>
          <button onClick={() => { location.hash = 'dashboard'; location.reload(); }} style={{ height: 44, padding: '0 18px', borderRadius: 12, background: '#0f1b2d', color: '#fff', border: 0, fontWeight: 500 }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(<Boundary><App /></Boundary>);
