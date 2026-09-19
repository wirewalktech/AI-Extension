/* Read the same catalog as /order/. No price or payment rules are maintained here. */
(async () => {
  const root = document.querySelector('[data-catalog]');
  if (!root) return;
  const copy = await fetch('/simple/assets/services.json').then(r => { if (!r.ok) throw Error('copy'); return r.json(); }).catch(() => ({}));
  const make = (tag, text, cls) => { const el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; return el; };
  try {
    const response = await fetch('https://wirewalk-orders.wirewalk-upload.workers.dev/catalog?practice=ai');
    if (!response.ok) throw Error('catalog');
    const data = await response.json();
    if (!Array.isArray(data.items) || !data.items.length) throw Error('empty');
    root.replaceChildren();
    for (const item of data.items) {
      const article = make('article', '', 'service'); article.id = item.sku; article.dataset.sku = item.sku;
      const head = make('div', '', 'service-head'); head.append(make('h3', item.name), make('span', item.priceOnApplication ? 'Custom quote' : item.listFormatted, 'price')); article.append(head);
      article.append(make('p', copy[item.sku] || item.blurb));
      if (!item.priceOnApplication) {
        const prices = [];
        if (item.prepay) prices.push('Full payment in advance: ' + item.prepay.formatted);
        if (item.deposit) prices.push('Deposit: ' + item.deposit.formatted + ' • Remaining balance: ' + item.deposit.balanceFormatted);
        article.append(make('p', prices.join(' · '), 'small'));
      }
      const details = make('details'); details.append(make('summary', 'Full scope and payment details'), make('p', item.blurb));
      if (item.ach) details.append(make('p', 'Bank transfer: full payment ' + item.ach.fullFormatted + '; deposit ' + item.ach.depositFormatted + '; remaining balance ' + item.ach.balanceFormatted + '.', 'small'));
      article.append(details);
      const link = make('a', item.priceOnApplication ? 'Request a quote' : 'Choose this service', 'button secondary');
      link.href = '/order/?sku=' + encodeURIComponent(item.sku); article.append(link); root.append(article);
    }
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target && root.contains(target)) target.scrollIntoView({block: 'start'});
    document.querySelector('[data-catalog-status]').textContent = data.items.length + ' services. Prices in USD, loaded from the same catalog as the main site.';
  } catch (_) {
    root.replaceChildren(make('p', 'We could not load current prices. Please use the main pricing page or contact us.'));
    const link = make('a', 'Open pricing and ordering', 'button'); link.href = '/order/'; root.append(link);
    document.querySelector('[data-catalog-status]').textContent = 'Current prices are temporarily unavailable here.';
  }
})();
