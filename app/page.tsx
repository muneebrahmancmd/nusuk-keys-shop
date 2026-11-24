import Link from 'next/link';
import { ArrowRight, BadgeCheck, Languages, LineChart, MessageCircle, ShieldCheck, Sprout } from 'lucide-react';
import { getI18n } from '@/lib/i18n';
import { getPrefs } from '@/lib/prefs';
import { getPricedPackages } from '@/lib/pricing';
import { whatsappLink } from '@/lib/whatsapp';
import { Notice, PackageCard } from '@/components/ui';

export default async function Home() {
  const [{ t, lang }, { currency, settings }] = await Promise.all([getI18n(), getPrefs()]);
  const packages = settings.dbError ? [] : (await getPricedPackages(currency).catch(() => [])).slice(0, 3);
  const wa = whatsappLink(settings.whatsapp, t('support.defaultMessage'));

  const steps = [
    { n: 1, k: 'how.step1', Icon: Sprout },
    { n: 2, k: 'how.step2', Icon: MessageCircle },
    { n: 3, k: 'how.step3', Icon: LineChart },
  ];
  const benefits = [
    { k: 'benefits.b1', Icon: BadgeCheck }, { k: 'benefits.b2', Icon: ShieldCheck },
    { k: 'benefits.b3', Icon: LineChart }, { k: 'benefits.b4', Icon: Languages },
  ];

  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,#DCE8DE,transparent),radial-gradient(40rem_24rem_at_0%_30%,#F5F0E3,transparent)]" />
        <div className="container-x relative grid gap-10 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="animate-rise">
            <span className="badge bg-sage-100 text-forest-700 ring-sage-300">{t('hero.badge')}</span>
            <h1 className="h1 mt-5">{t('hero.title')}</h1>
            <p className="muted mt-5 max-w-xl text-lg">{t('hero.subtitle')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/packages" className="btn btn-primary">
                {t('hero.cta')} <ArrowRight size={16} aria-hidden className="rtl:rotate-180" />
              </Link>
              <Link href="/#how" className="btn btn-ghost">{t('hero.secondary')}</Link>
            </div>
          </div>
          <div aria-hidden className="relative hidden lg:block">
            <div className="card relative mx-auto max-w-sm rotate-2 p-6">
              <div className="flex items-center justify-between text-xs text-charcoal-soft"><span>ORD-2026-000001</span><span className="badge bg-sage-100 text-forest-700 ring-sage-300">{t('status.processing')}</span></div>
              <div className="mt-4 grid grid-cols-6 gap-1">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={`h-1.5 rounded-full ${i < 5 ? 'bg-forest-600' : 'bg-line'}`} />
                ))}
              </div>
              <p className="mt-6 font-display text-3xl font-semibold text-forest-700">500</p>
              <p className="muted text-sm">{t('order.credits')}</p>
            </div>
          </div>
        </div>
      </section>

      {settings.dbError && (
        <div className="container-x"><Notice tone="warn">{t('error.setup')} {t('error.db')}</Notice></div>
      )}

      <section id="packages" className="container-x scroll-mt-20 py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="h2">{t('packages.title')}</h2><p className="muted mt-1">{t('packages.subtitle')}</p></div>
          <Link href="/packages" className="btn btn-ghost btn-sm">{t('packages.viewAll')}</Link>
        </div>
        {packages.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => <PackageCard key={p.id} pkg={p} currency={currency} lang={lang} t={t} />)}
          </div>
        ) : (
          <p className="card muted mt-8 p-8 text-center">{t('packages.empty')}</p>
        )}
      </section>

      <section id="how" className="container-x scroll-mt-20 py-12">
        <h2 className="h2">{t('how.title')}</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {steps.map(({ n, k, Icon }) => (
            <li key={k} className="card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage-100 text-forest-700"><Icon size={20} aria-hidden /></span>
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-forest-600">{n}</p>
              <h3 className="mt-1 font-display text-lg font-semibold">{t(`${k}.title`)}</h3>
              <p className="muted mt-2 text-sm">{t(`${k}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-x py-12">
        <h2 className="h2">{t('benefits.title')}</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(({ k, Icon }) => (
            <div key={k} className="rounded-xl2 border border-line bg-sage-100/50 p-5">
              <Icon size={20} className="text-forest-700" aria-hidden />
              <h3 className="mt-3 font-semibold">{t(`${k}.title`)}</h3>
              <p className="muted mt-1 text-sm">{t(`${k}.text`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-x max-w-3xl py-12">
        <h2 className="h2">{t('faq.title')}</h2>
        <div className="mt-6 divide-y divide-line rounded-xl2 border border-line bg-white">
          {[1, 2, 3, 4, 5].map((i) => (
            <details key={i} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {t(`faq.q${i}`)}
                <span aria-hidden className="text-forest-600 transition group-open:rotate-45">+</span>
              </summary>
              <p className="muted mt-3 text-sm">{t(`faq.a${i}`)}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="support" className="container-x scroll-mt-20 py-12">
        <div className="card flex flex-col items-start gap-4 bg-forest-800 p-8 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold">{t('support.title')}</h2>
            <p className="mt-1 max-w-xl text-sm text-sage-200">{t('support.text')}</p>
            {settings.supportInfo && <p className="mt-2 max-w-xl text-sm text-sage-300">{settings.supportInfo}</p>}
          </div>
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-wa shrink-0">
              <MessageCircle size={16} aria-hidden />{t('support.whatsapp')}
            </a>
          ) : (
            <p className="text-sm text-sage-200">{t('error.whatsapp')}</p>
          )}
        </div>
      </section>
    </>
  );
}
