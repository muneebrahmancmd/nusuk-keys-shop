import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';

const NAV: [string, string][] = [
  ['/admin', 'Overview'], ['/admin/orders', 'Orders'], ['/admin/packages', 'Packages'], ['/admin/customers', 'Customers'],
  ['/admin/support', 'Support'], ['/admin/notifications', 'Emails'], ['/admin/translations', 'Languages'], ['/admin/settings', 'Settings'],
];

export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="container-x py-8">
      <nav aria-label="Admin" className="-mx-1 mb-8 flex gap-1 overflow-x-auto pb-2">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="btn btn-ghost btn-sm shrink-0">{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
