import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lookupShipment,publicShipment} from './tracking-db.mjs';

test('public tracking removes private booking details and history notes',()=>{
 const shipment=publicShipment({awb:'3A-1',barcode:'CARRIER-1',status:'In Transit',origin:'Mumbai',destination:'Pune',client:'Private customer',total:1000,history:[{status:'Booked',date:'2026-10-01',note:'Private note',actorName:'Private staff'}]});
 assert.deepEqual(shipment.history,[{status:'Booked',date:'2026-10-01',time:''}]);
 assert.doesNotMatch(JSON.stringify(shipment),/Private|1000/);
});

test('lookup requires exactly one active match',async()=>{
 const found={body:{awb:'3A-1',status:'Booked',history:[]}};
 let criteria;
 const mock=items=>async()=>({find(query,options){criteria={query,options};return {limit(size){assert.equal(size,2);return {toArray:async()=>items};}};}});
 assert.equal((await lookupShipment(' 3A-1 ',mock([found]))).reference,'3A-1');
 assert.equal(criteria.query.deleted,0);
 assert.equal(criteria.options.projection.body,1);
 assert.equal(await lookupShipment('3A-1',mock([found,found])),null);
 assert.equal(await lookupShipment('missing',mock([])),null);
 assert.equal(await lookupShipment('x'.repeat(201),mock([found])),null);
});
