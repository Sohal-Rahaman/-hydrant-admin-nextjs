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
  FiMaximize2
} from 'react-icons/fi';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  db,
  doc,
  updateDoc
} from '@/lib/firebase';

interface KYCRequest {
  id: string;
  userId: string;
  userName: string;
  address: string;
  documentUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: any;
}

const PageContainer = styled.div`
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 800;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const KYCGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 24px;
`;

const KYCCard = styled(motion.div)`
  background: white;
  border-radius: 24px;
  padding: 24px;
  border: 1px solid #f3f4f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const DocumentPreview = styled.div`
  width: 100%;
  height: 200px;
  background: #f9fafb;
  border-radius: 16px;
  border: 2px dashed #e5e7eb;
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
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.3);
    opacity: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    transition: opacity 0.2s;
  }

  &:hover .overlay {
    opacity: 1;
  }
`;

const ActionButton = styled.button<{ variant: 'approve' | 'reject' }>`
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  cursor: pointer;

  ${props => props.variant === 'approve' ? `
    background: #10b981;
    color: white;
    box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);
    &:hover { background: #059669; }
  ` : `
    background: white;
    color: #ef4444;
    border: 1px solid #fee2e2;
    &:hover { background: #fef2f2; }
  `}
`;

export default function KYCPage() {
  const [requests, setRequests] = useState<KYCRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'kyc_requests'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as KYCRequest[];
      setRequests(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    await updateDoc(doc(db, 'kyc_requests', id), {
      status,
      processedAt: new Date()
    });
    alert(`Request ${status} successfully!`);
  };

  if (loading) return <div className="p-10 text-center font-bold">Loading KYC Queue...</div>;

  return (
    <PageContainer>
      <Header>
        <Title><FiShield /> Address KYC Queue</Title>
        <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-sm font-black">
          {requests.length} Pending Requests
        </div>
      </Header>

      <KYCGrid>
        {requests.map(request => (
          <KYCCard key={request.id} layout>
            <div className="flex justify-between items-start">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-100">
                  {request.userName?.[0] || 'U'}
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-800">{request.userName || 'Anonymous User'}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <FiCalendar size={12}/> {request.submittedAt?.toDate ? request.submittedAt.toDate().toLocaleString() : 'Just now'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl">
              <div className="flex items-start gap-2">
                 <FiMapPin className="text-indigo-600 mt-1 flex-shrink-0" />
                 <p className="text-sm text-gray-700 font-medium leading-relaxed">{request.address}</p>
              </div>
            </div>

            <DocumentPreview>
              {request.documentUrl ? (
                <img src={request.documentUrl} alt="KYC Document" />
              ) : (
                <div className="text-center p-8">
                  <FiMaximize2 className="mx-auto mb-2 opacity-20" size={32} />
                  <p className="text-xs font-bold text-gray-400">View Document Proof</p>
                </div>
              )}
              <div className="overlay">
                 <FiEye size={24} />
              </div>
            </DocumentPreview>

            <div className="flex gap-3">
               <ActionButton variant="reject" onClick={() => handleAction(request.id, 'rejected')}>
                 <FiX /> Reject
               </ActionButton>
               <ActionButton variant="approve" onClick={() => handleAction(request.id, 'approved')}>
                 <FiCheck /> Approve Address
               </ActionButton>
            </div>
          </KYCCard>
        ))}

        {requests.length === 0 && (
          <div className="col-span-full py-32 text-center bg-white rounded-3xl border-2 border-dashed border-gray-100">
             <FiShield size={64} className="mx-auto mb-4 text-gray-200" />
             <h2 className="text-xl font-extrabold text-gray-400">KYC Queue Clear</h2>
             <p className="text-gray-400 text-sm mt-2">All address verification requests have been processed.</p>
          </div>
        )}
      </KYCGrid>
    </PageContainer>
  );
}
