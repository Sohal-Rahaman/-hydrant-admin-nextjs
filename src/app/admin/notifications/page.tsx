'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  FiBell, 
  FiSend, 
  FiClock, 
  FiUsers, 
  FiAlertCircle,
  FiX,
  FiCheck,
  FiRefreshCw
} from 'react-icons/fi';
import { 
  subscribeToCollection, 
  addDocument
} from '@/lib/firebase';

interface Notification {
  id: string;
  title: string;
  body: string;
  topic: string;
  sentAt: Date | { toDate(): Date } | string;
  sentBy: string;
  status: 'sent' | 'failed';
}

const NotificationsContainer = styled.div`
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 20px;
`;

const TitleSection = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const Title = styled.h1`
  color: #333;
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
`;

const ActionButton = styled(motion.button)`
  background: linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(142, 45, 226, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const FormContainer = styled.div`
  background: white;
  padding: 30px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #f0f0f0;
  margin-bottom: 40px;
`;

const FormTitle = styled.h2`
  color: #333;
  margin: 0 0 25px 0;
  font-size: 1.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const FormLabel = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
`;

const FormInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 1rem;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #8e2de2;
    box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1);
  }
`;

const FormTextArea = styled.textarea`
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 1rem;
  min-height: 120px;
  resize: vertical;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #8e2de2;
    box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1);
  }
`;

const FormSelect = styled.select`
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #8e2de2;
    box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 20px;
`;

const SecondaryButton = styled.button`
  background: white;
  color: #374151;
  border: 2px solid #e5e7eb;
  padding: 12px 20px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  transition: all 0.3s ease;

  &:hover {
    border-color: #8e2de2;
    color: #8e2de2;
  }
`;

const NotificationsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 25px;
  margin-bottom: 40px;
`;

const NotificationCard = styled(motion.div)<{ status: string }>`
  background: white;
  padding: 25px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #f0f0f0;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${props => props.status === 'sent' 
      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'};
  }
`;

const NotificationHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
`;

const NotificationTitle = styled.h3`
  color: #333;
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
`;

const NotificationStatus = styled.div<{ status: string }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  ${props => props.status === 'sent'
    ? `background: #d1fae5; color: #065f46;`
    : `background: #fee2e2; color: #991b1b;`
  }
`;

const NotificationBody = styled.div`
  color: #666;
  font-size: 0.95rem;
  line-height: 1.5;
  margin-bottom: 20px;
`;

const NotificationMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: #666;
  padding-top: 15px;
  border-top: 1px solid #f0f0f0;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #666;
`;

