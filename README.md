# 💧 Hydrant Admin Panel

A comprehensive admin dashboard for managing water delivery services built with Next.js 15.5.3 and Firebase.

## ✨ Features

### 📊 **Real-Time Dashboard**
- Live KPI metrics with Firebase integration
- Today's Revenue, Processing Orders, New Customers tracking
- Interactive charts and analytics
- Mobile-responsive design

### 📦 **Order Management**
- Multi-section order organization (700030 Dum Dum, 700074 Salt Lake City, Subscriptions)
- Time-based sorting and pincode filtering
- Delivery confirmation with complex business logic
- Google Maps integration for navigation

### 👥 **User Management**
- Comprehensive user search and filtering
- Multi-collection Firebase integration (users, addresses)
- CRUD operations with real-time updates
- Customer ID generation and management

### 📈 **Analytics Dashboard**
- Interactive charts using Recharts library
- Daily order trends and revenue tracking
- Order status distribution visualization
- Real-time data updates from Firebase

## 🛠️ Tech Stack

- **Frontend**: Next.js 15.5.3 with TypeScript
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth with Google Sign-in
- **Styling**: Styled Components
- **Charts**: Recharts
- **Maps**: Google Maps API
- **Animation**: Framer Motion
- **Icons**: React Icons (Feather)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase project
- Google Maps API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hydrant-admin-nextjs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file with your Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Firebase Setup**
   - Deploy Firestore security rules from `firestore.rules`
   - Create required collections: `users`, `orders`, `addresses`, `subscriptions`, `dashboard_stats`

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📱 Responsive Design

The admin panel is fully responsive and optimized for:
- **Desktop**: Full-featured dashboard with sidebar navigation
- **Tablet**: Adaptive layout with touch-friendly controls
- **Mobile**: Collapsible navigation with mobile-optimized interface

## 🔥 Key Features Implementation

### Dashboard KPI Calculations
- **Today's Revenue**: `delivered_orders_quantity × ₹37`
- **Processing Orders**: `pending + processing status orders`
- **New Customers Today**: `users joined within 24 hours`
- **Total Orders**: `all orders combined`
- **Total Users**: `total registered users`
- **Total Revenue**: `all delivered orders × ₹37`

### Real-Time Data Integration
- Firebase Firestore real-time listeners
- Automatic UI updates on data changes
- Optimized performance with dashboard_stats collection
- Error handling and fallback mechanisms

## 🔧 Firebase Collections Structure

### Users Collection
```javascript
{
  name: string,
  phone: string,
  email: string,
  customerId: string,
  createdAt: timestamp,
  isAdmin?: boolean
}
```

### Orders Collection
```javascript
{
  orderId: string,
  customerId: string,
  customerName: string,
  quantity: number,
  status: "pending" | "processing" | "delivered" | "cancelled",
  address: {
    full: string,
    pincode: string,
    area: string
  },
  createdAt: timestamp
}
```

### Dashboard Stats Collection
```javascript
{
  todayRevenue: number,
  processingOrders: number,
  newCustomersToday: number,
  totalOrders: number,
  totalUsers: number,
  totalRevenue: number,
  lastUpdated: timestamp
}
```

## 🔐 Security Rules

The project includes comprehensive Firebase security rules that:
- Allow users to access only their own data
- Provide admin users with full access
- Secure sensitive operations
- Maintain data integrity

## 📊 Analytics Features

- **Daily Order Trends**: 7-day order and quantity tracking
- **Revenue Analytics**: Real-time revenue calculations
- **Status Distribution**: Visual order status breakdown
- **Area Analytics**: Performance by pincode/area
- **Interactive Charts**: Responsive Recharts integration

## 🗺️ Navigation Structure

- **Dashboard** (`/admin`): KPI overview and real-time metrics
- **Orders** (`/admin/orders`): Order management with filtering
- **Users** (`/admin/users`): User management and search
- **Analytics** (`/admin/analytics`): Detailed charts and insights

## 🎨 Design System

- **Brand Colors**: Purple gradient theme with accent colors
- **Typography**: Clean, modern font hierarchy
- **Components**: Reusable styled components
- **Animation**: Smooth Framer Motion transitions
- **Icons**: Consistent Feather icon set

## 🚀 Deployment

### Vercel (Recommended)
1. Push to GitHub repository
2. Connect to Vercel
3. Add environment variables
4. Deploy automatically

### Manual Deployment
```bash
npm run build
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Developer

**Sohal Rahaman**
- GitHub: [@sohalrahaman](https://github.com/sohalrahaman)
- Email: sohalrahaman007@gmail.com
- 

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Firebase for real-time database capabilities
- Recharts for beautiful chart components
- All the open-source contributors

---

**Built with ❤️ for efficient water delivery management**
