/**
 * Static frontend generator for listing.reposell.dev (spec §9-§11).
 *
 * INVARIANTS:
 * - Output contains NO Stripe secrets — only public ids and links.
 * - CTA wording: "Unlock discovery" / "Get access". NEVER "Buy software",
 *   "Purchase repository", "Buy license", "Purchase package" — the Listing
 *   does not sell the software (§9).
 * - The seller's /sell link is rendered in a clearly separate section
 *   labelled as the seller's independent transaction (§12).
 * - Live health display is a client-side fetch of the seller's /health.
 */

import type { FederatedListing } from '../federation/client.js';

const FORBIDDEN_CTA = [/buy software/i, /purchase repository/i, /buy license/i, /purchase package/i];

export function renderListingPage(listing: FederatedListing): string {
  const slug = listing.product.repository;
  const price = listing.listing.discovery_price;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(slug)} — reposell listing</title>
</head>
<body>
<main>
  <h1>${escapeHtml(slug)}</h1>
  <p class="release">Release ${escapeHtml(listing.product.release)}${listing.health !== undefined ? ` · health: <span class="health" data-health-url="/health">${escapeHtml(listing.health.status)}</span>` : ''}</p>

  <section class="discovery">
    <h2>Discovery</h2>
    <p>Support reposell discovery for this product — ${price.amount} ${price.currency}, one-time.</p>
    <a class="cta" href="/discover/${encodeURIComponent(slug)}.html" rel="nofollow">Unlock discovery</a>
  </section>

  <section class="seller" data-seller-transaction="independent">
    <h2>From the seller directly</h2>
    <p>The seller runs their own independent storefront and transaction. reposell never processes it.</p>
    <a class="seller-sell" href="${escapeHtml(listing.seller.sell_url)}" rel="nofollow">Open seller's /sell</a>
  </section>
</main>
</body>
</html>
`;
}

export function renderCatalogPage(listings: FederatedListing[], errors: string[] = []): string {
  const rows = listings
    .map(
      (listing) => `<li><a href="./product/${encodeURIComponent(listing.product.repository)}.html">${escapeHtml(listing.product.repository)}</a> — ${escapeHtml(listing.product.release)}</li>`,
    )
    .join('\n');
  const errorNotes = errors.map((error) => `<li class="error">${escapeHtml(error)}</li>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>reposell listing</title></head>
<body>
<h1>reposell listing</h1>
<ul id="catalog-list">
${rows}
</ul>
${errors.length > 0 ? `<ul class="errors">\n${errorNotes}\n</ul>` : ''}
<script>
(function() {
  'use strict';
  const listEl = document.getElementById('catalog-list');
  if (!listEl) return;
  fetch('/federation/v1/snapshot.json')
    .then((res) => { if (!res.ok) throw new Error('failed to fetch snapshot'); return res.json(); })
    .then((data) => {
      const listings = (data && data.listings) || [];
      listEl.innerHTML = listings.map((listing) => {
        const repo = listing.product && listing.product.repository;
        const rel = listing.product && listing.product.release;
        if (!repo) return '';
        const a = document.createElement('a');
        a.href = './product/' + repo + '.html';
        a.textContent = repo;
        const li = document.createElement('li');
        li.appendChild(a);
        li.appendChild(document.createTextNode(' — ' + (rel || '')));
        return li.innerHTML;
      }).join('');
    })
    .catch((err) => {
      console.error('Failed to fetch snapshot:', err);
    });
})();
</script>
</body>
</html>
`;
}

/** Guard: the generated output must never violate CTA or secret rules. */
export function validateFrontendOutput(html: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  for (const pattern of FORBIDDEN_CTA) {
    if (pattern.test(html)) issues.push(`forbidden CTA wording present: ${String(pattern)}`);
  }
  if (/sk_(test|live)_|rk_|whsec_/.test(html)) issues.push('Stripe secret detected in output');
  return { ok: issues.length === 0, issues };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
