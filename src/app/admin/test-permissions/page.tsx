'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function TestPermissionsPage() {
  const { currentUser, isAdmin } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          setError('User document not found');
        }
      } catch (err: any) {
        setError(`Error fetching user data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Permission Test</h1>
      
      {error && (
        <div style={{ 
          background: '#fee2e2', 
          color: '#991b1b', 
          padding: '15px', 
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Authentication Status</h2>
        <p><strong>User ID:</strong> {currentUser?.uid || 'Not authenticated'}</p>
        <p><strong>Email:</strong> {currentUser?.email || 'N/A'}</p>
        <p><strong>Is Admin:</strong> {isAdmin ? 'Yes' : 'No'}</p>
      </div>
      
      {userData && (
        <div style={{ marginBottom: '20px' }}>
          <h2>User Data</h2>
          <pre style={{ 
            background: '#f3f4f6', 
            padding: '15px', 
            borderRadius: '8px',
            overflow: 'auto'
          }}>
            {JSON.stringify(userData, null, 2)}
          </pre>
        </div>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Dashboard Stats Test</h2>
        <button 
          onClick={async () => {
            try {
              const statsDoc = await getDoc(doc(db, 'dashboard_stats', 'live_metrics'));
              if (statsDoc.exists()) {
                alert('Dashboard stats document exists and is accessible');
                console.log('Dashboard stats data:', statsDoc.data());
              } else {
                alert('Dashboard stats document does not exist');
              }
            } catch (err: any) {
              alert(`Error accessing dashboard stats: ${err.message}`);
              console.error('Error accessing dashboard stats:', err);
            }
          }}
          style={{
            background: '#8e2de2',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Test Dashboard Stats Access
        </button>
      </div>
    </div>
  );
}