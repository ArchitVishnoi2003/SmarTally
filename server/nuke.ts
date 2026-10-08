import { getAdmin } from "./firebase";

async function nuke() {
  try {
    const admin = getAdmin();
    const db = admin.firestore();
    
    let invoicesDeleted = 0;
    let queueDeleted = 0;

    const invoices = await db.collection("invoices").get();
    for (let doc of invoices.docs) {
      await doc.ref.delete();
      invoicesDeleted++;
    }

    const queue = await db.collection("sync_queue").get();
    for (let doc of queue.docs) {
      await doc.ref.delete();
      queueDeleted++;
    }

    console.log(`Nuke successful! Deleted ${invoicesDeleted} invoices and ${queueDeleted} queue items from Firebase.`);
    process.exit(0);
  } catch (err) {
    console.error("Failed to nuke:", err);
    process.exit(1);
  }
}

nuke();
