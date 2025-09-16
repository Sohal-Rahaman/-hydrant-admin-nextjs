'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/admin');
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)',
      color: 'white',
      fontSize: '1.5rem'
    }}>
      Redirecting to Admin Dashboard...
    </div>
  );
}
