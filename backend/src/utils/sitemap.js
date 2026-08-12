export function snippet(text, max) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max).replace(/\s+\S*$/, '');
  return `${cut}…`;
}

export function buildSitemapXml({ baseUrl, corePages, fears }) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = [];

  for (const page of corePages) {
    const lastmod = page.loc === '/' ? `<lastmod>${today}</lastmod>` : '';
    entries.push(
      `  <url><loc>${baseUrl}${page.loc}</loc>${lastmod}` +
        (page.changefreq ? `<changefreq>${page.changefreq}</changefreq>` : '') +
        (page.priority ? `<priority>${page.priority}</priority>` : '') +
        '</url>'
    );
  }

  for (const fear of fears) {
    const lastmod = fear.created_at ? `<lastmod>${String(fear.created_at).slice(0, 10)}</lastmod>` : '';
    entries.push(`  <url><loc>${baseUrl}/miedo/${fear.id}</loc>${lastmod}<priority>0.7</priority></url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>`;
}

export function isWorkersDevHost(hostname) {
  return hostname.endsWith('.workers.dev');
}
