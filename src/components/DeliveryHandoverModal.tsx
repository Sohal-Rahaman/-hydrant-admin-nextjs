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
  background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
  z-index: 2000; display: flex; align-items: center; justify-content: center;
  padding: 16px;
`;

const ModalContent = styled(motion.div)`
  background: var(--bg-primary, #ffffff);
  width: 100%; max-width: 480px; max-height: 95vh; border-radius: 24px;
  overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2);
  display: flex; flex-direction: column;
  position: relative;
`;

const Header = styled.div`
  padding: 24px 20px 16px; display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid rgba(0,0,0,0.05);
`;

const Title = styled.h2`font-size: 20px; font-weight: 800; color: #1a1a18;`;

const StepIndicator = styled.div`
  display: flex; gap: 8px; justify-content: center; padding: 12px;
`;

const Dot = styled.div<{ $active?: boolean; $done?: boolean }>`
  width: 8px; height: 8px; border-radius: 4px;
  background: ${props => props.$active ? '#10b981' : props.$done ? '#10b981' : '#e5e7eb'};
  transition: all 0.3s ease;
  ${props => props.$active && 'width: 24px;'}
`;

const Body = styled.div`padding: 24px 20px; flex: 1; overflow-y: auto;`;

const Card = styled.div`
  background: #fdfdfd; border-radius: 20px; padding: 20px; margin-bottom: 20px;
  border: 1px solid #f1f5f9; box-shadow: 0 2px 4px rgba(0,0,0,0.02);
`;

const CardLabel = styled.div`font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 12px;`;

const StepperRow = styled.div`display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;`;

const StepperTitle = styled.div`
  div:first-child { font-weight: 700; color: #1e293b; font-size: 16px; }
  div:last-child { font-size: 12px; color: #94a3b8; }
`;

const StepperActions = styled.div`display: flex; align-items: center; gap: 16px;`;

const CircleBtn = styled.button`
  width: 40px; height: 40px; border-radius: 20px; border: 1px solid #e2e8f0;
  background: white; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s; color: #1e293b;
  &:hover { background: #f8fafc; border-color: #cbd5e1; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const CountText = styled.span`font-size: 20px; font-weight: 800; min-width: 24px; text-align: center;`;

const MetricGrid = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 12px;`;

const MetricCard = styled.div<{ $color: string }>`
  background: white; padding: 12px; border-radius: 16px; border: 1px solid #f1f5f9; text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  .val { font-size: 20px; font-weight: 800; color: ${props => props.$color}; }
  .lbl { font-size: 10px; color: #94a3b8; font-weight: 700; margin-top: 2px; text-transform: uppercase; }
`;

// --- Numpad Styles ---
const NumpadGrid = styled.div`display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 24px;`;
const NumBtn = styled.button`
  height: 64px; border-radius: 16px; border: 1px solid #f1f5f9; background: white;
  font-size: 24px; font-weight: 700; color: #1e293b; cursor: pointer;
  &:hover { background: #f8fafc; }
  &:active { background: #f1f5f9; transform: scale(0.95); }
`;

const AmountDisplay = styled.div`
  text-align: center; margin: 32px 0;
  .symbol { font-size: 24px; color: #94a3b8; margin-right: 4px; }
  .value { font-size: 56px; font-weight: 800; color: #1e293b; letter-spacing: -1px; }
`;

const WarningBox = styled(motion.div)`
  background: #fffbeb; border: 1px solid #fef3c7; padding: 16px; border-radius: 12px;
  display: flex; gap: 12px; margin-bottom: 16px; color: #92400e;
`;

const Footer = styled.div`
  padding: 16px 20px 24px; border-top: 1px solid #f1f5f9; display: flex; gap: 12px;
  background: white; z-index: 10;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  flex: 1; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; border: none;
  background: ${props => props.$variant === 'primary' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#f8f9fa'};
  color: ${props => props.$variant === 'primary' ? 'white' : '#475569'};
  box-shadow: ${props => props.$variant === 'primary' ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none'};
  transition: all 0.2s ease;
  &:hover { opacity: 0.9; transform: translateY(-1px); }
  &:active { transform: translateY(0); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
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
                    <StepperActions>
                      <CircleBtn onClick={() => setDeliveredCount(c => Math.max(1, c - 1))}><FiMinus /></CircleBtn>
                      <CountText>{deliveredCount}</CountText>
                      <CircleBtn onClick={() => setDeliveredCount(c => c + 1)}><FiPlus /></CircleBtn>
                    </StepperActions>
                  </StepperRow>

                  <StepperRow>
                    <StepperTitle>
                      <div>Empty Jars</div>
                      <div>Bottles collected</div>
                    </StepperTitle>
                    <StepperActions>
                      <CircleBtn onClick={() => setCollectedCount(c => Math.max(0, c - 1))}><FiMinus /></CircleBtn>
                      <CountText>{collectedCount}</CountText>
                      <CircleBtn onClick={() => setCollectedCount(c => c + 1)}><FiPlus /></CircleBtn>
                    </StepperActions>
                  </StepperRow>
                </Card>

                <MetricGrid>
                  <MetricCard $color="#10b981">
                    <div className="val">{deliveredCount}</div>
                    <div className="lbl">DELIVERING</div>
                  </MetricCard>
                  <MetricCard $color="#3b82f6">
                    <div className="val">{netChange >= 0 ? `+${netChange}` : netChange}</div>
                    <div className="lbl">NET CHANGE</div>
                  </MetricCard>
                </MetricGrid>
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
                  <WarningBox initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <FiInfo size={20} style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '13px' }}>
                      <strong>Amount Mismatch</strong><br />
                      Due: ₹{totalAmount}. Entered: ₹{cashEntered}. Continue if this is intended.
                    </div>
                  </WarningBox>
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
                      <span style={{ color: '#64748b' }}>Collected</span>
                      <strong style={{ color: '#f59e0b' }}>{collectedCount} Empty</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                      <span style={{ color: '#1e293b', fontWeight: '700' }}>Amount Collected</span>
                      <strong style={{ color: '#10b981', fontSize: '18px' }}>₹{cashEntered || totalAmount}</strong>
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
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Status written</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px' }}>status</span>
                    <strong style={{ fontSize: '13px' }}>delivered</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px' }}>jars_occupied</span>
                    <strong style={{ fontSize: '13px' }}>updated {netChange >= 0 ? `+${netChange}` : netChange}</strong>
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
