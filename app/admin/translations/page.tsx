import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { fileMessages, getDbTranslations, getLanguages } from '@/lib/i18n';
import { languageAction, saveTranslations } from '@/app/admin/actions';
import { Flash } from '@/components/admin/bits';

export default async function AdminTranslations({
  searchParams,
}: { searchParams: Promise<{ saved?: string; error?: string; lang?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [languages, settings, db] = await Promise.all([getLanguages(), getSettings(), getDbTranslations()]);
  const lang = languages.some((l) => l.code === sp.lang) ? sp.lang! : 'en';
  const keys = Object.keys(fileMessages.en);
  const value = (k: string) => db[lang]?.[k] ?? fileMessages[lang]?.[k] ?? '';
  const missing = keys.filter((k) => !value(k)).length;

  const op = (code: string, o: string, label: string, cls = 'btn-ghost') => (
    <form action={languageAction}><input type="hidden" name="op" value={o} /><input type="hidden" name="code" value={code} /><button className={`btn btn-sm ${cls}`}>{label}</button></form>
  );

  return (
    <div className="space-y-6">
      <h1 className="h2">Languages and translations</h1>
      <Flash saved={sp.saved} error={sp.error} />

      <section className="card overflow-x-auto p-6">
        <h2 className="font-semibold">Languages</h2>
        <table className="mt-3 w-full min-w-[560px]">
          <thead><tr><th className="th">Language</th><th className="th">Direction</th><th className="th">Status</th><th className="th">Actions</th></tr></thead>
          <tbody className="divide-y divide-line">
            {languages.map((l) => (
              <tr key={l.code}>
                <td className="td">{l.native_name} <span className="muted">({l.name}, {l.code})</span>{settings.defaultLanguage === l.code && <span className="badge ms-2 bg-sage-100 text-forest-700 ring-sage-300">Default</span>}</td>
                <td className="td">{l.is_rtl ? 'Right-to-left' : 'Left-to-right'}</td>
                <td className="td">{l.is_active ? 'Active' : 'Inactive'}</td>
                <td className="td"><div className="flex flex-wrap gap-2">
                  {op(l.code, 'toggle', l.is_active ? 'Deactivate' : 'Activate')}
                  {op(l.code, 'rtl', l.is_rtl ? 'Set LTR' : 'Set RTL')}
                  {l.is_active && settings.defaultLanguage !== l.code && op(l.code, 'default', 'Make default')}
                  <a href={`?lang=${l.code}`} className="btn btn-primary btn-sm">Edit text</a>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={languageAction} className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-[1fr_1.4fr_1.4fr_auto_auto]">
          <input type="hidden" name="op" value="add" />
          <input name="code" required placeholder="Code (e.g. pl)" className="input" aria-label="Language code" />
          <input name="name" required placeholder="English name" className="input" aria-label="English name" />
          <input name="native_name" required placeholder="Native name" className="input" aria-label="Native name" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_rtl" className="h-4 w-4 accent-forest-700" /> RTL</label>
          <button className="btn btn-ghost">Add language</button>
        </form>
        <p className="muted mt-2 text-xs">A new language starts empty and falls back to English until you add text below.</p>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">Edit text: {languages.find((l) => l.code === lang)?.native_name} <span className="muted font-normal">({missing} of {keys.length} strings still use the English fallback)</span></h2>
        <form action={saveTranslations} className="mt-4 space-y-4">
          <input type="hidden" name="lang" value={lang} />
          {keys.map((k) => (
            <div key={k} className="grid gap-1 sm:grid-cols-[1fr_1.4fr] sm:gap-4">
              <div className="text-xs"><code className="break-all">{k}</code><p className="muted mt-0.5">{fileMessages.en[k]}</p></div>
              <textarea name={`t:${k}`} rows={2} defaultValue={value(k)} placeholder={lang === 'en' ? '' : fileMessages.en[k]} maxLength={2000} dir={languages.find((l) => l.code === lang)?.is_rtl ? 'rtl' : 'ltr'} className="input" aria-label={k} />
            </div>
          ))}
          <button className="btn btn-primary sticky bottom-4">Save translations</button>
        </form>
        <p className="muted mt-3 text-xs">Clearing a field removes your override and restores the shipped text. Use {'{n}'}, {'{name}'}, {'{email}'} placeholders exactly as in English.</p>
      </section>
    </div>
  );
}
