'use client';
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const sc: Record<string, string> = { Low: '#10b981', Medium: '#f59e0b', High: '#f97316', Critical: '#ef4444' };

export default function SecurityLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query dev_security_logs
    const q = query(
      collection(db, 'dev_security_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveLogs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type || 'Unknown Event',
          customerId: data.userId || '—',
          ip: data.ip || '—',
          device: data.device || '—',
          severity: data.severity || 'Medium',
          time: data.timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
          resolved: !!data.resolved,
          description: data.description || '',
        };
      });
      setLogs(liveLogs);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch security logs:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>🛡️ Security Logs</h1>
      <p style={{ color: '#4b5563', fontSize: '13px', marginBottom: '24px' }}>Live login attempts, OTP fraud, IP blocking & unauthorized access</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {Object.entries(sc).map(([s, c]) => (
          <div key={s} style={{ background: '#111827', border: `1px solid ${c}30`, borderRadius: '10px', padding: '14px' }}>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>{s}</div>
            <div style={{ color: c, fontSize: '22px', fontWeight: 800 }}>{loading ? '...' : logs.filter(m => m.severity === s).length}</div>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ color: '#94a3b8', padding: '20px', textAlign: 'center' }}>Loading live security logs...</div>
        ) : logs.length === 0 ? (
          <div style={{ color: '#10b981', padding: '20px', textAlign: 'center' }}>No security incidents reported. System is secure.</div>
        ) : logs.map((m, i) => (
          <div key={m.id} style={{ background: '#111827', border: `1px solid ${sc[m.severity] || '#4b5563'}30`, borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ background: `${sc[m.severity] || '#4b5563'}20`, color: sc[m.severity] || '#4b5563', padding: '2px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700 }}>{m.severity}</span>
            <span style={{ color: '#e5e7eb', fontSize: '12px', flex: 1, minWidth: '180px' }}>{m.type} {m.description && <span style={{ color: '#94a3b8', fontSize: '10px', display: 'block' }}>{m.description}</span>}</span>
            <span style={{ color: '#4b5563', fontSize: '11px' }}>👤 {m.customerId}</span>
            <span style={{ color: '#00e5ff', fontSize: '11px' }}>🌐 {m.ip}</span>
            <span style={{ color: '#94a3b8', fontSize: '11px' }}>📱 {m.device}</span>
            <span style={{ color: m.resolved ? '#10b981' : '#f59e0b', fontSize: '11px', fontWeight: 600 }}>{m.resolved ? '✅ Resolved' : '⚠️ Open'}</span>
            <span style={{ color: '#4b5563', fontSize: '11px', marginLeft: 'auto' }}>{m.time}</span>
            {!m.resolved && <button style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: '6px', padding: '3px 10px', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>Block IP</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
