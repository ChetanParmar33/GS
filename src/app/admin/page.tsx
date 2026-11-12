import { getAdminSession } from '@/lib/auth';
import { AdminDashboard } from '@/components/AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getAdminSession();
  return (
    <AdminDashboard
      initialAuthenticated={session.authenticated}
      initialEmail={session.email}
      authMode={session.mode}
    />
  );
}

