require("dotenv").config();
const token = process.env.AGENT_TOKEN || process.env.DEVICE_TOKEN;
const apiUrl = process.env.API_URL || "https://tally-amber.vercel.app/api";

async function clearQueue() {
  if (!token) {
    console.error("AGENT_TOKEN (or DEVICE_TOKEN) is not set. Please set it in .env or environment variables.");
    return;
  }
  try {
       const res = await fetch(`${apiUrl}/getPendingQueue`, {
         headers: {
           "Authorization": `Agent ${token}`
         }
       });
       const data = await res.json();
       
       if (!data.items || data.items.length === 0) {
          console.log("Queue is already empty!"); 
          return;
       }
    
    console.log(`Found ${data.items.length} items in the queue to clear...`);
    
    for (const item of data.items) {
       await fetch(`${apiUrl}/markSynced`, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           "Authorization": `Agent ${token}`
         },
         body: JSON.stringify({
            queue_id: item.queue_id,
            invoice_id: item.invoice_id,
            status: "synced",
            error_message: "Manually cleared queue"
         })
       });
       console.log(`Cleared invoice ${item.invoice_id}`);
    }
    console.log("Successfully emptied the phone queue!");
  } catch (err) {
    console.error("Failed:", err);
  }
}
clearQueue();
