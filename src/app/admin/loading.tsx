export default function AdminLoading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '60vh',
      color: 'var(--color-accent-cyan)',
      fontSize: '11px',
      fontFamily: 'var(--font-fira-code), monospace',
      textTransform: 'uppercase',
      letterSpacing: '0.2em',
      gap: '12px'
    }}>
      <div style={{
        width: '40px',
        height: '2px',
        background: 'var(--color-accent-cyan)',
        opacity: 0.5
      }} />
      SYNCHRONIZING_DATA...
    </div>
  );
}
