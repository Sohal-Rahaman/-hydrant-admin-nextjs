"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackLogic() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Connecting to Zoho...');

  useEffect(() => {
    const code = searchParams.get('code');
    const err = searchParams.get('error');

    if (err) {
      setStatus(`Zoho Error: ${err}`);
      return;
    }

    if (!code) {
      setStatus('No authorization code found in URL.');
      return;
    }

    setStatus('Verifying authorization code...');

    fetch('/api/zoho/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        setStatus(`Failed to verify: ${data.error}`);
      } else {
        setStatus('Successfully connected to Zoho! Redirecting...');
        setTimeout(() => {
          router.push('/admin/settings/integrations');
        }, 2000);
      }
    })
    .catch(error => setStatus(`Request error: ${error.message}`));
  }, [searchParams, router]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#0a0a0a', color: '#fff' }}>
      <h2 style={{ marginBottom: 16 }}>{status}</h2>
      {status.includes('Connecting') || status.includes('Verifying') ? (
        <div style={{ width: 40, height: 40, border: '4px solid #333', borderTop: '4px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      ) : null}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function CallbackPage() {
    return (
        <Suspense fallback={<div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0a0a0a', color: '#fff' }}>Loading...</div>}>
            <CallbackLogic />
        </Suspense>
    );
}
