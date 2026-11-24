import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Pkg } from '@/lib/types';

export interface PricedPackage extends Pkg {
  unit_price: number | null;
  is_estimate: boolean;
}

/**
 * Active packages with their price in `currency`. The numbers come from the
 * database function quote_packages(), the same code path checkout uses, so the
 * price on screen can never disagree with the price on the order.
 */
export async function getPricedPackages(currency: string): Promise<PricedPackage[]> {
  const supabase = await createClient();
  const [{ data: pkgs }, { data: quotes }] = await Promise.all([
    supabase.from('packages').select('*').eq('is_active', true).order('sort_order').order('credit_quantity'),
    supabase.rpc('quote_packages', { p_currency: currency }),
  ]);
  const q = new Map<string, { unit_price: number; is_estimate: boolean }>();
  for (const r of (quotes ?? []) as any[]) q.set(r.package_id, { unit_price: Number(r.unit_price), is_estimate: r.is_estimate });
  return ((pkgs ?? []) as Pkg[]).map((p) => ({
    ...p,
    unit_price: q.get(p.id)?.unit_price ?? null,
    is_estimate: q.get(p.id)?.is_estimate ?? false,
  }));
}

export async function getPricedPackage(id: string, currency: string): Promise<PricedPackage | null> {
  const supabase = await createClient();
  const [{ data: pkg }, { data: quote }] = await Promise.all([
    supabase.from('packages').select('*').eq('id', id).eq('is_active', true).maybeSingle(),
    supabase.rpc('quote_price', { p_package: id, p_currency: currency }),
  ]);
  if (!pkg) return null;
  const r = Array.isArray(quote) ? quote[0] : quote;
  return { ...(pkg as Pkg), unit_price: r ? Number(r.unit_price) : null, is_estimate: !!r?.is_estimate };
}
