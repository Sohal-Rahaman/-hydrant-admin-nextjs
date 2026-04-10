import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, FiPlus, FiMinus, FiCheckCircle, FiDollarSign, 
  FiCamera, FiPackage, FiInfo, FiChevronRight, FiChevronLeft, FiTrash2, FiMaximize, FiRefreshCw
} from 'react-icons/fi';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// --- Styled Components (Match provided HTML/CSS aesthetic) ---

const Overlay = styled(motion.div)`
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
  z-index: 2000; display: flex; align-items: center; justify-content: center;
  padding: 16px;
`;

const ModalContent = styled(motion.div)`
  background: #181818;
  width: 100%; max-width: 440px; border-radius: 28px;
  overflow: hidden; border: 1px solid #2e2e2e;
  box-shadow: 0 32px 64px rgba(0,0,0,0.5);
  display: flex; flex-direction: column;
`;

const Header = styled.div`
  padding: 24px 24px 12px; display: flex; align-items: center; justify-content: space-between;
`;

const Title = styled.h2`font-size: 20px; font-weight: 800; color: #f0f0f0;`;

const StepIndicator = styled.div`
  display: flex; gap: 6px; justify-content: center; padding: 12px;
`;

const Dot = styled.div<{ $active?: boolean; $done?: boolean }>`
  height: 4px; border-radius: 2px;
  background: ${props => props.$active ? '#10B981' : props.$done ? '#10B981' : '#2e2e2e'};
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  flex: 1; min-width: 20px;
`;

const Body = styled.div`padding: 24px; flex: 1;`;

const Card = styled.div`
  background: #222; border-radius: 20px; padding: 20px; margin-bottom: 20px;
  border: 1px solid #2e2e2e;
`;

const CardLabel = styled.div`font-size: 11px; color: #666; font-weight: 800; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px;`;

const StepperRow = styled.div`display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;`;

const StepperTitle = styled.div`
  div:first-child { font-weight: 700; color: #f0f0f0; font-size: 16px; margin-bottom: 2px; }
  div:last-child { font-size: 11px; color: #666; font-weight: 600; }
`;

const CircleBtn = styled.button`
  width: 44px; height: 44px; border-radius: 14px; border: 1px solid #333;
  background: #181818; color: #f0f0f0; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s;
  &:hover { background: #222; border-color: #444; }
  &:disabled { opacity: 0.3; }
`;

const CountText = styled.span`font-size: 24px; font-weight: 900; color: #f0f0f0; min-width: 40px; text-align: center;`;

const AmountDisplay = styled.div`
  text-align: center; margin: 24px 0;
  .symbol { font-size: 24px; color: #666; margin-right: 4px; font-weight: 700; }
  .value { font-size: 56px; font-weight: 900; color: #f0f0f0; letter-spacing: -2px; }
`;

const NumpadGrid = styled.div`display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;`;

const NumBtn = styled.button`
  height: 56px; border-radius: 16px; border: 1px solid #2e2e2e; background: #222;
  font-size: 20px; font-weight: 800; color: #f0f0f0; cursor: pointer;
  &:active { background: #10B981; color: #000; transform: scale(0.95); }
`;

const Footer = styled.div`
  padding: 0 24px 24px; display: flex; gap: 12px;
`;

const ActionButton = styled.button<{ $variant?: 'primary' }>`
  flex: 1; padding: 16px; border-radius: 16px; font-size: 14px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; border: none;
  background: ${props => props.$variant === 'primary' ? '#10B981' : '#2e2e2e'};
  color: ${props => props.$variant === 'primary' ? '#000' : '#aaa'};
  transition: all 0.2s;
  &:active { transform: scale(0.98); }
`;

// --- Props ---
interface Props {
  order: any;
  walletBalance?: number;
  onClose: () => void;
  onComplete: (data: any) => Promise<void>;
  processing: boolean;
}

const ScannerContainer = styled.div`
  width: 100%; height: 260px; background: #000; border-radius: 20px;
  overflow: hidden; position: relative; border: 2px solid #2e2e2e;
  margin-bottom: 20px;
`;

const ScannedList = styled.div`
  max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
  margin-top: 12px;
`;

