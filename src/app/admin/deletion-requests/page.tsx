'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { subscribeToCollection, deleteDocument, deleteUser } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

// Interfaces
interface DeletionRequest {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  reason: string;
  createdAt: any;
}

const DeletionRequestsPage = () => {
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<DeletionRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { userData } = useAuth();

  useEffect(() => {
    if (!userData?.isAdmin) return;

    const unsubscribe = subscribeToCollection('account_deletion_requests', (snapshot) => {
      const formattedRequests = snapshot.docs.map((doc) => ({
        id: doc.id,
        userId: doc.data().userId || '',
        name: doc.data().name || '',
        email: doc.data().email || '',
        phone: doc.data().phone || '',
        reason: doc.data().reason || '',
        createdAt: doc.data().createdAt || new Date(),
      }));
      
      setDeletionRequests(formattedRequests);
      setLoading(false);
    }, [], (error) => {
      console.error('Error fetching deletion requests:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  const filteredRequests = deletionRequests.filter(request => {
    const searchLower = searchTerm.toLowerCase();
    return (
      request.name.toLowerCase().includes(searchLower) ||
      request.email.toLowerCase().includes(searchLower) ||
      request.phone.toLowerCase().includes(searchLower)
    );
  });

  const handleDeleteUser = async (request: DeletionRequest) => {
    if (!request.userId) {
      alert('User ID is missing. Cannot delete user.');
      return;
    }

    setIsDeleting(true);
    try {
      // Delete the user from Firebase Authentication
      await deleteUser(request.userId);
      
      // Delete the user document from Firestore
      await deleteDocument('users', request.userId);
      
      // Delete the deletion request
      await deleteDocument('account_deletion_requests', request.id);
      
      setIsModalOpen(false);
      setSelectedRequest(null);
      alert(`User ${request.name} has been successfully deleted.`);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(`Failed to delete user: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const openModal = (request: DeletionRequest) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRequest(null);
  };

  if (loading) {
    return <LoadingSpinner>Loading deletion requests...</LoadingSpinner>;
  }

  return (
    <Container>
      <Header>
        <Title>Account Deletion Requests</Title>
        <SearchContainer>
          <SearchInput
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </SearchContainer>
      </Header>

      {filteredRequests.length === 0 ? (
        <EmptyState>
          <p>No deletion requests found.</p>
        </EmptyState>
      ) : (
        <RequestsGrid>
          {filteredRequests.map((request) => (
            <RequestCard
              key={request.id}
              as={motion.div}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => openModal(request)}
            >
              <RequestName>{request.name}</RequestName>
              <RequestEmail>{request.email}</RequestEmail>
              <RequestPhone>{request.phone}</RequestPhone>
              <RequestDate>
                Requested: {request.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
              </RequestDate>
              <DeleteButton onClick={(e) => {
                e.stopPropagation();
                openModal(request);
              }}>
                Delete User
              </DeleteButton>
            </RequestCard>
          ))}
        </RequestsGrid>
      )}

      {isModalOpen && selectedRequest && (
        <ModalOverlay onClick={closeModal}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>Confirm User Deletion</ModalTitle>
              <CloseButton onClick={closeModal}>×</CloseButton>
            </ModalHeader>
            <ModalBody>
              <p>Are you sure you want to delete this user?</p>
              <InfoBox>
                <p><strong>Name:</strong> {selectedRequest.name}</p>
                <p><strong>Email:</strong> {selectedRequest.email}</p>
                <p><strong>Phone:</strong> {selectedRequest.phone}</p>
                <p><strong>Reason for deletion:</strong> {selectedRequest.reason || 'Not provided'}</p>
              </InfoBox>
              <WarningText>
                This action cannot be undone. The user will be permanently deleted from both authentication and database.
              </WarningText>
            </ModalBody>
            <ModalFooter>
              <CancelButton onClick={closeModal} disabled={isDeleting}>Cancel</CancelButton>
              <ConfirmButton 
                onClick={() => handleDeleteUser(selectedRequest)} 
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </ConfirmButton>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}
    </Container>
  );
};

// Styled Components
const Container = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
`;

const Title = styled.h1`
  font-size: 24px;
  color: #333;
  margin: 0;
`;

const SearchContainer = styled.div`
  width: 300px;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  &:focus {
    outline: none;
    border-color: #0070f3;
  }
`;

const RequestsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
`;

const RequestCard = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const RequestName = styled.h3`
  margin: 0;
  font-size: 18px;
  color: #333;
`;

const RequestEmail = styled.p`
  margin: 0;
  font-size: 14px;
  color: #666;
`;

const RequestPhone = styled.p`
  margin: 0;
  font-size: 14px;
  color: #666;
`;

const RequestDate = styled.p`
  margin: 0;
  font-size: 12px;
  color: #999;
`;

const DeleteButton = styled.button`
  background-color: #ff4d4f;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 10px;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #ff7875;
  }
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 18px;
  color: #666;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  background-color: #f9f9f9;
  border-radius: 8px;
  text-align: center;
  color: #666;
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 20px;
  color: #333;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  &:hover {
    color: #333;
  }
`;

const ModalBody = styled.div`
  padding: 20px;
`;

const InfoBox = styled.div`
  background-color: #f9f9f9;
  border-radius: 4px;
  padding: 15px;
  margin: 15px 0;
  
  p {
    margin: 5px 0;
  }
`;

const WarningText = styled.p`
  color: #ff4d4f;
  font-size: 14px;
  margin-top: 15px;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 15px 20px;
  border-top: 1px solid #eee;
  gap: 10px;
`;

const CancelButton = styled.button`
  background-color: #f5f5f5;
  color: #333;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #e8e8e8;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ConfirmButton = styled.button`
  background-color: #ff4d4f;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #ff7875;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export default DeletionRequestsPage;