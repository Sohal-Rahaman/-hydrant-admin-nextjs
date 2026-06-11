import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  increment,
  runTransaction,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { B2BClient, B2BLedgerEntry } from '@/types/b2b';

const CLIENTS_COLLECTION = 'b2b_clients';
const LEDGER_COLLECTION = 'b2b_ledgers';

/**
 * Registry: Create a new B2B Client
 */
export const createB2BClient = async (clientData: Omit<B2BClient, 'id' | 'createdAt' | 'updatedAt'>) => {
  try {
    const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), {
      ...clientData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      financialSummary: {
        totalRevenue: 0,
        outstandingAmount: 0,
        advanceBalance: 0
      },
      jarInventory: {
        totalAllocated: 0,
        atClient: 0,
        inTransit: 0
      }
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating B2B client:', error);
    throw error;
  }
};

/**
 * Fetch all B2B clients
 */
export const getB2BClients = async (status?: string) => {
  try {
    let q = query(collection(db, CLIENTS_COLLECTION), orderBy('companyName', 'asc'));
    if (status) {
      q = query(q, where('status', '==', status));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as B2BClient));
  } catch (error) {
    console.error('Error fetching B2B clients:', error);
    throw error;
  }
};

export const getClients = async (): Promise<B2BClient[]> => {
  try {
    const q = query(collection(db, CLIENTS_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as B2BClient));
  } catch (error) {
    console.error('Error fetching B2B clients:', error);
    throw error;
  }
};

export const getClientById = async (clientId: string): Promise<B2BClient | null> => {
  try {
    const docRef = doc(db, CLIENTS_COLLECTION, clientId);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as B2BClient;
    }
    return null;
  } catch (error) {
    console.error('Error fetching client by ID:', error);
    throw error;
  }
};

export const getLedgerEntries = async (clientId: string, limitCount = 100): Promise<B2BLedgerEntry[]> => {
  try {
    // Note: orderBy removed to avoid composite index requirement.
    // Firestore only needs a single-field index for the `where` clause.
    // We sort client-side after fetching.
    const q = query(
      collection(db, LEDGER_COLLECTION),
      where('clientId', '==', clientId),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as B2BLedgerEntry));
    // Sort descending by timestamp client-side
    return entries.sort((a, b) => {
      const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
      const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error('Error fetching ledger entries:', error);
    throw error;
  }
};

export const getClientOrders = async (clientId: string): Promise<any[]> => {
  try {
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', clientId)
    );
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort descending by createdAt timestamp client-side to prevent index requirements
    return orders.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return bTime - aTime;
    });
  } catch (error) {
    console.error('Error fetching client orders:', error);
    return [];
  }
};

/**
 * Fetch single B2B client by ID
 */
export const getB2BClient = async (id: string) => {
  try {
    const docSnap = await getDoc(doc(db, CLIENTS_COLLECTION, id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as B2BClient;
    }
    return null;
  } catch (error) {
    console.error('Error fetching B2B client:', error);
    throw error;
  }
};

/**
 * Update Client Inventory & Financial Ledger (Atomic)
 * This is the core 'DSA' implementation to prevent race conditions in bulk logistics.
 */
export const recordLedgerEntry = async (entry: Omit<B2BLedgerEntry, 'id' | 'timestamp'>) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const clientRef = doc(db, CLIENTS_COLLECTION, entry.clientId);
      const clientDoc = await transaction.get(clientRef);
      
      if (!clientDoc.exists()) throw new Error('Client does not exist');

      // Create ledger record
      const ledgerRef = doc(collection(db, LEDGER_COLLECTION));
      transaction.set(ledgerRef, {
        ...entry,
        timestamp: serverTimestamp()
      });

      // Update client aggregates based on entry type
      const updates: any = { updatedAt: serverTimestamp() };

      switch (entry.type) {
        case 'jar_delivery':
          updates['jarInventory.atClient'] = increment(entry.jarCount || 0);
          break;
        case 'jar_return':
          updates['jarInventory.atClient'] = increment(-(entry.jarCount || 0));
          break;
        case 'invoice_issued':
          updates['financialSummary.outstandingAmount'] = increment(entry.amount || 0);
          break;
        case 'payment_received':
          updates['financialSummary.outstandingAmount'] = increment(-(entry.amount || 0));
          updates['financialSummary.totalRevenue'] = increment(entry.amount || 0);
          updates['financialSummary.lastPaymentDate'] = serverTimestamp();
          updates['financialSummary.lastPaymentAmount'] = entry.amount;
          break;
      }

      transaction.update(clientRef, updates);
      return ledgerRef.id;
    });
  } catch (error) {
    console.error('Error recording ledger entry:', error);
    throw error;
  }
};

