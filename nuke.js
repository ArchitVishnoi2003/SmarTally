const admin = require('firebase-admin');
const serviceAccount = require('./functions/tally-amber-firebase-adminsdk-hms20-4e0ab1d3e2.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function nuke() {
  try {
    const invoices = await db.collection("invoices").get();
    let invCount = 0;
    for (let doc of invoices.docs) {
      await doc.ref.delete();
      invCount++;
    }

    const queue = await db.collection("sync_queue").get();
    let queueCount = 0;
    for (let doc of queue.docs) {
      await doc.ref.delete();
      queueCount++;
    }

    console.log(`Nuke successful! Completely wiped ${invCount} invoices and ${queueCount} queue items from Firebase.`);
  } catch (err) {
    console.error("Failed to nuke:", err);
  }
}

nuke();
