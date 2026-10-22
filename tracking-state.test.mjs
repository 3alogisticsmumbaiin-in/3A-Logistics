import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatDate, formatTime, publicTrackingNumber, orderedHistory, shipmentProgress, latestShipmentUpdate} from './dist/tracking/tracking-state.js';

test('tracking identity never falls back to internal or malformed identifiers', () => {
  assert.equal(publicTrackingNumber({reference: '3A000003'}), '');
  assert.equal(publicTrackingNumber({reference: '3A000003', trackingNumber: ' 3A40006 '}), '3A40006');
  for (const value of [{private: 'value'}, 12345, 'x'.repeat(201), 'AWB\n123']) assert.equal(publicTrackingNumber({trackingNumber: value}), '');
});

test('calendar formatting rejects rollover dates and formats valid leap days', () => {
  assert.equal(formatDate('2026-02-31'), '');
  assert.equal(formatDate('2026-02-29'), '');
  assert.equal(formatDate('2024-02-29'), '29 Feb 2024');
  assert.equal(formatDate('2026-10-21'), '21 Oct 2026');
  assert.equal(formatDate('2026-10-21T00:00:00Z'), '');
  assert.equal(formatTime('00:05'), '12:05 AM');
  assert.equal(formatTime('12:22:00'), '12:22 PM');
  assert.equal(formatTime('24:01'), '');
});

test('progress maps actual known statuses and never treats failed delivery as delivered', () => {
  assert.equal(shipmentProgress('Booked').stage, 0);
  assert.equal(shipmentProgress(' IN-TRANSIT ').stage, 1);
  assert.equal(shipmentProgress('Out_for_delivery').stage, 2);
  assert.deepEqual(shipmentProgress('Delivered'), {stage: 3, tone: 'delivered', terminal: true});
  for (const status of ['Undelivered', 'Not delivered', 'Delivery failed', 'On hold', 'Exception']) {
    assert.equal(shipmentProgress(status).stage, -1);
    assert.equal(shipmentProgress(status).tone, 'attention');
  }
  for (const status of ['Cancelled', 'Returned', 'Lost']) assert.equal(shipmentProgress(status).terminal, true);
  assert.deepEqual(shipmentProgress('Custom status'), {stage: -1, tone: 'normal', terminal: false});
});

test('history runs from booking to the newest update without mutating input or inventing events', () => {
  const history = [
    {status: 'Delivered', date: '2026-10-23', time: '15:00'},
    {status: 'Booked', date: '2026-10-21', time: '09:00'},
    {status: 'In transit', date: '2026-10-23', time: '08:00'}
  ];
  const snapshot = structuredClone(history);
  assert.deepEqual(orderedHistory(history).map(item => item.status), ['Booked', 'In transit', 'Delivered']);
  assert.deepEqual(history, snapshot);
  assert.deepEqual(orderedHistory([]), []);
  assert.deepEqual(orderedHistory([{status: 'Booked'}, {status: 'In transit'}]).map(item => item.status), ['Booked', 'In transit']);
});

test('last updated uses recorded dates, safely handles absent history and does not infer an ETA', () => {
  assert.deepEqual(latestShipmentUpdate({bookingDate: '2026-10-21', history: []}), {date: '2026-10-21', time: '', text: '21 Oct 2026'});
  assert.equal(latestShipmentUpdate({bookingDate: '2026-02-31'}).text, 'Not available yet');
  assert.equal(latestShipmentUpdate({history: [{status: 'Booked', date: '2026-10-21'}, {status: 'In transit', date: '2026-10-22', time: '16:30'}]}).text, '22 Oct 2026, 04:30 PM');
});

test('last updated stays newest when the displayed journey is chronological, unsorted or partially undated', () => {
  const history = [
    {status: 'In Transit', date: '2026-10-22', time: '22:18'},
    {status: 'Booked', date: '2026-10-21'},
    {status: 'Processing', date: '2026-10-22', time: '08:00'},
    {status: 'Undated update'}
  ];
  assert.equal(latestShipmentUpdate({history}).text, '22 Oct 2026, 10:18 PM');
  assert.deepEqual(orderedHistory(history.slice(0, 3)).map(item => item.status), ['Booked', 'Processing', 'In Transit']);
});
