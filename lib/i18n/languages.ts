import type { Language } from '@/lib/types';

/** Used when the `languages` table is unreachable, and as the source of truth for middleware detection. */
export const DEFAULT_LANGUAGES: Language[] = [
  ['en', 'English', 'English', false], ['ar', 'Arabic', 'العربية', true], ['ur', 'Urdu', 'اردو', true],
  ['hi', 'Hindi', 'हिन्दी', false], ['fa', 'Persian', 'فارسی', true], ['tr', 'Turkish', 'Türkçe', false],
  ['fr', 'French', 'Français', false], ['de', 'German', 'Deutsch', false], ['es', 'Spanish', 'Español', false],
  ['pt', 'Portuguese', 'Português', false], ['ru', 'Russian', 'Русский', false], ['zh', 'Chinese', '中文', false],
  ['ja', 'Japanese', '日本語', false], ['ko', 'Korean', '한국어', false], ['bn', 'Bengali', 'বাংলা', false],
  ['id', 'Indonesian', 'Bahasa Indonesia', false], ['ms', 'Malay', 'Bahasa Melayu', false],
  ['it', 'Italian', 'Italiano', false], ['nl', 'Dutch', 'Nederlands', false], ['sw', 'Swahili', 'Kiswahili', false],
].map(([code, name, native_name, is_rtl], i) => ({
  code: code as string, name: name as string, native_name: native_name as string,
  is_rtl: is_rtl as boolean, is_active: true, sort_order: i + 1,
}));

export const DEFAULT_LANGUAGE_CODES = DEFAULT_LANGUAGES.map((l) => l.code);
