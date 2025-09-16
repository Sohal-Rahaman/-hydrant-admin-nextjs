'use client';

import AdminRoute from '@/components/AdminRoute';
import AdminLayout from '@/components/AdminLayout';

export default function AdminLayoutPage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminRoute>
      <AdminLayout>
        {children}
      </AdminLayout>
    </AdminRoute>
  );
}