'use client';

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { FiPrinter, FiTrash2, FiPlus, FiRefreshCw, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';

const QR_BASE_URL = 'https://hydrant.co.in/jar?id=';

interface JarQR {
  id: string;
  qrDataUrl: string;
}

function JarCard({ jar }: { jar: JarQR }) {
  return (
    <div
      className="jar-card"
      style={{
        width: '5.5cm',
        height: '6.5cm',
        border: '1.5px solid #0f172a',
        borderRadius: '8px',
        padding: '8px 8px 6px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        background: '#fff',
        pageBreakInside: 'avoid',
        margin: '4px',
        flexShrink: 0,
      }}
    >
      <img
        src={jar.qrDataUrl}
        alt={jar.id}
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }}
      />
      <div style={{
        fontSize: '13px',
        fontWeight: '900',
        color: '#0f172a',
        letterSpacing: '0.5px',
        textAlign: 'center',
        lineHeight: 1,
      }}>
        {jar.id}
      </div>
    </div>
  );
}

export default function QRPrintPage() {
  const [jars, setJars] = useState<JarQR[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [count, setCount] = useState(30);
  const [confirm, setConfirm] = useState(false);

  const loadJars = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'jars'));
      const ids = snap.docs.map(d => d.id).sort();
      const jarQRs: JarQR[] = [];
      for (const id of ids) {
        const qrDataUrl = await QRCode.toDataURL(`${QR_BASE_URL}${id}`, {
          width: 300,
          margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        });
        jarQRs.push({ id, qrDataUrl });
      }
      setJars(jarQRs);
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', msg: 'Failed to load jars.' });
    }
    setLoading(false);
  };

  useEffect(() => { loadJars(); }, []);

  const handleReset = async () => {
    if (!confirm) { setConfirm(true); return; }
    setConfirm(false);
    setGenerating(true);
    setStatus({ type: 'info', msg: 'Deleting old jars & generating new ones...' });

    try {
      // Delete all existing jar docs
      const snap = await getDocs(collection(db, 'jars'));
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, 'jars', d.id)));
      await Promise.all(deletePromises);

      // Create new jar docs in batches of 500
      const batchSize = 499;
      for (let batchStart = 1; batchStart <= count; batchStart += batchSize) {
        const batch = writeBatch(db);
        const end = Math.min(batchStart + batchSize - 1, count);
        for (let i = batchStart; i <= end; i++) {
          const id = `HYD-JAR-${String(i).padStart(4, '0')}`;
          const ref = doc(db, 'jars', id);
          batch.set(ref, {
            id,
            status: 'available',
            currentOwnerId: null,
            lastScanAt: new Date(),
            lastScanBy: 'system',
            history: [],
          });
        }
        await batch.commit();
      }

      setStatus({ type: 'success', msg: `${count} jars created (HYD-JAR-0001 to HYD-JAR-${String(count).padStart(4, '0')})` });
      await loadJars();
    } catch (e: any) {
      console.error(e);
      setStatus({ type: 'error', msg: `Failed: ${e.message}` });
    }
    setGenerating(false);
  };

  const handlePrint = () => window.print();

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .print-grid { display: flex; flex-wrap: wrap; }
        }
        @media screen {
          body { background: #f8fafc; }
        }
      `}</style>

      {/* Controls — hidden on print */}
      <div className="no-print" style={{
        padding: '24px',
        background: '#0f172a',
        color: '#fff',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '16px',
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800' }}>🏷️ QR Label Generator</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
            {jars.length} jars loaded • Print or regenerate
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#94a3b8' }}>Total Jars:</label>
          <input
            type="number"
            min={1}
            max={999}
            value={count}
            onChange={e => setCount(Number(e.target.value))}
            style={{
              width: '80px', padding: '8px 12px', borderRadius: '8px',
              border: '1px solid #334155', background: '#1e293b', color: '#fff',
              fontSize: '14px', textAlign: 'center',
            }}
          />
        </div>

        <button
          onClick={handleReset}
          disabled={generating}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', borderRadius: '10px',
            background: confirm ? '#ef4444' : '#f59e0b',
            color: '#fff', fontWeight: '700', border: 'none',
            cursor: generating ? 'not-allowed' : 'pointer', fontSize: '14px',
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} /> : <FiTrash2 />}
          {confirm ? '⚠️ CONFIRM DELETE & RECREATE' : '🔄 Reset & Generate All'}
        </button>
        {confirm && (
          <button
            onClick={() => setConfirm(false)}
            style={{ padding: '10px 16px', borderRadius: '10px', background: '#334155', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px' }}
          >
            Cancel
          </button>
        )}

        <button
          onClick={handlePrint}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', borderRadius: '10px',
            background: '#10b981', color: '#fff', fontWeight: '700', border: 'none',
            cursor: 'pointer', fontSize: '14px',
          }}
        >
          <FiPrinter /> Print Labels
        </button>
      </div>

      {/* Status banner */}
      {status && (
        <div className="no-print" style={{
          padding: '12px 24px',
          background: status.type === 'success' ? '#022c22' : status.type === 'error' ? '#450a0a' : '#0c1a2e',
          color: status.type === 'success' ? '#10b981' : status.type === 'error' ? '#ef4444' : '#38bdf8',
          fontSize: '13px', fontWeight: '600', display: 'flex', gap: '8px', alignItems: 'center',
        }}>
          {status.type === 'success' ? <FiCheckCircle /> : <FiAlertTriangle />}
          {status.msg}
          <button onClick={() => setStatus(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Print grid */}
      <div className="print-grid" style={{ padding: '16px', display: 'flex', flexWrap: 'wrap' }}>
        {loading ? (
          <div style={{ padding: '60px', color: '#94a3b8', fontSize: '16px', margin: 'auto' }}>
            Loading jars & generating QR codes...
          </div>
        ) : jars.length === 0 ? (
          <div style={{ padding: '60px', color: '#94a3b8', fontSize: '16px', margin: 'auto', textAlign: 'center' }}>
            <FiAlertTriangle size={40} style={{ marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
            No jars in database.<br />
            <span style={{ fontSize: '13px' }}>Use "Reset & Generate All" above to create them.</span>
          </div>
        ) : (
          jars.map(jar => <JarCard key={jar.id} jar={jar} />)
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