const LoadingSpinner = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  
  svg {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const InfoBox = styled.div`
  background: #e0f2fe;
  border: 1px solid #0891b2;
  color: #0c4a6e;
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 20px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.9rem;
  line-height: 1.5;
`;

const CharacterCounter = styled.div<{ $warning: boolean }>`
  text-align: right;
  font-size: 0.8rem;
  color: ${props => props.$warning ? '#ef4444' : '#666'};
  margin-top: 5px;
`;

export default function NotificationsManagement() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    topic: 'general'
  });

  // Helper function to convert various date formats to Date object
  const toDate = (dateValue: Date | { toDate(): Date } | string | number): Date => {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === 'object' && 'toDate' in dateValue) return dateValue.toDate();
    return new Date(dateValue);
  };

  useEffect(() => {
    const unsubscribe = subscribeToCollection('admin_notifications', (snapshot) => {
      try {
        const notificationsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            sentAt: data.sentAt || new Date(),
            status: data.status || 'sent'
          };
        }) as Notification[];
        
        // Sort by sent date (newest first)
        const sortedNotifications = [...notificationsData].sort((a, b) => {
          return toDate(b.sentAt).getTime() - toDate(a.sentAt).getTime();
        });
        
        setNotifications(sortedNotifications);
        setLoading(false);
      } catch (error) {
        console.error('Error processing notifications:', error);
        setLoading(false);
      }
    }, [], (error) => {
      console.error('Notifications subscription error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    
    try {
      const notificationData = {
        title: formData.title,
        body: formData.body,
        topic: formData.topic,
        sentAt: new Date(),
        sentBy: 'admin', // In a real app, this would be the actual admin user ID
        status: 'sent'
      };
      
      await addDocument('admin_notifications', notificationData);
      
      // Reset form
      setFormData({
        title: '',
        body: '',
        topic: 'general'
      });
      
      alert('Notification sent successfully!');
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Error sending notification. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      body: '',
      topic: 'general'
    });
  };

  // Character limits for FCM
  const titleCharCount = formData.title.length;
  const bodyCharCount = formData.body.length;
  const titleWarning = titleCharCount > 255;
  const bodyWarning = bodyCharCount > 1000;

  if (loading) {
    return (
      <LoadingSpinner>
        <FiRefreshCw size={40} />
      </LoadingSpinner>
    );
  }

  return (
    <NotificationsContainer>
      <Header>
        <TitleSection>
          <FiBell size={32} style={{ color: '#8e2de2' }} />
          <Title>Notification Management</Title>
        </TitleSection>
      </Header>

      <InfoBox>
        <FiBell />
        <div>
          <strong>Firebase Cloud Messaging (FCM) Notification System</strong>
          <br />• Send push notifications to all users or specific topics
          <br />• Notifications are automatically delivered to iOS and Android apps
          <br />• All sent notifications are logged for tracking purposes
          <br />• Users automatically subscribe to the 'general' topic
        </div>
      </InfoBox>

      <FormContainer>
        <FormTitle>
          <FiSend /> Send New Notification
        </FormTitle>
        
        <form onSubmit={handleSubmit}>
          <FormGroup>
            <FormLabel htmlFor="title">Notification Title *</FormLabel>
            <FormInput
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter notification title"
              required
              maxLength={255}
            />
            <CharacterCounter $warning={titleWarning}>
              {titleCharCount}/255 characters
            </CharacterCounter>
          </FormGroup>
          
          <FormGroup>
            <FormLabel htmlFor="body">Notification Body *</FormLabel>
            <FormTextArea
              id="body"
              name="body"
              value={formData.body}
              onChange={handleInputChange}
              placeholder="Enter notification message"
              required
              maxLength={1000}
            />
            <CharacterCounter $warning={bodyWarning}>
              {bodyCharCount}/1000 characters
            </CharacterCounter>
          </FormGroup>
          
          <FormGroup>
            <FormLabel htmlFor="topic">Target Topic</FormLabel>
            <FormSelect
              id="topic"
              name="topic"
              value={formData.topic}
              onChange={handleInputChange}
            >
              <option value="general">General (All Users)</option>
              <option value="promotions">Promotions</option>
              <option value="updates">App Updates</option>
              <option value="orders">Order Updates</option>
            </FormSelect>
          </FormGroup>
          
          <ButtonGroup>
            <ActionButton 
              type="submit" 
              disabled={actionLoading || titleWarning || bodyWarning}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FiSend /> {actionLoading ? 'Sending...' : 'Send Notification'}
            </ActionButton>
            
            <SecondaryButton 
              type="button" 
              onClick={resetForm}
              disabled={actionLoading}
            >
              <FiX /> Reset Form
            </SecondaryButton>
          </ButtonGroup>
        </form>
      </FormContainer>

      <h2 style={{ color: '#333', marginBottom: '20px' }}>
        <FiClock /> Recent Notifications
      </h2>
      
      <NotificationsGrid>
        {notifications.length > 0 ? (
          notifications.map((notification, index) => (
            <NotificationCard
              key={notification.id}
              status={notification.status}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <NotificationHeader>
                <NotificationTitle>{notification.title}</NotificationTitle>
                <NotificationStatus status={notification.status}>
                  {notification.status === 'sent' ? 'Sent' : 'Failed'}
                </NotificationStatus>
              </NotificationHeader>
              
              <NotificationBody>
                {notification.body}
              </NotificationBody>
              
              <NotificationMeta>
                <MetaItem>
                  <FiUsers /> {notification.topic}
                </MetaItem>
                <MetaItem>
                  <FiClock /> {toDate(notification.sentAt).toLocaleString()}
                </MetaItem>
              </NotificationMeta>
            </NotificationCard>
          ))
        ) : (
          <EmptyState>
            <FiBell size={48} style={{ marginBottom: '16px' }} />
            <h3>No Notifications Sent Yet</h3>
            <p>Send your first notification using the form above</p>
          </EmptyState>
        )}
      </NotificationsGrid>
    </NotificationsContainer>
  );
}