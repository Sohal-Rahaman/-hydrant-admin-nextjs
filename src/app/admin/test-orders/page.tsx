'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

export default function TestOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        const ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setOrders(ordersData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching orders:', error);
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  if (loading) {
    return <div>Loading orders...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Order Status Test</h1>
      <p>Total orders: {orders.length}</p>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Status Distribution</h2>
        {(() => {
          const statusCounts: Record<string, number> = {};
          orders.forEach(order => {
            const status = order.status || 'undefined';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
          });
          
          return (
            <ul>
              {Object.entries(statusCounts).map(([status, count]) => (
                <li key={status}>{status}: {count}</li>
              ))}
            </ul>
          );
        })()}
      </div>
      
      <div>
        <h2>All Orders</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>ID</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Status</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Customer</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Amount</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{order.id.substring(0, 8)}...</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: order.status === 'completed' ? '#d1fae5' : 
                                   order.status === 'cancelled' ? '#fee2e2' : 
                                   order.status === 'processing' ? '#dbeafe' : '#fef3c7',
                    color: order.status === 'completed' ? '#065f46' : 
                           order.status === 'cancelled' ? '#991b1b' : 
                           order.status === 'processing' ? '#1e40af' : '#92400e',
                    fontWeight: 'bold'
                  }}>
                    {order.status || 'undefined'}
                  </span>
                </td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  {order.customerName || order.userName || 'N/A'}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>₹{order.total || order.amount || 'N/A'}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : 
                   order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}