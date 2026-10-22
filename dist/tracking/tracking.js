import {formatDate, formatTime, validDate, publicTrackingNumber, orderedHistory, shipmentProgress, latestShipmentUpdate} from './tracking-state.js?v=4';

const form = document.querySelector('#tracking-form');
const input = document.querySelector('#tracking-reference');
const search = document.querySelector('#tracking-search');
const message = document.querySelector('#tracking-message');
const result = document.querySelector('#tracking-result');
const timeline = document.querySelector('#tracking-timeline');
const details = document.querySelector('#tracking-details');
const button = form.querySelector('button');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const baseTitle = 'Track Your Shipment | 3A Logistics';
const detailIcons = {
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>',
  document: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6"/></svg>'
};
let pending;

function showMessage(text, isError = false) {
  message.textContent = text;
  message.hidden = !text;
  message.classList.toggle('is-error', isError);
}

function setUrl(number = '') {
  window.history.replaceState(null, '', `${window.location.pathname}${number ? `?awb=${encodeURIComponent(number)}` : ''}`);
}

function addText(parent, tag, className, value) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = value;
  parent.append(node);
  return node;
}

function renderProgress(status) {
  const state = shipmentProgress(status);
  const progress = document.querySelector('#tracking-progress');
  progress.style.setProperty('--progress', `${state.stage < 0 ? 0 : state.stage / 3 * 100}%`);
  for (const step of progress.querySelectorAll('[data-stage]')) {
    const index = Number(step.dataset.stage);
    step.classList.toggle('is-complete', state.stage > index);
    step.classList.toggle('is-current', state.stage === index);
    if (state.stage === index) step.setAttribute('aria-current', 'step');
    else step.removeAttribute('aria-current');
  }
  document.querySelector('#progress-caption').textContent = state.stage < 0 ? `Status: ${status}` : `${status} · Step ${state.stage + 1} of 4`;
  progress.classList.toggle('has-known-stage', state.stage >= 0);
  document.querySelector('#journey-next').hidden = state.terminal;
  return state;
}

