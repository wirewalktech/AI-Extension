(function () {
  'use strict';
  const form = document.querySelector('.project-form');
  if (!form) return;
  // Attribution travels with the inquiry; no cookies, pixel, or cross-page storage.
  // Never send the full query string or referrer path, which could contain private data.
  const params = new URLSearchParams(window.location.search);
  const clean = value => String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 160);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const value = clean(params.get(key));
    if (value) form.elements.namedItem(key).value = value;
  }
  try {
    const host = new URL(document.referrer).hostname;
    if (host && host !== location.hostname) {
      form.elements.namedItem('referrer_host').value = clean(host);
      if (!params.get('utm_source') && /(^|\.)reddit\.com$/i.test(host)) {
        form.elements.namedItem('utm_source').value = 'reddit';
        form.elements.namedItem('utm_medium').value = 'referral';
      }
    }
  } catch (_) { /* A missing referrer is normal. */ }
  // Native POST reaches the existing durable inquiry endpoint with or without JS.
})();
