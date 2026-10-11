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

export function publicShipment(booking){
 const history=Array.isArray(booking.history)?booking.history.filter(item=>item&&typeof item.status==='string').slice(-50).map(item=>({
  status:item.status,
  date:typeof item.date==='string'?item.date:'',
  time:typeof item.time==='string'?item.time:''
 })):[];
 return {
  reference:booking.awb||'',
  trackingNumber:booking.barcode||'',
  status:booking.status||'Booked',
  origin:booking.origin||'',
  destination:booking.destination||'',
  bookingDate:booking.date||'',
  expectedDeliveryDate:booking.expectedDeliveryDate||'',
  history
 };
}

export async function lookupShipment(reference, getCollection=collection){
 const number=String(reference||'').trim();
 if(!number||number.length>200)return null;
 const records=await (await getCollection()).find({collection:'bookings',deleted:0,$or:[{'body.awb':number},{'body.barcode':number}]},{collation:{locale:'en',strength:2},projection:{body:1},maxTimeMS:5000}).limit(2).toArray();
 if(records.length!==1)return null;
 return publicShipment(records[0].body||{});
}
