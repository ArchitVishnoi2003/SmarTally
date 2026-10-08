require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('../functions/tally-amber-firebase-adminsdk-hms20-4e0ab1d3e2.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const { buildPurchaseVoucherXml, buildSalesVoucherXml } = require('./lib/tallyXml.js');

async function run() {
    console.log("Fetching pending invoices...");
    const snap = await db.collection('users').doc('avarc10@gmail.com').collection('invoices')
        .where('sync_status', '==', 'pending')
        .get();
        
    console.log(`Found ${snap.size} pending invoices.`);
    
    for (const doc of snap.docs) {
        await doc.ref.delete();
        console.log(`Deleted invoice ${doc.id}`);
    }
    console.log("Queue completely emptied!");
}

run().catch(console.error);
