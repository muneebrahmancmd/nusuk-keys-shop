import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { cookies } from 'next/headers';
import en from '@/messages/en.json';
import others from '@/messages/translations.json';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSettings } from '@/lib/settings';
import { DEFAULT_LANGUAGES } from './languages';
import type { Language } from '@/lib/types';

/** Messages shipped in the repo. */
export const fileMessages: Record<string, Record<string, string>> = {
  en: en as Record<string, string>,
  ...(others as Record<string, Record<string, string>>),
};

const loadLanguages = unstable_cache(
  async (): Promise<Language[]> => {
    const { data } = await createAdminClient().from('languages').select('*').order('sort_order');
    return data?.length ? (data as Language[]) : DEFAULT_LANGUAGES;
  },
  ['languages'],
  { tags: ['languages'], revalidate: 300 },
);

const loadDbTranslations = unstable_cache(
  async (): Promise<Record<string, Record<string, string>>> => {
    const { data } = await createAdminClient()
      .from('translations')
      .select('language_code,translation_key,translation_value');
    const out: Record<string, Record<string, string>> = {};
    for (const r of data ?? []) (out[r.language_code] ??= {})[r.translation_key] = r.translation_value;
    return out;
  },
  ['translations'],
  { tags: ['translations'], revalidate: 300 },
);

export const getLanguages = cache(async (): Promise<Language[]> => {
  try { return await loadLanguages(); } catch { return DEFAULT_LANGUAGES; }
});

export const getDbTranslations = cache(async () => {
  try { return await loadDbTranslations(); } catch { return {}; }
});

export const getLang = cache(async (): Promise<string> => {
  const [languages, settings, store] = await Promise.all([getLanguages(), getSettings(), cookies()]);
  const active = new Set(languages.filter((l) => l.is_active).map((l) => l.code));
  const wanted = store.get('lang')?.value;
  if (wanted && active.has(wanted)) return wanted;
  return active.has(settings.defaultLanguage) ? settings.defaultLanguage : 'en';
});

/**
 * t(key): DB override (chosen language) -> shipped file (chosen language)
 *       -> DB override (English) -> shipped English -> the key itself.
 * A missing translation therefore always falls back to English.
 */
export const getI18n = cache(async () => {
  const [lang, db, languages] = await Promise.all([getLang(), getDbTranslations(), getLanguages()]);
  const dir: 'rtl' | 'ltr' = languages.find((l) => l.code === lang)?.is_rtl ? 'rtl' : 'ltr';
  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = db[lang]?.[key] ?? fileMessages[lang]?.[key] ?? db.en?.[key] ?? fileMessages.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
  return { t, lang, dir, languages };
});
