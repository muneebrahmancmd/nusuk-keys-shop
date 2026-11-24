import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Wrench } from 'lucide-react';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getI18n } from '@/lib/i18n';
import { getSettings } from '@/lib/settings';
import { getProfile } from '@/lib/auth';

const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(site),
    title: { default: s.siteName, template: `%s · ${s.siteName}` },
    description: s.siteDescription,
    openGraph: { title: s.siteName, description: s.siteDescription, type: 'website', siteName: s.siteName },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#244F37' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ t, lang, dir }, settings] = await Promise.all([getI18n(), getSettings()]);
  const path = (await headers()).get('x-pathname') ?? '/';

  let maintenance = false;
  if (settings.maintenance && !['/login', '/auth', '/admin'].some((p) => path.startsWith(p))) {
    maintenance = (await getProfile())?.role !== 'admin';
  }

  return (
    <html lang={lang} dir={dir}>
      <body className="flex min-h-screen flex-col">
        {maintenance ? (
          <main className="container-x flex flex-1 flex-col items-center justify-center py-24 text-center">
            <Wrench className="text-forest-600" size={40} aria-hidden />
            <h1 className="h2 mt-4">{t('maintenance.title')}</h1>
            <p className="muted mt-2 max-w-md">{t('maintenance.text')}</p>
          </main>
        ) : (
          <>
            <Navbar />
            {settings.announcement && (
              <div className="bg-forest-700 px-4 py-2 text-center text-sm text-white">{settings.announcement}</div>
            )}
            <main className="flex-1">{children}</main>
            <Footer />
          </>
        )}
      </body>
    </html>
  );
}
