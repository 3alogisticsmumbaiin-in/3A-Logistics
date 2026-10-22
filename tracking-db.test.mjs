import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lookupShipment,publicShipment} from './tracking-db.mjs';

const booking={awb:'3A000003',barcode:'3A40006',status:'In Transit',origin:'Mumbai',destination:'Pune',date:'2026-10-01',expectedDeliveryDate:'2026-10-03',history:[{status:'Booked',date:'2026-10-01',time:'10:30'}]};
const record=(body=booking,overrides={})=>({collection:'bookings',deleted:0,body,...overrides});

function mockCollection(records,onFind=()=>{}){
 return async()=>({find(query,options){
  onFind(query,options);
  function matches(item,criteria){
   return Object.entries(criteria).every(([key,value])=>{
    if(key==='$or')return value.some(branch=>matches(item,branch));
    const actual=key.split('.').reduce((parent,field)=>parent?.[field],item);
    return typeof actual==='string'&&typeof value==='string'&&options.collation?.strength===2?actual.toLowerCase()===value.toLowerCase():actual===value;
   });
  }
  return {limit(size){assert.equal(size,2);return {toArray:async()=>records.filter(item=>matches(item,query)).slice(0,size)};}};
 }});
}

test('public tracking exposes the carrier number and excludes internal and private details',()=>{
 const shipment=publicShipment({...booking,client:'Private customer',total:1000,history:[{...booking.history[0],note:'Private note',actorName:'Private staff'}]});
 assert.deepEqual(shipment,{
  trackingNumber:'3A40006',status:'In Transit',origin:'Mumbai',destination:'Pune',bookingDate:'2026-10-01',expectedDeliveryDate:'2026-10-03',history:[{status:'Booked',date:'2026-10-01',time:'10:30'}]
 });
 assert.doesNotMatch(JSON.stringify(shipment),/3A000003|Private|1000/);
 assert.equal(Object.hasOwn(shipment,'reference'),false);
});

test('a missing or invalid carrier never falls back to the internal booking number',()=>{
 for(const barcode of [undefined,null,'','  ',0,42,{},[],['3A40006'],'x'.repeat(201),'3A\u000040006']){
  assert.equal(publicShipment({...booking,barcode}),null);
 }
 for(const value of [undefined,null,42,'3A40006',[]])assert.equal(publicShipment(value),null);
 assert.equal(publicShipment({...booking,barcode:' 3A40006 '}).trackingNumber,'3A40006');
});

test('malformed public fields cannot serialize nested booking details',()=>{
 const privateData={awb:'3A000003',client:'Private customer'};
 const shipment=publicShipment({...booking,status:privateData,origin:[privateData],destination:123,date:new Date('2026-10-01'),expectedDeliveryDate:privateData,history:[null,privateData,{status:privateData},{status:'  '},{status:' Booked ',date:privateData,time:[privateData],note:'Private note'}]});
 assert.deepEqual(shipment,{
  trackingNumber:'3A40006',status:'Booked',origin:'',destination:'',bookingDate:'',expectedDeliveryDate:'',history:[{status:'Booked',date:'',time:''}]
 });
 assert.doesNotMatch(JSON.stringify(shipment),/3A000003|Private/);
});

test('public history retains only the latest 50 valid events',()=>{
 const history=Array.from({length:55},(_,index)=>({status:`Update ${index}`,date:'2026-10-01',time:'10:30',note:'Private'}));
 const shipment=publicShipment({...booking,history});
 assert.equal(shipment.history.length,50);
 assert.equal(shipment.history[0].status,'Update 5');
 assert.equal(shipment.history.at(-1).status,'Update 54');
 assert.doesNotMatch(JSON.stringify(shipment),/Private/);
});

test('lookup accepts carrier AWBs case-insensitively and never matches internal references',async()=>{
 const getCollection=mockCollection([record()]);
 assert.equal((await lookupShipment(' 3a40006 ',getCollection)).trackingNumber,'3A40006');
 assert.equal(await lookupShipment('3A000003',getCollection),null);
 assert.equal(await lookupShipment('3A400',getCollection),null);
});

test('lookup requests only public fields from active bookings',async()=>{
 let criteria;
 await lookupShipment('3A40006',mockCollection([record()],(query,options)=>{criteria={query,options};}));
 assert.deepEqual(criteria.query,{collection:'bookings',deleted:0,'body.barcode':'3A40006'});
 assert.deepEqual(criteria.options,{
  collation:{locale:'en',strength:2},
  projection:{_id:0,'body.barcode':1,'body.status':1,'body.origin':1,'body.destination':1,'body.date':1,'body.expectedDeliveryDate':1,'body.history.status':1,'body.history.date':1,'body.history.time':1},
  maxTimeMS:5000
 });
});

test('lookup requires one active carrier match and hides ambiguous matches',async()=>{
 assert.equal(await lookupShipment('3A40006',mockCollection([])),null);
 assert.equal(await lookupShipment('3A40006',mockCollection([record(),record({...booking,barcode:'3a40006',awb:'3A000004'})])),null);
 const inactive=[record(booking,{deleted:1}),record(booking,{deleted:false}),record(booking,{deleted:undefined}),record(booking,{collection:'customers'})];
 assert.equal(await lookupShipment('3A40006',mockCollection(inactive)),null);
 assert.equal((await lookupShipment('3A40006',mockCollection([...inactive,record()]))).trackingNumber,'3A40006');
});

test('lookup rejects invalid carrier input before opening the database',async()=>{
 const unexpected=()=>{assert.fail('Invalid input must not reach MongoDB');};
 for(const value of [undefined,null,'','  ',0,42,{},[],['3A40006'],'x'.repeat(201),'3A\u000040006'])assert.equal(await lookupShipment(value,unexpected),null);
});

test('lookup returns null for a malformed matching carrier payload',async()=>{
 // MongoDB can match scalar queries against array members; the public mapper must still reject the array.
 const getCollection=async()=>({find(){return {limit(){return {toArray:async()=>[record({...booking,barcode:['3A40006']})]};}};}});
 assert.equal(await lookupShipment('3A40006',getCollection),null);
});
