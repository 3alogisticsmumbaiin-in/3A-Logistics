import {MongoClient} from 'mongodb';

let client;
let connection;

async function collection(){
 const uri=process.env.MONGODB_TRACKING_URI;
 const database=process.env.MONGODB_TRACKING_DATABASE||'3a_logistics';
 if(!uri||!/^mongodb(?:\+srv)?:\/\//.test(uri)||!/^[A-Za-z0-9_-]{1,63}$/.test(database))throw Error('Tracking database is not configured.');
 if(!connection){
  client=new MongoClient(uri,{serverSelectionTimeoutMS:5000,connectTimeoutMS:5000,socketTimeoutMS:10000,maxPoolSize:5});
  connection=client.connect().then(()=>client.db(database).collection('records')).catch(error=>{connection=null;throw error;});
 }
 return connection;
}

function publicText(value,fallback=''){
 return typeof value==='string'?value.trim():fallback;
}

function carrierNumber(value){
 const number=publicText(value);
 return number&&number.length<=200&&!/[\u0000-\u001f\u007f]/.test(number)?number:'';
}

export function publicShipment(booking){
 if(!booking||typeof booking!=='object'||Array.isArray(booking))return null;
 const trackingNumber=carrierNumber(booking.barcode);
 if(!trackingNumber)return null;
 const history=Array.isArray(booking.history)?booking.history.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)&&publicText(item.status)).slice(-50).map(item=>({
  status:publicText(item.status),
  date:publicText(item.date),
  time:publicText(item.time)
 })):[];
 return {
  trackingNumber,
  status:publicText(booking.status)||'Booked',
  origin:publicText(booking.origin),
  destination:publicText(booking.destination),
  bookingDate:publicText(booking.date),
  expectedDeliveryDate:publicText(booking.expectedDeliveryDate),
  history
 };
}

export async function lookupShipment(reference, getCollection=collection){
 const number=carrierNumber(reference);
 if(!number)return null;
 const projection={
  _id:0,
  'body.barcode':1,
  'body.status':1,
  'body.origin':1,
  'body.destination':1,
  'body.date':1,
  'body.expectedDeliveryDate':1,
  'body.history.status':1,
  'body.history.date':1,
  'body.history.time':1
 };
 const records=await (await getCollection()).find({collection:'bookings',deleted:0,'body.barcode':number},{collation:{locale:'en',strength:2},projection,maxTimeMS:5000}).limit(2).toArray();
 if(records.length!==1)return null;
 return publicShipment(records[0].body);
}
