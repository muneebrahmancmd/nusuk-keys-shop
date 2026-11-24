import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSettings } from '@/lib/settings';
import { legalDocs } from '@/lib/legal';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = legalDocs('', '')[slug];
  return { title: doc?.title ?? 'Legal' };
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  const s = await getSettings();
  const doc = legalDocs(s.siteName, s.adminEmail)[slug];
  if (!doc) notFound();
  return (
    <article className="container-x max-w-3xl py-12">
      <h1 className="h2">{doc.title}</h1>
      <div className="mt-6 space-y-6">
        {doc.sections.map((sec) => (
          <section key={sec.h}>
            <h2 className="text-lg font-semibold">{sec.h}</h2>
            {sec.p.map((p, i) => <p key={i} className="muted mt-2">{p}</p>)}
          </section>
        ))}
      </div>
    </article>
  );
}
