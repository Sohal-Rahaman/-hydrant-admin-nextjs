'use client';

import React, { useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiMenu, 
  FiX, 
  FiHome, 
  FiPackage, 
  FiUsers, 
  FiBarChart, 
  FiLogOut,
  FiMapPin,
  FiUserX,
  FiTag,
  FiBell,
  FiActivity,
  FiShield,
  FiTruck,
  FiBriefcase,
  FiRepeat,
  FiCreditCard,
  FiArchive,
  FiFlag,
  FiDollarSign,
  FiAlertCircle,
  FiMessageSquare,
  FiShoppingCart,
  FiGift,
  FiLink,
  FiGrid,
  FiLock
} from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';

const LayoutContainer = styled.div`
  display: flex;
  height: 100vh;
  background: var(--background);
`;

const Sidebar = styled.div<{ $isOpen: boolean }>`
  width: 260px;
  background: var(--color-background-secondary);
  color: var(--foreground);
  padding: 0;
  position: fixed;
  height: 100vh;
  left: 0;
  top: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
  border-right: 1px solid var(--color-border-primary);

  @media (max-width: 1024px) {
    width: 100%;
    transform: ${props => props.$isOpen ? 'translateX(0)' : 'translateX(-100%)'};
  }

  @media (min-width: 1025px) {
    transform: translateX(0);
  }
`;

const SidebarHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid var(--color-border-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Logo = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const LogoImage = styled(Image)`
  width: 45px;
  height: 45px;
  border-radius: 8px;
  object-fit: cover;
`;

const BrandText = styled.span`
  font-family: 'Fira Code', monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-accent-cyan);
  letter-spacing: -0.5px;
  text-transform: uppercase;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  display: none;
  padding: 5px;
  border-radius: 4px;
  transition: background 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 1024px) {
    display: block;
  }
`;

const NavMenu = styled.nav`
  padding: 20px 0;
  flex: 1;
  overflow-y: auto;
  
  /* Custom Scrollbar for premium feel */
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(167, 243, 208, 0.1);
    border-radius: 10px;
  }
`;

const NavItem = styled.button<{ $active?: boolean }>`
  width: 100%;
  padding: 10px 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.15s ease;
  user-select: none;
  background: none;
  border: none;
  border-left: 2px solid transparent;
  color: var(--color-text-secondary);
  text-align: left;

  &:hover {
    background: rgba(0, 229, 255, 0.05);
    color: var(--color-accent-cyan);
    border-left: 2px solid rgba(0, 229, 255, 0.3);
  }
  
  ${props => props.$active && `
    background: rgba(0, 229, 255, 0.08);
    color: var(--color-accent-cyan);
    font-weight: 600;
    border-left: 2px solid var(--color-accent-cyan);
  `}

  svg {
    font-size: 1.2rem;
  }
  
  @media (max-width: 1024px) {
    padding: 20px 25px; /* Larger padding for mobile */
    font-size: 1.1rem;
  }
`;

const UserInfo = styled.div`
  padding: 20px;
  background: var(--color-background-tertiary);
  border-top: 1px solid var(--color-border-primary);
`;

const UserProfile = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 15px;
`;

const UserAvatar = styled(Image)`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
`;

const UserDetails = styled.div`
  flex: 1;
`;

const UserName = styled.div`
  font-weight: 600;
  font-size: 0.9rem;
`;

const UserRole = styled.div`
  font-size: 0.8rem;
  opacity: 0.7;
`;

const LogoutButton = styled.button`
  width: 100%;
  background: rgba(248, 113, 113, 0.05);
  border: 1px solid rgba(248, 113, 113, 0.2);
  color: var(--color-text-danger);
  padding: 10px;
  border-radius: var(--radius-technical);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(248, 113, 113, 0.1);
    border-color: var(--color-text-danger);
  }
`;

const MainContent = styled.div`
  flex: 1;
  margin-left: 260px;
  min-height: 100vh;
  background: var(--background);
  transition: margin-left 0.3s ease;

  @media (max-width: 1024px) {
    margin-left: 0;
  }
