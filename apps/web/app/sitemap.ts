import type { MetadataRoute } from 'next';
import { siteUrl } from '../lib/site';
export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/chinh-sach-bao-mat'].map((path) => ({
    url: new URL(path, siteUrl).href,
  }));
}
