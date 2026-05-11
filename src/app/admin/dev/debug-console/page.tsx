'use client';
import { useState, useEffect } from 'react';
import { FiTerminal, FiTrash2, FiPlay, FiPause } from 'react-icons/fi';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function DebugConsole() {
  const [logs, setLogs] = useState<any[]>([]);
  const [live, setLive] = useState(true);

  useEffect(() => {
    if (!live) return;
    
    // Listen to dev_error_logs as a proxy for the debug console for now
    const q = query(
      collection(db, 'dev_error_logs'),
      orderBy('timestamp', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveLogs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          timestamp: data.timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
          level: data.severity === 'Critical' ? 'FATAL' : data.severity === 'High' ? 'ERROR' : data.severity === 'Medium' ? 'WARN' : 'INFO',
          service: data.context?.module || 'system',
          message: data.message || JSON.stringify(data),
          meta: data.context || {},
        };
      }).reverse(); // chronological order for console
      setLogs(liveLogs);
    }, (error) => {
      console.error('Failed to fetch debug logs:', error);
    });

    return () => unsubscribe();
  }, [live]);

  const getColor = (level: string) => {
    switch(level) {
      case 'FATAL': return '#ef4444';
      case 'ERROR': return '#f97316';
      case 'WARN': return '#f59e0b';
      case 'INFO': return '#3b82f6';
      case 'DEBUG': return '#10b981';
      default: return '#e5e7eb';
    }
  };

  return (
    <div style={{ background: '#000', minHeight: '100vh', padding: '24px', fontFamily: 'monospace', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #1f2937', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FiTerminal color="#10b981" size={24} />
          <div>
            <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: 800, margin: 0 }}>Live Debug Console</h1>
            <p style={{ color: '#4b5563', fontSize: '12px', margin: 0 }}>Streaming application logs via Firestore</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setLive(!live)} style={{ background: live ? '#10b98120' : '#4b556320', border: `1px solid ${live ? '#10b981' : '#4b5563'}`, color: live ? '#10b981' : '#e5e7eb', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            {live ? <FiPause size={12} /> : <FiPlay size={12} />} {live ? 'Pause Stream' : 'Resume Stream'}
          </button>
          <button onClick={() => setLogs([])} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <FiTrash2 size={12} /> Clear Console
          </button>
        </div>
      </div>

      <div style={{ flex: 1, background: '#050505', borderRadius: '8px', padding: '16px', overflowY: 'auto', border: '1px solid #1f2937', height: '70vh' }}>
        {logs.length === 0 && (
          <div style={{ color: '#4b5563', textAlign: 'center', marginTop: '40px' }}>Waiting for logs...</div>
        )}
        {logs.map((log, i) => (
          <div key={log.id + i} style={{ display: 'flex', gap: '12px', marginBottom: '6px', fontSize: '12px', lineHeight: '1.4' }}>
            <span style={{ color: '#4b5563', whiteSpace: 'nowrap' }}>[{log.timestamp.split(', ')[1]}]</span>
            <span style={{ color: getColor(log.level), fontWeight: 700, minWidth: '45px' }}>{log.level}</span>
            <span style={{ color: '#94a3b8', minWidth: '80px' }}>[{log.service}]</span>
            <span style={{ color: '#e5e7eb' }}>{log.message}</span>
            {Object.keys(log.meta).length > 0 && (
              <span style={{ color: '#6b7280' }}>{JSON.stringify(log.meta)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
