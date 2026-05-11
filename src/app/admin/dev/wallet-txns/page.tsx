'use client';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const txnTypes = ['Credit', 'Debit', 'Bonus', 'Referral Bonus', 'Cashback', 'Refund', 'Admin Adjustment'];
const colors: Record<string, string> = { Credit: '#10b981', Debit: '#ef4444', Bonus: '#f59e0b', 'Referral Bonus': '#3b82f6', Cashback: '#8b5cf6', Refund: '#06b6d4', 'Admin Adjustment': '#f97316' };

export default function WalletTxns() {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query admin_activities for WALLET_UPDATED events
    const q = query(
      collection(db, 'admin_activities'),
      where('action', '==', 'WALLET_UPDATED'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        const meta = data.metadata || {};
        const amount = meta.amount || 0;
        const type = amount >= 0 ? 'Credit' : 'Debit';
        
        // Try to infer specific type from details
        let specificType = type;
        if (data.details?.toLowerCase().includes('referral')) specificType = 'Referral Bonus';
        if (data.details?.toLowerCase().includes('refund')) specificType = 'Refund';
        if (data.actor === 'ADMIN') specificType = 'Admin Adjustment';

        return {
          id: doc.id,
          customerId: data.targetId || data.actorId || 'N/A',
          name: data.actorName || 'User',
          type: specificType,
          amount: Math.abs(amount),
          balance: meta.newBalance || '—',
          expiry: meta.expiry ? new Date(meta.expiry).toLocaleDateString('en-IN') : '—',
          time: data.timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
          note: data.details || '—',
        };
      });
      setTxns(logs);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch wallet transactions:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getCount = (type: string) => txns.filter(t => t.type === type || (type === 'Credit' && ['Referral Bonus', 'Refund', 'Admin Adjustment'].includes(t.type) && t.note.includes('added'))).length;

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>💰 Wallet Transactions</h1>
      <p style={{ color: '#4b5563', fontSize: '13px', marginBottom: '24px' }}>Complete ledger view · All live credits, debits, bonuses & adjustments</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {txnTypes.slice(0, 4).map(t => (
          <div key={t} style={{ background: '#111827', border: `1px solid ${colors[t]}30`, borderRadius: '10px', padding: '14px' }}>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>{t}</div>
            <div style={{ color: colors[t], fontSize: '20px', fontWeight: 800 }}>{loading ? '...' : getCount(t)}</div>
          </div>
        ))}
      </div>
      
      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1f2937' }}>
              {['ID', 'Customer', 'Type', 'Amount', 'Balance After', 'Expiry', 'Time', 'Note'].map(h => (
                <th key={h} style={{ color: '#4b5563', fontWeight: 600, padding: '12px 14px', textAlign: 'left', fontSize: '11px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading live data...</td></tr>
            ) : txns.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#10b981' }}>No wallet transactions found.</td></tr>
            ) : txns.map((m, i) => (
              <tr key={m.id} style={{ borderBottom: '1px solid #1f293720' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 14px', color: '#00e5ff', fontSize: '11px' }}>{m.id.slice(0,10)}...</td>
                <td style={{ padding: '10px 14px' }}><div style={{ color: '#e5e7eb' }}>{m.name}</div><div style={{ color: '#4b5563', fontSize: '10px' }}>{m.customerId}</div></td>
                <td style={{ padding: '10px 14px' }}><span style={{ background: `${colors[m.type] || '#4b5563'}20`, color: colors[m.type] || '#e5e7eb', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>{m.type}</span></td>
                <td style={{ padding: '10px 14px', color: m.type === 'Debit' ? '#ef4444' : '#10b981', fontWeight: 700 }}>{m.type === 'Debit' ? '-' : '+'}₹{m.amount}</td>
                <td style={{ padding: '10px 14px', color: '#fff', fontWeight: 600 }}>₹{m.balance}</td>
                <td style={{ padding: '10px 14px', color: '#f59e0b', fontSize: '11px' }}>{m.expiry}</td>
                <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: '11px', whiteSpace: 'nowrap' }}>{m.time}</td>
                <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '11px' }}>{m.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
