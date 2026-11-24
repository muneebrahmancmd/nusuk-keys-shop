import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export const getSessionUser = cache(async () => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch {
    return null;
  }
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    return (data as Profile) ?? null;
  } catch {
    return null;
  }
});

export async function requireUser(next = '/dashboard') {
  const p = await getProfile();
  if (!p) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (p.is_suspended) redirect('/login?error=suspended');
  return p;
}

/** Server-side admin gate. Every admin page AND every admin action calls this. */
export async function requireAdmin() {
  const p = await getProfile();
  if (!p) redirect('/login?next=/admin');
  if (p.role !== 'admin' || p.is_suspended) redirect('/login?error=forbidden');
  return p;
}
