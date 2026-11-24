import type { MetadataRoute } from 'next';

const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/', '/packages', '/login', '/legal/privacy', '/legal/terms', '/legal/refund', '/legal/contact'];
  return paths.map((p) => ({ url: `${site}${p}`, changeFrequency: 'weekly', priority: p === '/' ? 1 : 0.6 }));
}
