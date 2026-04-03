import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, FiPlus, FiMinus, FiCheckCircle, FiDollarSign, 
  FiCamera, FiPackage, FiInfo, FiChevronRight, FiChevronLeft 
} from 'react-icons/fi';

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
  onClose: () => void;
  onComplete: (data: any) => Promise<void>;
  processing: boolean;
}

export const DeliveryHandoverModal: React.FC<Props> = ({ order, onClose, onComplete, processing }) => {
  const [step, setStep] = useState(1);
  const [showRaw, setShowRaw] = useState(false);
  const [deliveredCount, setDeliveredCount] = useState(order?.quantity || 1);
  const [collectedCount, setCollectedCount] = useState(0);
  const [cashEntered, setCashEntered] = useState('');
  
  // Arithmetic must handle discounts/custom amounts correctly
  const unitPrice = order?.quantity > 0 ? (order.amount / order.quantity) : 37;
  const totalAmount = Math.round(unitPrice * deliveredCount);
  const netChange = deliveredCount - collectedCount;

  const handleNumPress = (val: string) => {
    if (cashEntered.length < 6) setCashEntered(prev => prev + val);
  };

  const handleDelete = () => setCashEntered(prev => prev.slice(0, -1));

  const showPaymentWarning = step === 2 && cashEntered !== '' && Number(cashEntered) !== totalAmount;

  const handleNext = () => {
    if (step < 4) setStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(prev => prev - 1);
    else onClose();
  };

  const handleConfirm = async () => {
    await onComplete({
      deliveredJars: deliveredCount,
      collectedJars: collectedCount,
      amountPaid: cashEntered === '' ? totalAmount : Number(cashEntered),
      paymentReceived: (cashEntered === '' ? totalAmount : Number(cashEntered)) > 0,
      notes: `Manually marked delivered by Admin. Net change: ${netChange}`
    });
    setStep(4);
  };

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
          {[1, 2, 3, 4].map(s => <Dot key={s} $active={step === s} $done={step > s} />)}
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
            ) : step === 1 && (
              <motion.div key="step1" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                <Card>
                  <CardLabel>Jar Handover</CardLabel>
                  <StepperRow>
                    <StepperTitle>
                      <div>Full Jars</div>
                      <div>Quantity to deliver</div>
                    </StepperTitle>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <CircleBtn onClick={() => setDeliveredCount(c => Math.max(1, c - 1))}><FiMinus /></CircleBtn>
                      <CountText>{deliveredCount}</CountText>
                      <CircleBtn onClick={() => setDeliveredCount(c => c + 1)}><FiPlus /></CircleBtn>
                    </div>
                  </StepperRow>

                  <StepperRow>
                    <StepperTitle>
                      <div>Empty Jars</div>
                      <div>Bottles collected</div>
                    </StepperTitle>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <CircleBtn onClick={() => setCollectedCount(c => Math.max(0, c - 1))}><FiMinus /></CircleBtn>
                      <CountText>{collectedCount}</CountText>
                      <CircleBtn onClick={() => setCollectedCount(c => c + 1)}><FiPlus /></CircleBtn>
                    </div>
                  </StepperRow>
                </Card>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ background: '#222', padding: '16px', borderRadius: '16px', border: '1px solid #2e2e2e', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: '#10B981' }}>{deliveredCount}</div>
                    <div style={{ fontSize: '10px', color: '#666', fontWeight: '700' }}>DELIVERING</div>
                  </div>
                  <div style={{ background: '#222', padding: '16px', borderRadius: '16px', border: '1px solid #2e2e2e', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: '#3B82F6' }}>{netChange >= 0 ? `+${netChange}` : netChange}</div>
                    <div style={{ fontSize: '10px', color: '#666', fontWeight: '700' }}>NET CHANGE</div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                <CardLabel style={{ textAlign: 'center' }}>Total Cash to Collect</CardLabel>
                <AmountDisplay>
                  <span className="symbol">₹</span>
                  <span className="value">{cashEntered || totalAmount}</span>
                </AmountDisplay>

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
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
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
                      <strong style={{ color: '#10B981', fontSize: '18px' }}>₹{cashEntered || totalAmount}</strong>
                    </div>
                  </div>
                </Card>
                <div style={{ padding: '24px', border: '2px dashed #e2e8f0', borderRadius: '16px', textAlign: 'center', color: '#94a3b8' }}>
                  <FiCamera size={32} style={{ marginBottom: '8px' }} />
                  <div style={{ fontSize: '12px' }}>Admin Manual Override - No Photo Required</div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ textAlign: 'center', padding: '20px 0' }}>
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
            )}
          </AnimatePresence>
        </Body>

        <Footer>
          {step < 4 ? (
            <>
              <ActionButton onClick={handleBack}><FiChevronLeft /> Back</ActionButton>
              {step === 3 ? (
                <ActionButton $variant="primary" onClick={handleConfirm} disabled={processing}>
                  {processing ? 'Processing...' : 'Confirm Delivery'} <FiCheckCircle />
                </ActionButton>
              ) : (
                <ActionButton $variant="primary" onClick={handleNext}>Next <FiChevronRight /></ActionButton>
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