function renderShipment(shipment) {
  const number = publicTrackingNumber(shipment);
  if (!number) throw new Error('No shipment was found for that Carrier AWB. Please check it and try again.');
  const status = typeof shipment.status === 'string' && shipment.status.trim() ? shipment.status.trim() : 'Booked';
  const heading = document.querySelector('#result-reference');
  heading.textContent = number;
  const state = renderProgress(status);
  const badge = document.querySelector('#result-status');
  badge.textContent = status;
  badge.hidden = false;
  badge.classList.toggle('is-delivered', state.tone === 'delivered');
  badge.classList.toggle('is-attention', state.tone === 'attention');
  const update = latestShipmentUpdate(shipment);
  const updatedNode = document.querySelector('#result-updated');
  updatedNode.textContent = update.text;
  if (update.date) updatedNode.dateTime = update.date;
  else updatedNode.removeAttribute('datetime');

  document.querySelector('#route-origin').textContent = typeof shipment.origin === 'string' && shipment.origin.trim() ? shipment.origin : 'Not available';
  document.querySelector('#route-destination').textContent = typeof shipment.destination === 'string' && shipment.destination.trim() ? shipment.destination : 'Not available';

  const events = orderedHistory(shipment.history);
  timeline.replaceChildren();
  document.querySelector('#tracking-empty').hidden = events.length > 0;
  for (const event of events) {
    const item = document.createElement('li');
    item.className = 'tracking-event';
    const marker = addText(item, 'span', 'tracking-marker', '✓');
    marker.setAttribute('aria-hidden', 'true');
    const body = addText(item, 'div', 'tracking-event-copy', '');
    addText(body, 'h3', '', event.status);
    const date = formatDate(event.date);
    const time = formatTime(event.time);
    if (date || time) {
      const timeNode = addText(item, 'time', 'tracking-event-time', [date, time].filter(Boolean).join(', '));
      if (validDate(event.date)) timeNode.dateTime = event.date;
    }
    timeline.append(item);
  }

  details.replaceChildren();
  const fields = [
    ['Booked on', formatDate(shipment.bookingDate) || 'Not available yet', 'calendar'],
    ['Delivery estimate', formatDate(shipment.expectedDeliveryDate) || 'Not available yet', 'document']
  ];
  for (const [label, value, icon] of fields) {
    const group = document.createElement('div');
    const picture = addText(group, 'span', 'detail-icon', '');
    picture.innerHTML = detailIcons[icon];
    addText(group, 'dt', '', label);
    addText(group, 'dd', '', value);
    details.append(group);
  }
  // Never carry an internal booking identifier through the URL, title or form.
  input.value = number;
  setUrl(number);
  document.title = `Tracking ${number} | 3A Logistics`;
  search.hidden = true;
  result.hidden = false;
  result.classList.remove('is-visible');
  window.requestAnimationFrame(() => result.classList.add('is-visible'));
  heading.focus({preventScroll: true});
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const number = input.value.trim();
  input.value = number;
  if (!number || number.length > 200 || /[\u0000-\u001f\u007f]/.test(number) || !form.reportValidity()) {
    showMessage('Enter a valid Carrier AWB from your consignment note.', true);
    return;
  }
  pending?.abort();
  const controller = new AbortController();
  pending = controller;
  const timeout = window.setTimeout(() => controller.abort('timeout'), 20000);
  result.hidden = true;
  search.hidden = false;
  document.title = baseTitle;
  setUrl();
  form.setAttribute('aria-busy', 'true');
  showMessage('Looking up your shipment…');
  button.disabled = true;
  try {
    const response = await fetch(`/api/tracking?awb=${encodeURIComponent(number)}`, {
      signal: controller.signal, cache: 'no-store', headers: {Accept: 'application/json'}, credentials: 'omit'
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Tracking is temporarily unavailable. Please try again later.');
    const data = await response.json();
    if (pending !== controller || controller.signal.aborted) return;
    if (!data || typeof data !== 'object') throw new Error('Tracking is temporarily unavailable. Please try again later.');
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Tracking is temporarily unavailable. Please try again later.');
    if (!data.shipment) throw new Error('No shipment was found for that Carrier AWB. Please check it and try again.');
    renderShipment(data.shipment);
    showMessage('');
  } catch (error) {
    if (pending !== controller) return;
    if (controller.signal.aborted) {
      if (controller.signal.reason === 'timeout') showMessage('The lookup took too long. Please try again.', true);
    } else showMessage(error instanceof Error ? error.message : 'Tracking is temporarily unavailable. Please try again later.', true);
  } finally {
    window.clearTimeout(timeout);
    if (pending === controller) {
      pending = undefined;
      button.disabled = false;
      form.removeAttribute('aria-busy');
    }
  }
});

document.querySelector('#track-another').addEventListener('click', () => {
  pending?.abort();
  pending = undefined;
  button.disabled = false;
  form.removeAttribute('aria-busy');
  result.hidden = true;
  search.hidden = false;
  showMessage('');
  input.value = '';
  document.title = baseTitle;
  setUrl();
  search.scrollIntoView({behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start'});
  input.focus({preventScroll: true});
});

const menu = document.querySelector('#tracking-menu');
const nav = document.querySelector('#tracking-nav');
function closeMenu() {
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Open menu');
  nav.classList.remove('is-open');
}
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  nav.classList.toggle('is-open', open);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menu.focus();
  }
});
document.addEventListener('click', event => {
  if (!nav.contains(event.target) && !menu.contains(event.target)) closeMenu();
});
nav.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
window.matchMedia('(min-width: 641px)').addEventListener('change', event => {
  if (event.matches) closeMenu();
});

const initialNumber = new URLSearchParams(window.location.search).get('awb');
if (initialNumber) {
  input.value = initialNumber.trim();
  setUrl();
  form.requestSubmit();
}