`;

const MobileTopbar = styled.div`
  display: none;
  background: white;
  padding: 15px 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 999;

  @media (max-width: 1024px) {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
`;

const MenuButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #333;
`;

const MobileTitle = styled.div`
  margin: 0;
  color: #333;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const MobileLogo = styled(Image)`
  width: 30px;
  height: 30px;
  border-radius: 6px;
  object-fit: cover;
`;

const ContentArea = styled.div`
  padding: 20px;
  min-height: calc(100vh - 70px);

  @media (max-width: 768px) {
    padding: 15px;
  }
  
  @media (max-width: 480px) {
    padding: 10px;
  }
`;

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: none;

  @media (max-width: 1024px) {
    display: block;
  }
`;

const RestrictedContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
  text-align: center;
  background: rgba(15, 23, 42, 0.02);
`;

const RestrictedIcon = styled.div`
  font-size: 4rem;
  color: #ef4444;
  margin-bottom: 24px;
  animation: pulse 2s infinite;

  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  }
`;

const RestrictedTitle = styled.h2`
  font-size: 1.8rem;
  font-weight: 800;
  margin-bottom: 12px;
  color: #1e293b;
`;

const RestrictedText = styled.p`
  color: #64748b;
  max-width: 400px;
  margin-bottom: 32px;
  line-height: 1.6;
