'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCheck, 
  FiX, 
  FiEye, 
  FiMapPin, 
  FiUser, 
  FiCalendar,
  FiShield,
  FiMaximize2,
  FiAlertCircle,
  FiClock
} from 'react-icons/fi';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface KYCRequest {
  id: string;
  userId: string;
  userName: string;
  address: string;
  documentUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: any;
}

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 800;
  color: #f0f0f0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 24px;
`;

const KYCCard = styled(motion.div)`
  background: #181818;
  border: 1px solid #2e2e2e;
  border-radius: 24px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  transition: all 0.2s;

  &:hover {
    border-color: #444;
  }
`;

const DocumentPreview = styled.div`
  width: 100%;
  height: 220px;
  background: #0f0f0f;
  border: 1px solid #2e2e2e;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  position: relative;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
  }

  &:hover img {
    transform: scale(1.05);
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.4);
    opacity: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s;
    color: white;
    gap: 8px;
    font-weight: 700;
  }

  &:hover .overlay {
    opacity: 1;
  }
`;

const StatusPill = styled.div<{ status: string }>`
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;

  ${props => {
    switch (props.status) {
      case 'approved': return 'background: rgba(16, 185, 129, 0.1); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.2);';
      case 'rejected': return 'background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.2);';
      default: return 'background: rgba(245, 158, 11, 0.1); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.2);';
    }
  }}
`;

const InfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  color: #aaa;
  font-size: 13px;

  svg { color: #10B981; }
`;

const ActionButton = styled.button<{ variant: 'approve' | 'reject' | 'ghost' }>`
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  ${props => {
    switch (props.variant) {
      case 'approve': return 'background: #10B981; color: white; &:hover { background: #059669; }';
      case 'reject': return 'background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.2); &:hover { background: #EF4444; color: white; }';
      default: return 'background: #222; color: #666; &:hover { background: #2a2a2a; }';
    }
  }}
`;

export default function KYCManagementPage() {
  const [requests, setRequests] = useState<KYCRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'kyc_requests'), where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const kycData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as KYCRequest[];
      setRequests(kycData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'kyc_requests', id), { status });
    } catch (error) {
       console.error(error);
       alert('Verification update failed');
    }
  };

  if (loading) return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', padding: '100px', textAlign: 'center', color: '#666' }}>
      Calibrating KYC Verifier...
    </div>
  );

  return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', color: '#f0f0f0' }}>
      <Container>
        <TopBar>
          <Title><FiShield /> Verification Gateway</Title>
          <div style={{ background: '#181818', border: '1px solid #2e2e2e', padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiClock /> {requests.length} Pending Audits
          </div>
        </TopBar>

        {requests.length === 0 ? (
          <div style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #2e2e2e', borderRadius: '32px', color: '#666', textAlign: 'center', padding: '100px' }}>
            <FiShield size={48} style={{ opacity: 0.1, marginBottom: '24px' }} />
            <p style={{ fontWeight: 600 }}>All user verifications are up to date. No pending audits.</p>
          </div>
        ) : (
          <Grid>
            {requests.map((request) => (
              <KYCCard
                key={request.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981', fontWeight: 800 }}>
                      {request.userName?.[0] || 'U'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>{request.userName}</div>
                      <div style={{ fontSize: '11px', color: '#666' }}>User ID: #{request.userId.slice(-8).toUpperCase()}</div>
                    </div>
                  </div>
                  <StatusPill status={request.status}>{request.status}</StatusPill>
                </div>

                <DocumentPreview onClick={() => setSelectedImage(request.documentUrl || null)}>
                  {request.documentUrl ? (
                    <>
                      <img src={request.documentUrl} alt="KYC Document" />
                      <div className="overlay"><FiMaximize2 /> Inspect Document</div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#666' }}>
                      <FiEye size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                      <p style={{ fontSize: '12px', fontWeight: 600 }}>No document attachment</p>
                    </div>
                  )}
                </DocumentPreview>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <InfoRow><FiMapPin size={14} /> {request.address || 'Address not listed'}</InfoRow>
                  <InfoRow><FiCalendar size={14} /> Submitted {new Date(request.submittedAt?.seconds * 1000).toLocaleDateString()}</InfoRow>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <ActionButton variant="approve" onClick={() => handleStatusUpdate(request.id, 'approved')}>
                    <FiCheck /> Approve
                  </ActionButton>
                  <ActionButton variant="reject" onClick={() => handleStatusUpdate(request.id, 'rejected')}>
                    <FiX /> Reject
                  </ActionButton>
                </div>
              </KYCCard>
            ))}
          </Grid>
        )}

        <AnimatePresence>
          {selectedImage && (
            <ModalOverlay
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedImage(null)}
            >
              <img 
                src={selectedImage} 
                style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '24px', boxShadow: '0 24px 48px rgba(0,0,0,0.5)', border: '2px solid #2e2e2e' }} 
                alt="Document Full View" 
              />
              <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
                <ActionButton variant="ghost" onClick={() => setSelectedImage(null)} style={{ padding: '12px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', color: 'white' }}>
                  <FiX size={24} />
                </ActionButton>
              </div>
            </ModalOverlay>
          )}
        </AnimatePresence>
      </Container>
    </div>
  );
}

const ModalOverlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.9);
  backdrop-filter: blur(20px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
`;
