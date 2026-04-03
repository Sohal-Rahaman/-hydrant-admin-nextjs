"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState('');
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    const checkZoho = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'zoho_integration'));
        if (snap.exists() && snap.data().refresh_token) {
          setConnected(true);
          const t = snap.data().updated_at;
          if (t && typeof t.toDate === 'function') {
            setLastUpdated(t.toDate().toLocaleString());
          }
          setSheetId(snap.data().sheet_id || '');
        }
      } catch (err) {

        console.error("Error fetching integration status", err);
      }
      setLoading(false);
    };
    checkZoho();
  }, []);

  const connectZoho = () => {
    window.location.href = '/api/zoho/auth';
  };

  const saveSheetId = async () => {
    if (!sheetId) return alert('Please enter a valid Spreadsheet ID');
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'zoho_integration'), { sheet_id: sheetId }, { merge: true });
      alert('Sheet ID updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update Sheet ID.');
    } finally {
      setSaving(false);
    }
  };

  const createNewSheet = async () => {
    if (!confirm('This will create a brand new Zoho Spreadsheet in your account. Are you sure?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/zoho/create-sheet', { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setSheetId(data.spreadsheet_id);
      alert(`Successfully created: ${data.spreadsheet_name}`);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to create sheet: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '40px', background: 'var(--color-background-primary)', minHeight: '100vh', color: 'var(--color-text-primary)' }}>
      <h1 style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 24 }}>Integrations</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
        
        {/* Zoho Card */}
        <div style={{ background: 'var(--color-background-secondary)', padding: 24, borderRadius: 16, border: '1px solid var(--color-border-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Zoho</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                Connect to Zoho Books, Mail, and CRM to automate your invoicing and customer management.
              </p>
            </div>
            <div style={{ padding: '8px 12px', background: connected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: connected ? '#22c55e' : '#ef4444', borderRadius: 8, fontSize: 12, fontWeight: 'bold' }}>
              {connected ? 'CONNECTED' : 'DISCONNECTED'}
            </div>
          </div>
          
          {loading ? (
             <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Checking status...</div>
          ) : (
            <div>
              {connected && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16 }}>Last synced tokens: {lastUpdated || 'Recently'}</div>}
              <button 
                onClick={connectZoho}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  background: connected ? 'var(--color-background-primary)' : '#4ade80',
                  color: connected ? 'var(--color-text-primary)' : '#000',
                  border: connected ? '1px solid var(--color-border-secondary)' : 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {connected ? 'Reconnect Zoho' : 'Connect to Zoho'}
              </button>
              
              {connected && (
                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border-secondary)' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    Target Spreadsheet ID
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      type="text" 
                      value={sheetId}
                      onChange={(e) => setSheetId(e.target.value)}
                      placeholder="hejlf753b5e6457..."
                      style={{ 
                        flex: 1, 
                        background: 'var(--color-background-primary)', 
                        border: '1px solid var(--color-border-secondary)', 
                        borderRadius: 8, 
                        padding: '10px 12px', 
                        color: 'var(--color-text-primary)',
                        fontSize: 13,
                        outline: 'none'
                      }}
                    />
                    <button 
                      onClick={saveSheetId}
                      disabled={saving}
                      style={{ 
                        padding: '0 16px', 
                        background: '#8b5cf6', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: 8, 
                        fontWeight: 600, 
                        fontSize: 13,
                        cursor: 'pointer',
                        opacity: saving ? 0.6 : 1
                      }}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: '#555', marginTop: 8, lineHeight: 1.4 }}>
                    Find the spreadsheet ID in your Zoho Sheet URL after <code>/sheet/open/</code>.
                  </p>

                  <div style={{ marginTop: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 10 }}>Want to start fresh?</p>
                    <button 
                      onClick={createNewSheet}
                      disabled={saving}
                      style={{ 
                        width: '100%', 
                        padding: '10px 0', 
                        background: 'transparent', 
                        color: '#8b5cf6', 
                        border: '1px solid #8b5cf6', 
                        borderRadius: 8, 
                        fontWeight: 600, 
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {saving ? 'Processing...' : 'Create New Spreadsheet'}
                    </button>
                    <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 6, fontStyle: 'italic' }}>
                       This will create a new file in your Zoho account and link it automatically.
                    </p>
                  </div>
                </div>
              )}
              
              {connected && (

                <button 
                  onClick={async () => {
                    const btn = document.getElementById('sync-btn');
                    if(btn) btn.innerText = 'Syncing... Please wait...';
                    try {
                      const res = await fetch('/api/zoho/sync-all-customers');
                      const data = await res.json();
                      alert(`Sync Complete! ${data.stats?.newlySynced || 0} customers added. ${data.stats?.skippedAlreadySynced || 0} already existed.`);
                    } catch(e) {
                      alert('Error syncing customers.');
                    }
                    if(btn) btn.innerText = 'Sync All Customers to Zoho';
                  }}
                  id="sync-btn"
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    background: 'var(--color-background-primary)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-secondary)',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '12px'
                  }}
                >
                  Sync All Customers to Zoho
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
