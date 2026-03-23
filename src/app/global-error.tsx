'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ padding: 24, fontFamily: 'system-ui', background: '#1a1a2e', color: '#eee' }}>
        <h1 style={{ color: '#ff6b6b' }}>Application Error</h1>
        <p style={{ color: '#94a3b8' }}>Check the browser console (F12) for full details.</p>
        <pre style={{ background: '#0f0f1a', padding: 16, overflow: 'auto', fontSize: 12, maxHeight: 300 }}>
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
        <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <button
            onClick={() => reset()}
            style={{ padding: '10px 20px', cursor: 'pointer' }}
          >
            Try again
          </button>
          <a href="/debug" style={{ padding: '10px 20px', background: '#334155', color: 'white', textDecoration: 'none', borderRadius: 4 }}>
            Open /debug
          </a>
        </div>
      </body>
    </html>
  );
}
