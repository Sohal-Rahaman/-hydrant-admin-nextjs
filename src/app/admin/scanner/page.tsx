'use client';

import React, { useEffect, useState, useRef } from 'react';
import styled from 'styled-components';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '@/context/AuthContext';
import { 
  assignJarToCustomer, 
  returnJar, 
  getAllOrders, 
  getAllUsers, 
  User as HydrantUser 
} from '@/lib/firebase';
import { FiCamera, FiCheckCircle, FiRefreshCw, FiUser, FiZap } from 'react-icons/fi';

const ScannerContainer = styled.div`
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
`;

const Header = styled.div`
  margin-bottom: 24px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 8px;
`;

const Subtitle = styled.p`
  color: #64748b;
  font-size: 14px;
`;

const ScanWindow = styled.div`
  background: #000;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  aspect-ratio: 1;
  margin-bottom: 24px;
  border: 4px solid #f1f5f9;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
`;

const ActionCard = styled.div`
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
`;

const ButtonGroup = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 20px;
`;

const ActionButton = styled.button<{ $active?: boolean; $variant?: 'delivery' | 'pickup' }>`
  padding: 12px;
  border-radius: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  cursor: pointer;
  
  border: 2px solid ${props => {
    if (props.$variant === 'delivery') return props.$active ? '#3b82f6' : '#e2e8f0';
    return props.$active ? '#10b981' : '#e2e8f0';
  }};
  
  background: ${props => {
    if (props.$variant === 'delivery') return props.$active ? '#eff6ff' : 'white';
    return props.$active ? '#f0fdf4' : 'white';
  }};
  
  color: ${props => {
    if (props.$variant === 'delivery') return props.$active ? '#2563eb' : '#64748b';
    return props.$active ? '#059669' : '#64748b';
  }};
`;

const ResultCard = styled.div<{ $success: boolean }>`
  padding: 16px;
  border-radius: 12px;
  background: ${props => props.$success ? '#f0fdf4' : '#fef2f2'};
  border: 1px solid ${props => props.$success ? '#bbf7d0' : '#fecaca'};
  color: ${props => props.$success ? '#15803d' : '#b91c1c'};
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
`;

const Select = styled.select`
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  margin-top: 8px;
  font-size: 14px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 600;
  color: #475569;
`;

export default function ScannerPage() {
  const { currentUser, staffData } = useAuth();
  const [mode, setMode] = useState<'delivery' | 'pickup'>('delivery');
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [users, setUsers] = useState<HydrantUser[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [u, o] = await Promise.all([getAllUsers(), getAllOrders()]);
      setUsers(u);
      // Only show active/pending orders for delivery
      setOrders(o.filter((order: any) => order.status === 'pending' || order.status === 'processing'));
    };
    fetchData();

    // Initialize Scanner
    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scannerRef.current.render(onScanSuccess, onScanFailure);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear scanner", error);
        });
      }
    };
  }, []);

  const onScanSuccess = (decodedText: string) => {
    let id = decodedText.trim();
    
    try {
      if (id.startsWith('http://') || id.startsWith('https://')) {
        const url = new URL(id);
        const urlId = url.searchParams.get('id');
        if (urlId) id = urlId.trim();
      }
    } catch (e) {
      console.warn('Scan text is not a parsable URL, using raw string');
    }
    
    if (id && id.startsWith('HYD-JAR-')) {
      setScannedId(id);
      setStatus(null);
      // Visual feedback via vibration if supported
      if (navigator.vibrate) navigator.vibrate(50);
    }
  };

  const onScanFailure = (error: any) => {
    // Scan failure is usually just "no QR found in frame", so we ignore it
  };

  const handleAction = async () => {
    if (!scannedId) return;
    if (mode === 'delivery' && !selectedUser) {
      setStatus({ type: 'error', message: 'Please select a customer first' });
      return;
    }

    setIsProcessing(true);
    try {
      const staffId = staffData?.id || currentUser?.uid || 'system';
      
      if (mode === 'delivery') {
        await assignJarToCustomer(scannedId, selectedUser, staffId);
        setStatus({ type: 'success', message: `Jar ${scannedId} locked to customer` });
      } else {
        await returnJar(scannedId, staffId);
        setStatus({ type: 'success', message: `Jar ${scannedId} returned to inventory` });
      }
      
      setScannedId(null);
    } catch (error) {
      console.error('Action failed:', error);
      setStatus({ type: 'error', message: 'Something went wrong. Try again.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScannerContainer>
      <Header>
        <Title>Jar Scanner</Title>
        <Subtitle>Scan QR codes to track jars during delivery/pickup</Subtitle>
      </Header>

      <ButtonGroup>
        <ActionButton 
          $variant="delivery" 
          $active={mode === 'delivery'} 
          onClick={() => { setMode('delivery'); setStatus(null); }}
        >
          <FiZap /> Delivery
        </ActionButton>
        <ActionButton 
          $variant="pickup" 
          $active={mode === 'pickup'} 
          onClick={() => { setMode('pickup'); setStatus(null); }}
        >
          <FiRefreshCw /> Pickup
        </ActionButton>
      </ButtonGroup>

      <ScanWindow>
        <div id="reader"></div>
      </ScanWindow>

      {!scannedId && (
        <form onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem('manualId') as HTMLInputElement;
          const parsedInput = input.value.trim();
          if (parsedInput) {
            let finalId = parsedInput;
            if (/^\d+$/.test(parsedInput)) {
              finalId = `HYD-JAR-${parsedInput.padStart(4, '0')}`;
            } else if (!parsedInput.startsWith('HYD-JAR-')) {
              finalId = `HYD-JAR-${parsedInput}`;
            }
            onScanSuccess(finalId);
            input.value = '';
          }
        }} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <input 
            name="manualId" 
            placeholder="Type number (e.g. 12 → HYD-JAR-0012)" 
            style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', fontSize: '15px', outline: 'none' }} 
            autoComplete="off"
          />
          <button type="submit" style={{ padding: '0 24px', borderRadius: '12px', background: '#3b82f6', color: '#fff', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>ADD</button>
        </form>
      )}

      <ActionCard>
        {scannedId ? (
          <>
            <div style={{ marginBottom: '16px' }}>
              <Label>Scanned Jar</Label>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginTop: '4px' }}>
                {scannedId}
              </div>
            </div>

            {mode === 'delivery' && (
              <div style={{ marginBottom: '20px' }}>
                <Label>Select Customer</Label>
                <Select 
                  value={selectedUser} 
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="">Choose a customer...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.full_name || 'Guest'} ({u.phone})
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <button 
              onClick={handleAction}
              disabled={isProcessing}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                background: mode === 'delivery' ? '#2563eb' : '#059669',
                color: 'white',
                border: 'none',
                fontWeight: '700',
                fontSize: '16px',
                cursor: 'pointer',
                opacity: isProcessing ? 0.7 : 1
              }}
            >
              {isProcessing ? 'Processing...' : `Confirm ${mode === 'delivery' ? 'Delivery' : 'Pickup'}`}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: '#64748b' }}>
            <FiCamera size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p>Scanning ready... Point at Jar QR</p>
          </div>
        )}

        {status && (
          <ResultCard $success={status.type === 'success'}>
            {status.type === 'success' ? <FiCheckCircle /> : null}
            {status.message}
          </ResultCard>
        )}
      </ActionCard>
    </ScannerContainer>
  );
}