/**
 * Record a full delivery handover (Atomic)
 * Handles delivered jars, returned jars, and financial impact in one step.
 */
export const recordHandover = async (data: {
  clientId: string,
  delivered: number,
  returned: number,
  pricePerJar: number,
  notes?: string,
  deliveredJarIds?: string[],
  returnedJarIds?: string[],
  staffId?: string,
}) => {
  const netJarChange = data.delivered - data.returned;
  const deliveryAmount = data.delivered * data.pricePerJar;

  return await runTransaction(db, async (transaction) => {
    const clientRef = doc(db, CLIENTS_COLLECTION, data.clientId);
    const clientDoc = await transaction.get(clientRef);
    if (!clientDoc.exists()) throw new Error('Client not found');

    const ledgerRef = doc(collection(db, LEDGER_COLLECTION));
    transaction.set(ledgerRef, {
      clientId: data.clientId,
      type: 'delivery_handover',
      deliveredCount: data.delivered,
      returnedCount: data.returned,
      jarCount: netJarChange,
      amount: deliveryAmount,
      recordedBy: data.staffId || 'admin_panel',
      timestamp: serverTimestamp(),
      description: data.notes || `Daily Handover: ${data.delivered} Delivered, ${data.returned} Returned`,
      metadata: {
        deliveredJarIds: data.deliveredJarIds || [],
        returnedJarIds: data.returnedJarIds || []
      }
    });

    transaction.update(clientRef, {
      'jarInventory.atClient': increment(netJarChange),
      'financialSummary.outstandingAmount': increment(deliveryAmount),
      'financialSummary.totalRevenue': increment(deliveryAmount),
      updatedAt: serverTimestamp()
    });

    return ledgerRef.id;
  });
};

/**
 * Generate a monthly billing statement
 * Aggregates all deliveries between two dates.
 */
export const generateMonthlyStatement = async (clientId: string, startDate: Date, endDate: Date) => {
  try {
    const q = query(
      collection(db, LEDGER_COLLECTION),
      where('clientId', '==', clientId),
      where('timestamp', '>=', Timestamp.fromDate(startDate)),
      where('timestamp', '<=', Timestamp.fromDate(endDate))
    );

    const snapshot = await getDocs(q);
    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as B2BLedgerEntry));

    const summary = entries.reduce((acc, entry) => {
      if (entry.type === 'delivery_handover' || entry.type === 'jar_delivery') {
        acc.totalDelivered += (entry.deliveredCount || entry.jarCount || 0);
        acc.totalReturned += (entry.returnedCount || 0);
        acc.totalAmount += (entry.amount || 0);
      }
      return acc;
    }, { totalDelivered: 0, totalReturned: 0, totalAmount: 0 });

    return {
      clientId,
      period: { start: startDate, end: endDate },
      ...summary,
      entries
    };
  } catch (error) {
    console.error('Error generating statement:', error);
    throw error;
  }
};

/**
 * Fetch all ledger entries across all clients, ordered chronologically
 */
export const getAllLedgerEntries = async (limitCount = 100): Promise<B2BLedgerEntry[]> => {
  try {
    const q = query(
      collection(db, LEDGER_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as B2BLedgerEntry));
  } catch (error) {
    console.error('Error fetching all ledger entries:', error);
    throw error;
  }
};
