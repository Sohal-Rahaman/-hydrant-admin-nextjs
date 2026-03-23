// CSV Export Utility Functions
// Handles conversion of user data to CSV format with proper escaping and formatting

interface Address {
  id: string;
  userId: string;
  type: string;
  addressLine?: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  isDefault: boolean;
  createdAt: Date | { toDate(): Date } | string;
}

interface Order {
  id: string;
  userId: string;
  status: string;
  quantity: number;
  amount?: number;
  total?: number;
  createdAt: Date | { toDate(): Date } | string;
  [key: string]: unknown;
}

interface Subscription {
  id: string;
  userId: string;
  isActive: boolean;
  plan: string;
  startDate: Date | { toDate(): Date } | string;
  endDate?: Date | { toDate(): Date } | string;
  nextDelivery?: Date | { toDate(): Date } | string;
  frequency?: string;
  deliverySlot?: string;
  planPrice?: number;
  totalDeliveries?: number;
  remainingDeliveries?: number;
  createdAt: Date | { toDate(): Date } | string;
}

export interface UserDataForCSV {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phoneNumber: string;
  wallet_balance: number;
  totalCoins: number;
  totalShares: number;
  jars_occupied: number;
  createdAt: Date | { toDate(): Date } | string;
  addresses: Address[];
  orders: Order[];
  subscription?: Subscription;
}

/**
 * Helper function to convert various date formats to readable string
 */
const formatDate = (date: Date | { toDate(): Date } | string | number | undefined): string => {
  if (!date) return 'N/A';

  let d: Date;

  if (typeof date === 'string' || typeof date === 'number') {
    d = new Date(date);
  } else if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    d = date.toDate();
  } else if (date instanceof Date) {
    d = date;
  } else {
    return 'N/A';
  }

  if (isNaN(d.getTime())) return 'N/A';

  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Escape special characters for CSV format
 * Handles commas, quotes, and newlines
 */
const escapeCSV = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null) return '';

  const stringValue = String(value);

  // If the value contains comma, quote, or newline, wrap it in quotes and escape existing quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

/**
 * Format addresses into a readable string for CSV
 * Multiple addresses are joined with " | "
 */
const formatAddresses = (addresses: Address[]): string => {
  if (!addresses || addresses.length === 0) return 'No Address';

  return addresses.map(addr => {
    const parts = [
      addr.addressLine || `${addr.apartment || ''} ${addr.street || ''}`.trim(),
      addr.city || '',
      addr.state || '',
      addr.pincode || ''
    ].filter(Boolean);

    const addressType = addr.type ? addr.type.toUpperCase() : 'ADDRESS';
    return `${addressType}: ${parts.join(', ')}`;
  }).join(' | ');
};

/**
 * Calculate order statistics for a user
 */
const calculateOrderStats = (orders: Order[]) => {
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === 'completed').length;
  const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
  const totalQuantity = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + (o.quantity || 1), 0);
  const totalRevenue = totalQuantity * 37; // ₹37 per jar

  // Get first and last order dates
  const sortedOrders = [...orders].sort((a, b) => {
    const dateA = new Date(a.createdAt instanceof Date ? a.createdAt :
      typeof a.createdAt === 'object' && 'toDate' in a.createdAt ? a.createdAt.toDate() :
        a.createdAt);
    const dateB = new Date(b.createdAt instanceof Date ? b.createdAt :
      typeof b.createdAt === 'object' && 'toDate' in b.createdAt ? b.createdAt.toDate() :
        b.createdAt);
    return dateA.getTime() - dateB.getTime();
  });

  const firstOrderDate = sortedOrders.length > 0 ? formatDate(sortedOrders[0].createdAt) : 'N/A';
  const lastOrderDate = sortedOrders.length > 0 ? formatDate(sortedOrders[sortedOrders.length - 1].createdAt) : 'N/A';

  return {
    totalOrders,
    completedOrders,
    cancelledOrders,
    totalRevenue,
    firstOrderDate,
    lastOrderDate
  };
};

/**
 * Convert user data to CSV row
 */
export const userToCSVRow = (user: UserDataForCSV): string => {
  const orderStats = calculateOrderStats(user.orders);
  const addresses = formatAddresses(user.addresses);

  const subscriptionStatus = user.subscription?.isActive ? 'Active' : 'Inactive';
  const subscriptionPlan = user.subscription?.plan || 'N/A';
  const subscriptionFrequency = user.subscription?.frequency || 'N/A';

  const row = [
    escapeCSV(user.customerId),
    escapeCSV(user.name),
    escapeCSV(user.email),
    escapeCSV(user.phoneNumber),
    escapeCSV(user.wallet_balance),
    escapeCSV(user.totalCoins || 0),
    escapeCSV(user.totalShares || 0),
    escapeCSV(user.jars_occupied || 0),
    escapeCSV(addresses),
    escapeCSV(orderStats.totalOrders),
    escapeCSV(orderStats.completedOrders),
    escapeCSV(orderStats.cancelledOrders),
    escapeCSV(orderStats.totalRevenue),
    escapeCSV(subscriptionStatus),
    escapeCSV(subscriptionPlan),
    escapeCSV(subscriptionFrequency),
    escapeCSV(formatDate(user.createdAt)),
    escapeCSV(orderStats.firstOrderDate),
    escapeCSV(orderStats.lastOrderDate)
  ];

  return row.join(',');
};

/**
 * Generate CSV header row
 */
export const getCSVHeaders = (): string => {
  const headers = [
    'Customer ID',
    'Name',
    'Email',
    'Phone Number',
    'Wallet Balance (₹)',
    'Total Coins',
    'Total Shares',
    'Jars Occupied',
    'Addresses',
    'Total Orders',
    'Completed Orders',
    'Cancelled Orders',
    'Total Revenue (₹)',
    'Subscription Status',
    'Subscription Plan',
    'Subscription Frequency',
    'User Created Date',
    'First Order Date',
    'Last Order Date'
  ];

  return headers.map(h => escapeCSV(h)).join(',');
};

/**
 * Convert array of users to complete CSV string
 */
export const generateCSV = (users: UserDataForCSV[]): string => {
  const header = getCSVHeaders();
  const rows = users.map(user => userToCSVRow(user));

  return [header, ...rows].join('\n');
};

/**
 * Download CSV file to user's computer
 */
export const downloadCSV = (csvContent: string, filename: string = 'data.csv'): void => {
  // Create a Blob from the CSV content
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create a temporary download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup
  URL.revokeObjectURL(url);
};

/**
 * Generate filename with current date
 */
export const generateFilename = (prefix: string = 'export'): string => {
  const date = new Date();
  const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
  return `${prefix}_${dateString}.csv`;
};
