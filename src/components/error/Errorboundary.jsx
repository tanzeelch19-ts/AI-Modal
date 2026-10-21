import { Component } from 'react';

// If something on the screen crashes, show what went wrong (instead of a white page) and a Reload button.
// Chats are saved in the browser, so nothing is lost.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" style={{ maxWidth: 620, margin: '48px auto', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Something went wrong on this screen</h1>
        <p style={{ margin: '0 0 12px', color: '#667085', fontSize: 14 }}>
          Your chats are saved. Press Reload. If it happens again, send a screenshot of this message.
        </p>
        <pre style={{ margin: '0 0 16px', padding: 12, maxHeight: 260, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, border: '1px solid #d0d5dd', borderRadius: 10, background: '#f8f9fb', color: '#101828' }}>
          {String(error?.stack || error?.message || error)}
        </pre>
        <button onClick={() => location.reload()} style={{ padding: '8px 16px', borderRadius: 10, border: 0, background: '#12b5a6', color: '#fff', fontSize: 14, cursor: 'pointer' }}>
          Reload
        </button>
      </div>
    );
  }
}