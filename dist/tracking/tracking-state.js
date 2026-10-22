const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'
});

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function formatDate(value) {
  return validDate(value) ? dateFormatter.format(new Date(`${value}T12:00:00Z`)) : '';
}

function timeParts(value) {
  if (typeof value !== 'string') return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value.trim());
  return match ? {hour: Number(match[1]), minute: Number(match[2])} : null;
}

export function formatTime(value) {
  const time = timeParts(value);
  if (!time) return '';
  return `${String(time.hour % 12 || 12).padStart(2, '0')}:${String(time.minute).padStart(2, '0')} ${time.hour < 12 ? 'AM' : 'PM'}`;
}

export function publicTrackingNumber(shipment) {
  const number = typeof shipment?.trackingNumber === 'string' ? shipment.trackingNumber.trim() : '';
  return number && number.length <= 200 && !/[\u0000-\u001f\u007f]/.test(number) ? number : '';
}

export function orderedHistory(history) {
  if (!Array.isArray(history)) return [];
  const events = history.filter(event => event && typeof event.status === 'string' && event.status.trim())
    .map(event => ({status: event.status.trim(), date: typeof event.date === 'string' ? event.date : '', time: typeof event.time === 'string' ? event.time : ''}));
  // Undated events have no reliable position on a calendar. Preserve their recorded order.
  if (!events.every(event => validDate(event.date))) return events;
  return events.map((event, index) => ({event, index})).sort((a, b) => {
    const dateOrder = a.event.date.localeCompare(b.event.date);
    const aTime = timeParts(a.event.time);
    const bTime = timeParts(b.event.time);
    return dateOrder || ((aTime?.hour || 0) * 60 + (aTime?.minute || 0)) - ((bTime?.hour || 0) * 60 + (bTime?.minute || 0)) || a.index - b.index;
  }).map(item => item.event);
}

const stages = [
  new Set(['booked', 'booking confirmed', 'shipment booked', 'created', 'label created', 'confirmed']),
  new Set(['in transit', 'dispatched', 'picked up', 'collected', 'pickup completed', 'processing', 'at hub', 'arrived at hub', 'at facility', 'sorting', 'customs clearance']),
  new Set(['out for delivery', 'with delivery courier']),
  new Set(['delivered', 'delivery complete', 'delivery completed'])
];
const attention = new Set(['cancelled', 'canceled', 'returned', 'return to origin', 'rto', 'lost', 'not delivered', 'undelivered', 'delivery failed', 'delivery attempted', 'on hold', 'hold', 'exception', 'delayed', 'failed attempt', 'address issue', 'customs hold']);
const terminal = new Set(['cancelled', 'canceled', 'returned', 'return to origin', 'rto', 'lost']);

export function shipmentProgress(status) {
  const value = typeof status === 'string' ? status.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ') : '';
  const stage = stages.findIndex(names => names.has(value));
  return {stage, tone: stage === 3 ? 'delivered' : attention.has(value) ? 'attention' : 'normal', terminal: stage === 3 || terminal.has(value)};
}

export function latestShipmentUpdate(shipment) {
  const datedEvents = Array.isArray(shipment?.history) ? shipment.history.filter(item => validDate(item?.date)) : [];
  const event = orderedHistory(datedEvents).at(-1);
  const date = event?.date || (validDate(shipment?.bookingDate) ? shipment.bookingDate : '');
  return {date, time: event?.time || '', text: [formatDate(date), formatTime(event?.time)].filter(Boolean).join(', ') || 'Not available yet'};
}
