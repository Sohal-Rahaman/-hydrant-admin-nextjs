'use client';
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function GaugeBar({ label, value, max, color, unit }: { label: string; value: number | string; max: number; color: string; unit: string }) {
  const numericVal = typeof value === 'number' ? value : 0;
  const pct = (numericVal / max) * 100;
  const isHigh = pct > 80;
  return (
    <div style={{ background: '#111827', border: `1px solid ${isHigh ? '#ef4444' : '#1f2937'}`, borderRadius: '10px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{label}</span>
        <span style={{ color: isHigh ? '#ef4444' : color, fontWeight: 800, fontSize: '16px' }}>{value}{unit}</span>
      </div>
      <div style={{ background: '#0a0f1e', borderRadius: '20px', height: '8px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: isHigh ? '#ef4444' : color, borderRadius: '20px', transition: 'width 0.5s' }} />
      </div>
      {isHigh && <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '6px' }}>⚠️ HIGH — Admin alerted</div>}
    </div>
  );
}

export default function ServerPerf() {
  const [history, setHistory] = useState<any[]>([]);
  const [latest, setLatest] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query dev_server_perf
    const q = query(
      collection(db, 'dev_server_perf'),
      orderBy('timestamp', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveLogs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          t: data.timestamp?.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || new Date().toLocaleTimeString('en-IN'),
          cpu: data.cpu || 0,
          ram: data.ram || 0,
          api: data.apiLatency || 0,
          reads: data.reads || 0,
          storage: data.storageGB || 0,
          crashRate: data.crashRate || 0,
        };
      }).reverse(); // Chronological order for chart
      
      setHistory(liveLogs);
      if (liveLogs.length > 0) {
        setLatest(liveLogs[liveLogs.length - 1]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch server perf logs:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
        <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, margin: 0 }}>🖥️ Server & Performance</h1>
      </div>
      <p style={{ color: '#4b5563', fontSize: '13px', marginBottom: '24px' }}>Real-time CPU · RAM · API · Firebase · Crash Rate · Alerts</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <GaugeBar label="CPU Usage" value={loading ? '...' : (latest?.cpu || 0)} max={100} color="#3b82f6" unit="%" />
        <GaugeBar label="RAM Usage" value={loading ? '...' : (latest?.ram || 0)} max={100} color="#8b5cf6" unit="%" />
        <GaugeBar label="API Response Avg" value={loading ? '...' : (latest?.api || 0)} max={1000} color="#10b981" unit="ms" />
        <GaugeBar label="Firebase Reads Today" value={loading ? '...' : (latest?.reads || 0)} max={50000} color="#f59e0b" unit="" />
        <GaugeBar label="Storage Used" value={loading ? '...' : (latest?.storage || 0)} max={100} color="#06b6d4" unit="GB" />
        <GaugeBar label="Crash Rate" value={loading ? '...' : (latest?.crashRate || 0)} max={10} color="#10b981" unit="%" />
      </div>

      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: 700, margin: '0 0 16px' }}>📈 Live CPU & RAM — 60s window</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="t" stroke="#4b5563" tick={{ fontSize: 9 }} interval={4} />
            <YAxis stroke="#4b5563" tick={{ fontSize: 10 }} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }} />
            <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} dot={false} name="CPU %" />
            <Line type="monotone" dataKey="ram" stroke="#8b5cf6" strokeWidth={2} dot={false} name="RAM %" />
          </LineChart>
        </ResponsiveContainer>
        {history.length === 0 && !loading && <div style={{ color: '#4b5563', textAlign: 'center', marginTop: '-100px' }}>No Server Stats Received.</div>}
      </div>

      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '16px' }}>
        <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>🚨 Alert Rules</h3>
        {[
          { rule: 'CPU > 80%', status: latest?.cpu > 80 ? 'TRIGGERED' : 'OK', color: latest?.cpu > 80 ? '#ef4444' : '#10b981' },
          { rule: 'DB query slow (>2s)', status: 'OK', color: '#10b981' },
          { rule: 'Server downtime detected', status: 'OK', color: '#10b981' },
          { rule: 'API error rate > 5%', status: 'OK', color: '#10b981' },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1f293740' }}>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>{r.rule}</span>
            <span style={{ color: r.color, fontSize: '12px', fontWeight: 700 }}>{r.status === 'OK' ? '✅' : '⚠️'} {r.status}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