`;

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { userData, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const navigationItems = [
    { path: '/admin', label: 'Dashboard', icon: FiHome, permission: 'all' },
    { path: '/admin/orders', label: 'Orders', icon: FiPackage, permission: 'orders' },
    { path: '/admin/create-order', label: 'Create Order', icon: FiShoppingCart, permission: 'orders' },
    { path: '/admin/users', label: 'Users', icon: FiUsers, permission: 'crm' },
    { path: '/admin/users?mode=fleet', label: 'Fleet Board', icon: FiGrid, permission: 'fleet' },
    { path: '/admin/crm', label: 'CRM & Leads', icon: FiBriefcase, permission: 'crm' },
    { path: '/admin/subscriptions', label: 'Subscriptions', icon: FiRepeat, permission: 'orders' },
    { path: '/admin/wallet', label: 'Wallet Mgmt', icon: FiCreditCard, permission: 'wallet' },
    { path: '/admin/referrals', label: 'Referrals', icon: FiGift, permission: 'marketing' },
    { path: '/admin/jars', label: 'Jar Holdings', icon: FiArchive, permission: 'inventory' },
    { path: '/admin/trials', label: 'Trial Customers', icon: FiFlag, permission: 'orders' },
    { path: '/admin/dues', label: 'Due Amounts', icon: FiAlertCircle, permission: 'wallet' },
    { path: '/admin/expenses', label: 'Expenses', icon: FiDollarSign, permission: 'wallet' },
    { path: '/admin/army', label: 'Army Management', icon: FiTruck, permission: 'fleet' },
    { path: '/admin/support', label: 'Support Tickets', icon: FiMessageSquare, permission: 'support' },
    { path: '/admin/admins', label: 'Manage Roles', icon: FiLock, permission: 'staff' },
    { path: '/admin/coupons', label: 'Coupons', icon: FiTag, permission: 'marketing' },
    { path: '/admin/activity', label: 'Activity Log', icon: FiActivity, permission: 'staff' },
    { path: '/admin/notifications', label: 'Notifications', icon: FiBell, permission: 'all' },
    { path: '/admin/deletion-requests', label: 'Deletion Requests', icon: FiUserX, permission: 'staff' },
    { path: '/admin/delivery', label: 'Delivery Map', icon: FiMapPin, permission: 'fleet' },
    { path: '/admin/analytics', label: 'Analytics', icon: FiBarChart, permission: 'analytics' },
    { path: '/admin/settings/integrations', label: 'App Integrations', icon: FiLink, permission: 'all' },
  ];

  const { permissions = [], role } = useAuth();
  const filteredNavigationItems = navigationItems.filter(item => {
    // Grant full access if permissions include 'all' OR if role is admin/superadmin
    if (permissions.includes('all') || role === 'superadmin' || role === 'admin') return true;
    return permissions.includes(item.permission);
  });

  const isAccessDenied = navigationItems.some(item => 
    item.path.split('?')[0] === pathname && 
    !filteredNavigationItems.some(f => f.path === item.path)
  );

  const handleNavClick = (path: string) => {
    console.log('🚀 Navigating to:', path);
    console.log('Current pathname:', pathname);
    console.log('Router available:', !!router);
    
    if (!router) {
      console.error('❌ Router not available');
      return;
    }
    
    try {
      router.push(path);
      setSidebarOpen(false);
      console.log('✅ Navigation successful');
    } catch (error) {
      console.error('❌ Navigation error:', error);
    }
  };
  
  const handleNavKeyPress = (event: React.KeyboardEvent, path: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNavClick(path);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getCurrentPageTitle = () => {
    const currentItem = navigationItems.find(item => item.path === pathname);
    return currentItem ? currentItem.label : 'Dashboard';
  };

  return (
    <LayoutContainer>
      <AnimatePresence>
        {sidebarOpen && (
          <Overlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <Sidebar $isOpen={sidebarOpen}>
        <SidebarHeader>
          <Logo>
            <LogoImage 
              src="/hydrantlogo.png" 
              alt="Hydrant Logo"
              width={45}
              height={45}
            />
            <BrandText>Hydrant Admin</BrandText>
          </Logo>
          <CloseButton onClick={() => setSidebarOpen(false)}>
            <FiX />
          </CloseButton>
        </SidebarHeader>

        <NavMenu>
          {filteredNavigationItems.map((item) => (
            <NavItem
              key={item.path}
              $active={pathname === item.path}
              onClick={() => handleNavClick(item.path)}
              onKeyDown={(e) => handleNavKeyPress(e, item.path)}
              type="button"
              tabIndex={0}
            >
              <item.icon />
              {item.label}
            </NavItem>
          ))}
        </NavMenu>

        <UserInfo>
          <UserProfile>
            <UserAvatar 
              src={userData?.photoURL || '/hydrantlogo.png'} 
              alt="User Avatar"
              width={40}
              height={40}
            />
            <UserDetails>
              <UserName>{userData?.displayName || 'Admin User'}</UserName>
              <UserRole>Administrator</UserRole>
            </UserDetails>
          </UserProfile>
          <LogoutButton onClick={handleLogout}>
            <FiLogOut />
            Logout
          </LogoutButton>
        </UserInfo>
      </Sidebar>

      <MainContent>
        <MobileTopbar>
          <MenuButton onClick={() => setSidebarOpen(true)}>
            <FiMenu />
          </MenuButton>
          <MobileTitle>
            <MobileLogo 
              src="/hydrantlogo.png" 
              alt="Hydrant Logo"
              width={30}
              height={30}
            />
            {getCurrentPageTitle()}
          </MobileTitle>
          <div /> {/* Spacer for center alignment */}
        </MobileTopbar>

        <ContentArea>
          {isAccessDenied ? (
            <RestrictedContainer>
              <RestrictedIcon>
                <FiLock />
              </RestrictedIcon>
              <RestrictedTitle>Access Restricted</RestrictedTitle>
              <RestrictedText>
                You don't have the required permissions to access this module. 
                Please contact a superadmin if you believe this is an error.
              </RestrictedText>
              <NavItem 
                $active={false} 
                onClick={() => router.push('/admin')}
                style={{ width: 'auto', background: '#3b82f6', color: 'white' }}
              >
                Return to Dashboard
              </NavItem>
            </RestrictedContainer>
          ) : (
            children
          )}
        </ContentArea>
      </MainContent>
    </LayoutContainer>
  );
};

export default AdminLayout;