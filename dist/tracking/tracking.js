const form = document.querySelector('#tracking-form');
const input = document.querySelector('#tracking-reference');
const search = document.querySelector('#tracking-search');
const message = document.querySelector('#tracking-message');
const result = document.querySelector('#tracking-result');
const timeline = document.querySelector('#tracking-timeline');
const details = document.querySelector('#tracking-details');
const button = form.querySelector('button');
const dateFormatter = new Intl.DateTimeFormat('en-GB', {day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'});
const icons = {
  truck: '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h19v18H3zM22 14h6l5 6v6H22z"/><circle cx="10" cy="27" r="3"/><circle cx="27" cy="27" r="3"/></svg>',
  dispatch: '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 10h26v22H5zM11 10V6h14v4M5 16h26M11 20v6h14v-6M14 20h8"/></svg>',
  facility: '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 15 18 6l15 9v17H3zM8 15h20M11 32V21h14v11M15 26h6"/></svg>',
  box: '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 3 14 8v16l-14 8L4 27V11zM4 11l14 8 14-8M18 19v16M11 7l14 8"/></svg>'
};
let pending;

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
}

function formatTime(value) {
  const time = String(value || '').trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(time);
  if (!match) return time;
  const hour = Number(match[1]);
  return `${String(hour % 12 || 12).padStart(2, '0')}:${match[2]} ${hour < 12 ? 'AM' : 'PM'}`;
}

function addText(parent, tag, className, value) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = value;
  parent.append(node);
  return node;
}

function iconFor(status) {
  if (/transit|delivered|delivery/i.test(status)) return icons.truck;
  if (/dispatch|pickup|collected/i.test(status)) return icons.dispatch;
  if (/process|sort|facility|hub/i.test(status)) return icons.facility;
  return icons.box;
}

function renderShipment(shipment, reference) {
  const events = Array.isArray(shipment.history) ? shipment.history : [];
  const ordered = events.filter(event => event && typeof event === 'object').reverse();
  const displayedReference = String(shipment.reference || shipment.trackingNumber || reference);
  document.querySelector('#result-reference').textContent = displayedReference;
  const status = String(shipment.status || '');
  const badge = document.querySelector('#result-status');
  badge.textContent = status;
  badge.hidden = !status;
  badge.classList.toggle('is-active', /transit|out for delivery/i.test(status));
  badge.classList.toggle('is-delivered', /^delivered$/i.test(status));
  const latest = ordered.find(event => formatDate(event.date));
  const updatedDate = formatDate(latest?.date || shipment.bookingDate);
  const updatedTime = formatTime(latest?.time);
  const updatedNode = document.querySelector('#result-updated');
  updatedNode.textContent = [updatedDate, updatedTime].filter(Boolean).join(', ') || 'Not available';
  if (latest?.date && updatedDate) updatedNode.dateTime = latest.date;
  else updatedNode.removeAttribute('datetime');

  timeline.replaceChildren();
  document.querySelector('#tracking-empty').hidden = ordered.length > 0;
  for (const event of ordered) {
    const item = document.createElement('li');
    item.className = 'tracking-event';
    item.classList.toggle('has-details', Boolean(event.description || event.location));
    const marker = addText(item, 'span', 'tracking-marker', '✓');
    marker.setAttribute('aria-hidden', 'true');
    const icon = addText(item, 'span', 'tracking-event-icon', '');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = iconFor(String(event.status || ''));
    const body = addText(item, 'div', 'tracking-event-copy', '');
    addText(body, 'h2', '', String(event.status || 'Shipment update'));
    if (event.description) addText(body, 'p', 'tracking-description', String(event.description));
    if (event.location) addText(body, 'p', 'tracking-location', String(event.location));
    const date = formatDate(event.date);
    const time = formatTime(event.time);
    if (date || time) {
      const timeNode = addText(item, 'time', 'tracking-event-time', '');
      if (date) addText(timeNode, 'span', '', date);
      if (time) addText(timeNode, 'span', '', time);
      if (date) timeNode.dateTime = event.date;
    }
    timeline.append(item);
  }

  details.replaceChildren();
  const fields = [
    ['Origin', shipment.origin],
    ['Destination', shipment.destination],
    ['Carrier AWB', shipment.trackingNumber && shipment.trackingNumber !== displayedReference ? shipment.trackingNumber : ''],
    ['Booked', formatDate(shipment.bookingDate)],
    ['Expected delivery', formatDate(shipment.expectedDeliveryDate)]
  ];
  for (const [label, value] of fields) {
    if (!value) continue;
    const group = document.createElement('div');
    addText(group, 'dt', '', label);
    addText(group, 'dd', '', String(value));
    details.append(group);
  }
  details.hidden = !details.childElementCount;
  result.hidden = false;
  search.hidden = true;
  document.title = `Tracking ${displayedReference} | 3A Logistics`;
  document.querySelector('#result-reference').focus({preventScroll: true});
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const reference = input.value.trim();
  input.value = reference;
  if (!form.reportValidity()) return;
  pending?.abort();
  pending = new AbortController();
  const signal = pending.signal;
  result.hidden = true;
  search.hidden = false;
  showMessage('Looking up your shipment…');
  button.disabled = true;
  window.history.replaceState(null, '', `${window.location.pathname}?awb=${encodeURIComponent(reference)}`);
  try {
    const response = await fetch(`/api/tracking?awb=${encodeURIComponent(reference)}`, {signal, cache: 'no-store', headers: {Accept: 'application/json'}, credentials: 'omit'});
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Tracking is temporarily unavailable. Please try again later.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Tracking is temporarily unavailable. Please try again later.');
    if (!data.shipment) throw new Error('No shipment was found for that tracking number. Please check it and try again.');
    renderShipment(data.shipment, reference);
    showMessage('');
  } catch (error) {
    if (error.name !== 'AbortError') showMessage(error.message);
  } finally {
    if (!signal.aborted) button.disabled = false;
  }
});

document.querySelector('#track-another').addEventListener('click', () => {
  result.hidden = true;
  search.hidden = false;
  showMessage('');
  input.value = '';
  document.title = 'Track Your Shipment | 3A Logistics';
  window.history.replaceState(null, '', window.location.pathname);
  search.scrollIntoView({behavior: 'smooth', block: 'start'});
  input.focus({preventScroll: true});
});

const initialReference = new URLSearchParams(window.location.search).get('awb');
if (initialReference) {
  input.value = initialReference.trim();
  form.requestSubmit();
}