const ScannedItem = styled.div<{ $type: 'delivered' | 'collected' }>`
  background: #222; border: 1px solid #333; border-radius: 12px; padding: 10px 14px;
  display: flex; align-items: center; justify-content: space-between;
  .id { font-family: 'Fira Code', monospace; font-size: 13px; color: #f0f0f0; }
  .tag { 
    font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 6px;
    background: ${p => p.$type === 'delivered' ? '#10B98122' : '#F59E0B22'};
    color: ${p => p.$type === 'delivered' ? '#10B981' : '#F59E0B'};
  }
`;

export const DeliveryHandoverModal: React.FC<Props> = ({ order, walletBalance = 0, onClose, onComplete, processing }) => {
  const [step, setStep] = useState(1);
  const [showRaw, setShowRaw] = useState(false);
  
  // State for specific scanned IDs — counts are DERIVED from these arrays
  const [deliveredJarIds, setDeliveredJarIds] = useState<string[]>([]);
  const [collectedJarIds, setCollectedJarIds] = useState<string[]>([]);
  
  const [scannerActive, setScannerActive] = useState(false);
  const [cashEntered, setCashEntered] = useState('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'success' | 'duplicate' | 'error' | null>(null);
  const [scanError, setScanError] = useState<string | null>(null); // detailed error for step 2
  
  // Derived counts from the scanned ID arrays (single source of truth)
  const deliveredCount = deliveredJarIds.length;
  const collectedCount = collectedJarIds.length;

  // Payment logic: if order was pre-paid (wallet/UPI), cash due = 0
  const isPrepaid = order?.paymentMethod === 'wallet' || order?.paymentMethod === 'upi';
  const unitPrice = 37; // ₹37 per jar
  const totalAmount = isPrepaid ? 0 : Math.round(unitPrice * deliveredCount);
  const netChange = deliveredCount - collectedCount;

  // --- Handlers ---

  const handleBack = () => {
    if (step > 1) {
      setScannerActive(false);
      setStep(prev => prev - 1);
    } else {
      onClose();
    }
  };

  // --- Audio Helpers ---
  const playSuccessBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
      if (window.navigator?.vibrate) window.navigator.vibrate(80);
    } catch {}
  };
  const playErrorBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
      if (window.navigator?.vibrate) window.navigator.vibrate([200, 100, 200]);
    } catch {}
  };

  const handleScanSuccess = async (rawId: string) => {
    let id = rawId.trim();
    if (!id) return;
    
    // Attempt to extract from URL if the QR code returns a URL instead of just the ID string.
    try {
      if (id.startsWith('http://') || id.startsWith('https://')) {
        const url = new URL(id);
        const urlId = url.searchParams.get('id');
        if (urlId) {
          id = urlId.trim();
        }
      }
    } catch (err) {
      console.warn('Scan text is not a parsable URL, using raw string');
    }

    // --- FIRESTORE VALIDATION ---
    try {
      const jarRef = doc(db, 'jars', id);
      const jarDoc = await getDoc(jarRef);
      const jarData = jarDoc.exists() ? jarDoc.data() : null;

      if (step === 1) {
        // For delivery: reject if jar is already locked to someone else
        if (jarData && jarData.status === 'locked') {
          setScanStatus('error');
          setLastScanned(`${id} already in use`);
          setScanError(`${id} is locked to another customer`);
          setTimeout(() => { setScanStatus(null); setScanError(null); }, 2000);
          playErrorBeep();
          return;
        }
      } else if (step === 2) {
        // For collection: jar MUST be locked AND locked to THIS order's customer
        const orderCustomerId = order?.customerId || order?.userId;
        if (!jarData || jarData.status !== 'locked') {
          setScanStatus('error');
          setLastScanned(`${id} not locked`);
          setScanError(`${id} is not assigned to any customer`);
          setTimeout(() => { setScanStatus(null); setScanError(null); }, 2500);
          playErrorBeep();
          return;
        }
        if (jarData.currentOwnerId !== orderCustomerId) {
          setScanStatus('error');
          setLastScanned(`${id} wrong user`);
          setScanError(`${id} belongs to a different customer (${jarData.currentOwnerId}), not this order`);
          setTimeout(() => { setScanStatus(null); setScanError(null); }, 3000);
          playErrorBeep();
          return;
        }
      }
    } catch (e) {
      console.warn("Could not verify jar status, proceeding anyway:", e);
    }
    // --- END VALIDATION ---

    console.log("🔍 [Modal] Scanned Jar ID:", id);
    setLastScanned(id);
    setScanError(null);
    
    // Success audio + haptic
    playSuccessBeep();
    
    if (step === 1) {
      setDeliveredJarIds(prev => {
        if (prev.includes(id)) {
          setScanStatus('duplicate');
          return prev;
        }
        setScanStatus('success');
        return [...prev, id];
      });
    } else if (step === 2) {
      setCollectedJarIds(prev => {
        if (prev.includes(id)) {
          setScanStatus('duplicate');
          return prev;
        }
        setScanStatus('success');
        return [...prev, id];
      });
    }

    setTimeout(() => setScanStatus(null), 800);
  };

  const handleConfirm = async () => {
    await onComplete({
      deliveredJars: deliveredCount,
      collectedJars: collectedCount,
      deliveredJarIds,
      collectedJarIds,
      amountPaid: cashEntered === '' ? totalAmount : Number(cashEntered),
      paymentReceived: (cashEntered === '' ? totalAmount : Number(cashEntered)) > 0,
      notes: `Scanned Handover. Delivered: ${deliveredJarIds.join(', ')}. Collected: ${collectedJarIds.join(', ')}`
    });
    setStep(5);
  };

  const addManualJar = () => {
    const id = prompt("Enter Jar ID:");
    if (id) {
      handleScanSuccess(id.trim());
    }
  };

  const removeJar = (list: 'delivered' | 'collected', id: string) => {
    if (list === 'delivered') {
      setDeliveredJarIds(prev => prev.filter(x => x !== id));
    } else {
      setCollectedJarIds(prev => prev.filter(x => x !== id));
    }
  };

  // --- Logic Hooks ---

  const handleNumPress = (val: string) => {
    if (cashEntered.length < 6) setCashEntered(prev => prev + val);
  };

  const handleDelete = () => setCashEntered(prev => prev.slice(0, -1));

  const showPaymentWarning = step === 3 && cashEntered !== '' && Number(cashEntered) !== totalAmount;

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;

    const startScanner = async () => {
      try {
        // Double check div existence before starting
        const element = document.getElementById("handover-qr-reader");
        if (!element) return;

        html5QrCode = new Html5Qrcode("handover-qr-reader");
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (isMounted) handleScanSuccess(decodedText);
          },
          undefined
        );
      } catch (err) {
        console.warn("Scanner initialization failed (likely div not ready yet):", err);
      }
    };

    if (scannerActive) {
      // Delay slightly to ensure DOM element is rendered
      const timeout = setTimeout(startScanner, 100);
      return () => {
        clearTimeout(timeout);
        isMounted = false;
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().catch(() => {});
        }
      };
    }

    return () => {
      isMounted = false;
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, [scannerActive, step]);

  const isStep1Disabled = deliveredCount === 0 || scannerActive;
  const isStep2Disabled = scannerActive;

  return (
    <Overlay initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <ModalContent initial={{ y: 50, scale: 0.95 }} animate={{ y: 0, scale: 1 }}>
        <Header>
          <Title>{step === 4 ? 'Success' : showRaw ? 'Raw Data View' : 'Complete Delivery'}</Title>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {step < 4 && (
              <button 
                onClick={() => setShowRaw(!showRaw)} 
                style={{ 
                  background: showRaw ? '#f1f5f9' : 'none', 
                  border: '1px solid #e2e8f0', 
                  padding: '6px 10px', 
                  borderRadius: '8px',
                  cursor: 'pointer', 
                  color: showRaw ? '#1e293b' : '#64748b',
                  fontSize: '11px',
                  fontWeight: '700'
                }}
              >
                {showRaw ? 'CLOSE RAW' : 'RAW DATA'}
              </button>
            )}
            {step < 4 && (
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <FiX size={24} />
              </button>
            )}
          </div>
        </Header>

        <StepIndicator>
          {[1, 2, 3, 4, 5].map(s => <Dot key={s} $active={step === s} $done={step > s} />)}
        </StepIndicator>

        <Body>
          <AnimatePresence mode="wait">
            {showRaw ? (
              <motion.div key="raw" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <Card style={{ background: '#1e293b', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '11px', overflowX: 'auto' }}>
                  <CardLabel style={{ color: '#94a3b8' }}>Exact Firestore Data</CardLabel>
                  <pre>{JSON.stringify(order.raw || order, null, 2)}</pre>
                </Card>
                <div style={{ fontSize: '12px', color: '#64748b', padding: '0 10px' }}>
                  <FiInfo size={12} /> This view shows the exact fields from the database before mapping.
                </div>
              </motion.div>
            ) : step === 1 ? (
              <motion.div key="step1" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                <CardLabel>Step 1: Scan Delivered Jars</CardLabel>
                
                {scannerActive ? (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <ScannerContainer>
                    <div id="handover-qr-reader" style={{ width: '100%', height: '100%' }} />
                    
                    {/* Visual Overlay for Scan Feedback */}
                    <AnimatePresence>
                      {scanStatus && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          style={{
                            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                            background: scanStatus === 'success' ? '#10B981' : '#EF4444',
                            color: '#fff', padding: '8px 16px', borderRadius: '20px',
                            fontSize: '12px', fontWeight: '800', zIndex: 20,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                          }}
                        >
                          {scanStatus === 'success' ? `Added: ${lastScanned}` : scanStatus === 'error' ? `Invalid: ${lastScanned}` : `Already Scanned: ${lastScanned}`}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Detailed error reason for rejection */}
                    {scanError && (
                      <div style={{
                        position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 20,
                        background: 'rgba(220,38,38,0.95)', color: '#fff',
                        padding: '8px 12px', borderRadius: '10px',
                        fontSize: '11px', fontWeight: '700', textAlign: 'center',
                      }}>
                        ⛔ {scanError}
                      </div>
                    )}

                    <CircleBtn 
                      onClick={() => setScannerActive(false)}
                      style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, background: 'rgba(0,0,0,0.5)' }}
                    >
                      <FiX />
                    </CircleBtn>
                  </ScannerContainer>
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
                      handleScanSuccess(finalId);
                      input.value = '';
                    }
                  }} style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flex: 1, borderRadius: '8px', border: '1px solid #10B98155', background: '#222', overflow: 'hidden' }}>
                      <span style={{ padding: '12px 8px 12px 12px', color: '#10B981', fontWeight: '800', fontSize: '13px', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>HYD-JAR-</span>
                      <input
                        name="manualId"
                        placeholder="0012"
                        style={{ flex: 1, padding: '12px 12px 12px 0', background: 'transparent', color: '#fff', fontSize: '14px', outline: 'none', border: 'none', minWidth: 0 }}
                        autoComplete="off"
                      />
                    </div>
                    <button type="submit" style={{ padding: '0 20px', height: '46px', borderRadius: '8px', background: '#10B981', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>ADD</button>
                  </form>
                  </div>
                ) : (
                  <Card style={{ textAlign: 'center', cursor: 'pointer', margin: 0, background: deliveredJarIds.length > 0 ? '#10B98111' : '#222', borderColor: deliveredJarIds.length > 0 ? '#10B981' : '#2e2e2e' }} onClick={() => setScannerActive(true)}>
                    <FiCamera size={32} color={deliveredJarIds.length > 0 ? '#10B981' : '#666'} style={{ marginBottom: '12px' }} />
                    <div style={{ fontWeight: '700', color: '#f0f0f0', fontSize: '13px' }}>{deliveredJarIds.length > 0 ? 'Scan More' : 'Open Camera'}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>{deliveredJarIds.length} Scanned</div>
                  </Card>
                )}

                <ScannedList>
                  {deliveredJarIds.map(id => (
                    <ScannedItem key={id} $type="delivered">
                      <span className="id">{id}</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="tag">DELIVERED</span>
                        <FiTrash2 size={14} color="#666" style={{ cursor: 'pointer' }} onClick={() => removeJar('delivered', id)} />
                      </div>
                    </ScannedItem>
                  ))}
                  {deliveredJarIds.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#444', fontSize: '12px', padding: '10px' }}>No jars scanned yet</div>
                  )}
                </ScannedList>
              </motion.div>
            ) : step === 2 ? (
              <motion.div key="step2" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                <CardLabel>Step 2: Scan Collected (Empty) Jars</CardLabel>
                
                {scannerActive ? (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <ScannerContainer>
                    <div id="handover-qr-reader" style={{ width: '100%', height: '100%' }} />
                    
                    {/* Visual Overlay for Scan Feedback */}
                    <AnimatePresence>
                      {scanStatus && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          style={{
                            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                            background: scanStatus === 'success' ? '#10B981' : '#EF4444',
                            color: '#fff', padding: '8px 16px', borderRadius: '20px',
                            fontSize: '12px', fontWeight: '800', zIndex: 20,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                          }}
                        >
                          {scanStatus === 'success' ? `Collected: ${lastScanned}` : `Already Scanned: ${lastScanned}`}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Ownership rejection error banner */}
                    {scanError && (
                      <div style={{
                        position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 20,
                        background: 'rgba(220,38,38,0.95)', color: '#fff',
                        padding: '8px 12px', borderRadius: '10px',
                        fontSize: '11px', fontWeight: '700', textAlign: 'center',
                      }}>
                        ⛔ {scanError}
                      </div>
                    )}

                    <CircleBtn 
                      onClick={() => setScannerActive(false)}
                      style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, background: 'rgba(0,0,0,0.5)' }}
                    >
                      <FiX />
                    </CircleBtn>
                  </ScannerContainer>
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
                      handleScanSuccess(finalId);
                      input.value = '';
                    }
                  }} style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flex: 1, borderRadius: '8px', border: '1px solid #F59E0B55', background: '#222', overflow: 'hidden' }}>
                      <span style={{ padding: '12px 8px 12px 12px', color: '#F59E0B', fontWeight: '800', fontSize: '13px', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>HYD-JAR-</span>
                      <input
                        name="manualId"
                        placeholder="0012"
                        style={{ flex: 1, padding: '12px 12px 12px 0', background: 'transparent', color: '#fff', fontSize: '14px', outline: 'none', border: 'none', minWidth: 0 }}
                        autoComplete="off"
                      />
                    </div>
                    <button type="submit" style={{ padding: '0 20px', height: '46px', borderRadius: '8px', background: '#F59E0B', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>ADD</button>
                  </form>
                  </div>
                ) : (
                  <Card style={{ textAlign: 'center', cursor: 'pointer', margin: 0, background: collectedJarIds.length > 0 ? '#F59E0B11' : '#222', borderColor: collectedJarIds.length > 0 ? '#F59E0B' : '#2e2e2e' }} onClick={() => setScannerActive(true)}>
                    <FiRefreshCw size={32} color={collectedJarIds.length > 0 ? '#F59E0B' : '#666'} style={{ marginBottom: '12px' }} />
                    <div style={{ fontWeight: '700', color: '#f0f0f0', fontSize: '13px' }}>{collectedJarIds.length > 0 ? 'Scan More' : 'Open Camera'}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>{collectedJarIds.length} Collected</div>
                  </Card>
                )}

                <ScannedList>
                  {collectedJarIds.map(id => (
                    <ScannedItem key={id} $type="collected">
                      <span className="id">{id}</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="tag">COLLECTED</span>
                        <FiTrash2 size={14} color="#666" style={{ cursor: 'pointer' }} onClick={() => removeJar('collected', id)} />
                      </div>
                    </ScannedItem>
                  ))}
                  {collectedJarIds.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#444', fontSize: '12px', padding: '10px' }}>No jars collected yet</div>
                  )}
                </ScannedList>

                <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#444', fontSize: '11px' }}>
                  <FiInfo /> If no jars are collected, click 'Next' to skip.
                </div>
              </motion.div>
            ) : step === 3 ? (
              <motion.div key="step3" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                <CardLabel style={{ textAlign: 'center' }}>
                  {isPrepaid ? 'Payment Status' : 'Cash to Collect'}
                </CardLabel>
                <AmountDisplay>
                  <span className="symbol">₹</span>
                  <span className="value">{isPrepaid ? 0 : (cashEntered || totalAmount)}</span>
                </AmountDisplay>

                {isPrepaid ? (
                  <div style={{
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                    padding: '16px', borderRadius: '16px', textAlign: 'center', marginTop: '8px'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
                    <div style={{ color: '#10B981', fontWeight: '800', fontSize: '15px' }}>Already Paid</div>
                    <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                      via <strong style={{ color: '#3B82F6', textTransform: 'uppercase' }}>{order?.paymentMethod}</strong> — No cash to collect
                    </div>
                  </div>
                ) : (
                  <>
                    {showPaymentWarning && (
                      <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', padding: '12px', borderRadius: '12px', fontSize: '12px', color: '#F59E0B', marginBottom: '16px' }}>
                        <strong>Mismatch:</strong> Due ₹{totalAmount}, Entered ₹{cashEntered}.
                      </div>
                    )}
                    <NumpadGrid>
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map(n => (
                        <NumBtn key={n} onClick={() => handleNumPress(n)}>{n}</NumBtn>
                      ))}
                      <NumBtn onClick={handleDelete}><FiX size={20} style={{ margin: '0 auto' }} /></NumBtn>
                    </NumpadGrid>
                  </>
                )}
              </motion.div>
            ) : step === 4 ? (
              <motion.div key="step4" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                <Card>
                  <CardLabel>Final Summary</CardLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Delivered</span>
                      <strong style={{ color: '#10b981' }}>{deliveredCount} Full</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#666' }}>Collected</span>
                      <strong style={{ color: '#F59E0B' }}>{collectedCount} Empty</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #2e2e2e', paddingTop: '12px' }}>
                      <span style={{ color: '#f0f0f0', fontWeight: '700' }}>Amount Collected</span>
                      <strong style={{ color: '#10B981', fontSize: '18px' }}>₹{isPrepaid ? 0 : (cashEntered || totalAmount)}</strong>
                    </div>
                  </div>
                </Card>

                {/* Wallet Balance Risk Card */}
                {(() => {
                  const bal = walletBalance;
                  const isNeg = bal < 0;
                  const isLow = bal >= 0 && bal < 50;
                  const isOk = bal >= 50;
                  const riskColor = isNeg ? '#EF4444' : isLow ? '#F59E0B' : '#10B981';
                  const riskBg = isNeg ? 'rgba(239,68,68,0.08)' : isLow ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)';
                  const riskBorder = isNeg ? 'rgba(239,68,68,0.3)' : isLow ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)';
                  const riskLabel = isNeg ? '🔴 HIGH RISK — Negative Balance' : isLow ? '🟡 LOW BALANCE — Ask to Top Up' : '🟢 Wallet OK';
                  const riskTip = isNeg
                    ? 'Customer owes money. Request payment or collect dues before leaving.'
                    : isLow
                    ? 'Balance is low. Remind customer to recharge their wallet.'
                    : 'No action needed.';
                  return (
                    <div style={{ background: riskBg, border: `1px solid ${riskBorder}`, borderRadius: '16px', padding: '16px', marginTop: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#888', fontWeight: '600', letterSpacing: '0.5px' }}>WALLET BALANCE</span>
                        <span style={{ fontSize: '20px', fontWeight: '900', color: riskColor, fontFamily: 'monospace' }}>
                          {bal >= 0 ? '+' : ''}₹{bal}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: riskColor, fontWeight: '700', marginBottom: '4px' }}>{riskLabel}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>{riskTip}</div>
                    </div>
                  );
                })()}

                <div style={{ padding: '24px', border: '2px dashed #10B981', borderRadius: '16px', textAlign: 'center', color: '#10B981' }}>
                  <FiCheckCircle size={32} style={{ marginBottom: '8px' }} />
                  <div style={{ fontSize: '12px', fontWeight: '700' }}>Dual-Scan Verified</div>
                </div>
              </motion.div>
            ) : step === 5 ? (
              <motion.div key="step5" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '40px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <FiCheckCircle size={48} />
                </div>
                <h3 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>Order Completed</h3>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>Order #{order.id} has been marked as delivered.</p>
                
                <Card style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>Transaction Details</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#aaa' }}>Status</span>
                    <strong style={{ fontSize: '13px', color: '#10B981' }}>DELIVERED</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: '#aaa' }}>Inventory</span>
                    <strong style={{ fontSize: '13px', color: '#3B82F6' }}>{netChange >= 0 ? `+${netChange}` : netChange} Jars</strong>
                  </div>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </Body>

        <Footer>
          {step < 5 ? (
            <>
              <ActionButton onClick={handleBack}><FiChevronLeft /> Back</ActionButton>
              {step === 4 ? (
                <ActionButton $variant="primary" onClick={handleConfirm} disabled={processing}>
                  {processing ? 'Processing...' : 'Confirm Delivery'} <FiCheckCircle />
                </ActionButton>
              ) : (
                <ActionButton 
                  $variant="primary" 
                  onClick={() => { setScannerActive(false); setStep(prev => prev + 1); }}
                  disabled={step === 1 && deliveredJarIds.length === 0}
                >
                  Next <FiChevronRight />
                </ActionButton>
              )}
            </>
          ) : (
            <ActionButton $variant="primary" onClick={onClose} style={{ flex: 1 }}>Done</ActionButton>
          )}
        </Footer>
      </ModalContent>
    </Overlay>
  );
};
