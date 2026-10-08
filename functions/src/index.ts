import * as path from "path";
import * as dotenv from "dotenv";

// Load functions/.env for local emulator (not deployed to Firebase)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import cors from "cors";
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { verifyUserToken, verifyAgentToken } from "./auth";
import { extractBillWithGemini } from "./gemini";
import {
  buildPurchaseVoucherXml,
  buildSalesVoucherXml,
} from "./tallyXml";
import { isInterState, stateFromGstin } from "./gst";
import { ConfirmInvoiceInput, LineItem } from "./types";

admin.initializeApp();

const corsHandler = cors({ origin: true });

/** From functions/.env (deployed with Cloud Functions — no Secret Manager / Blaze required) */
function resolveGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY missing in functions/.env");
  }
  return key;
}

function runCors(
  req: Request,
  res: Response,
  handler: () => Promise<void>
): void {
  corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    try {
      await handler();
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Internal error";
      res.status(500).json({ error: msg });
    }
  });
}

async function getNextSequence(userId: string): Promise<number> {
  const db = admin.firestore();
  const ref = db.collection("counters").doc(userId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = snap.exists ? (snap.data()?.sync_sequence ?? 0) + 1 : 1;
    tx.set(ref, { sync_sequence: next }, { merge: true });
    return next;
  });
}

async function getNextInvoiceNumber(userId: string): Promise<string> {
  const db = admin.firestore();
  const fyStart =
    new Date().getMonth() >= 3
      ? new Date().getFullYear()
      : new Date().getFullYear() - 1;
  const prefix = `INV-${fyStart}-`;
  const snap = await db
    .collection("invoices")
    .where("user_id", "==", userId)
    .orderBy("created_at", "desc")
    .limit(50)
    .get();

  let max = 0;
  snap.docs.forEach((d) => {
    const num = d.data().invoice_number as string;
    if (num?.startsWith(prefix)) {
      const n = parseInt(num.replace(prefix, ""), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/** HTTPS POST — extract bill from image/PDF/text via Gemini */
export const extractBill = onRequest(
  { cors: true, region: "asia-south1" },
  (req, res) => {
    runCors(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const uid = await verifyUserToken(req);
      if (!uid) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { file_base64, file_type, text_content } = req.body;
      const apiKey = resolveGeminiApiKey();

      if (!text_content && !file_base64) {
        res.status(400).json({ error: "file_base64 or text_content required" });
        return;
      }

      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        pdf: "application/pdf",
        webp: "image/webp",
      };
      const mime =
        mimeMap[(file_type as string)?.toLowerCase()] ?? "image/jpeg";

      const extracted = await extractBillWithGemini(
        apiKey,
        file_base64 ?? "",
        mime,
        text_content
      );

      res.json({ success: true, data: extracted });
    });
  }
);

/** HTTPS POST — save verified invoice and enqueue for Tally */
export const confirmInvoice = onRequest(
  { cors: true, region: "asia-south1" },
  (req, res) => {
    runCors(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const uid = await verifyUserToken(req);
      if (!uid) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const input = req.body as ConfirmInvoiceInput;
      const db = admin.firestore();

      const userSnap = await db.collection("users").doc(uid).get();
      const userData = userSnap.data() ?? {};
      const businessGstin = (userData.gstin as string) ?? "";
      const businessState = (userData.state_code as string) ?? stateFromGstin(businessGstin);
      const tallyCompany =
        (userData.tally_company_name as string) ?? "Default Company";

      const partyGstin = input.party_gstin ?? "";
      const partyState = stateFromGstin(partyGstin) ?? businessState;
      const interState = isInterState(businessState, partyState);

      const invoiceId = uuidv4();
      const invoiceNumber = await getNextInvoiceNumber(uid);
      const sequenceNumber = await getNextSequence(uid);

      const voucherType = input.bill_type === "purchase" ? "Purchase" : "Sales";
      const xmlPayload =
        input.bill_type === "purchase"
          ? buildPurchaseVoucherXml({
              companyName: tallyCompany,
              invoiceId,
              invoiceNumber,
              invoiceDate: input.bill_date,
              partyName: input.party_name,
              lineItems: input.line_items as LineItem[],
              subtotal: input.subtotal,
              cgst: input.cgst,
              sgst: input.sgst,
              igst: input.igst,
              total: input.total,
              interState,
            })
          : buildSalesVoucherXml({
              companyName: tallyCompany,
              invoiceId,
              invoiceNumber,
              invoiceDate: input.bill_date,
              partyName: input.party_name,
              lineItems: input.line_items as LineItem[],
              subtotal: input.subtotal,
              cgst: input.cgst,
              sgst: input.sgst,
              igst: input.igst,
              total: input.total,
              interState,
            });

      const now = admin.firestore.FieldValue.serverTimestamp();

      const invoiceDoc = {
        user_id: uid,
        invoice_number: invoiceNumber,
        invoice_date: input.bill_date,
        bill_type: input.bill_type,
        party_id: input.party_id ?? null,
        party_name: input.party_name,
        party_gstin: partyGstin,
        place_of_supply: input.place_of_supply ?? partyState,
        line_items: input.line_items,
        subtotal: input.subtotal,
        cgst: input.cgst,
        sgst: input.sgst,
        igst: input.igst,
        total: input.total,
        status: "confirmed",
        tally_voucher_id: null,
        eway_bill_number: null,
        source_bill_url: input.source_bill_url ?? null,
        created_at: now,
        synced_at: null,
      };

      const queueDoc = {
        user_id: uid,
        invoice_id: invoiceId,
        sequence_number: sequenceNumber,
        voucher_type: voucherType,
        tally_xml_payload: xmlPayload,
        party_name: input.party_name,
        line_item_names: (input.line_items as LineItem[]).map((i) => i.name),
        status: "pending",
        attempt_count: 0,
        last_error: null,
        created_at: now,
        synced_at: null,
      };

      const batch = db.batch();
      batch.set(db.collection("invoices").doc(invoiceId), invoiceDoc);
      batch.set(db.collection("sync_queue").doc(), queueDoc);
      await batch.commit();

      if (input.party_id) {
        // party already exists
      } else if (input.party_name) {
        const partyType =
          input.bill_type === "purchase" ? "supplier" : "customer";
        await db.collection("parties").add({
          user_id: uid,
          name: input.party_name,
          gstin: partyGstin,
          phone: "",
          address: input.party_address ?? "",
          state_code: partyState,
          party_type: partyType,
          created_at: now,
        });
      }

      res.json({
        success: true,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        sequence_number: sequenceNumber,
      });
    });
  }
);

/** HTTPS GET — agent polls pending sync queue */
export const getPendingQueue = onRequest(
  { cors: true, region: "asia-south1" },
  (req, res) => {
    runCors(req, res, async () => {
      if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const agent = await verifyAgentToken(req);
      if (!agent) {
        res.status(401).json({ error: "Invalid agent token" });
        return;
      }

      const db = admin.firestore();
      const snap = await db
        .collection("sync_queue")
        .where("user_id", "==", agent.userId)
        .where("status", "==", "pending")
        .orderBy("sequence_number", "asc")
        .limit(10)
        .get();

      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          queue_id: d.id,
          invoice_id: data.invoice_id,
          sequence_number: data.sequence_number,
          voucher_type: data.voucher_type,
          tally_xml_payload: data.tally_xml_payload,
          party_name: data.party_name,
          line_item_names: data.line_item_names,
          status: data.status,
        };
      });

      res.json({ success: true, items });
    });
  }
);

/** HTTPS POST — agent marks queue item synced or failed */
export const markSynced = onRequest(
  { cors: true, region: "asia-south1" },
  (req, res) => {
    runCors(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const agent = await verifyAgentToken(req);
      if (!agent) {
        res.status(401).json({ error: "Invalid agent token" });
        return;
      }

      const {
        queue_id,
        invoice_id,
        tally_voucher_id,
        status,
        error_message,
      } = req.body;

      const db = admin.firestore();
      const now = admin.firestore.FieldValue.serverTimestamp();

      if (queue_id) {
        await db.collection("sync_queue").doc(queue_id).update({
          status,
          tally_voucher_id: tally_voucher_id ?? null,
          last_error: error_message ?? null,
          synced_at: status === "synced" ? now : null,
          attempt_count: admin.firestore.FieldValue.increment(1),
        });
      }

      if (invoice_id) {
        await db
          .collection("invoices")
          .doc(invoice_id)
          .update({
            status: status === "synced" ? "synced" : "failed",
            tally_voucher_id: tally_voucher_id ?? null,
            synced_at: status === "synced" ? now : null,
          });
      }

      res.json({ success: true });
    });
  }
);

/** HTTPS POST — agent heartbeat */
export const agentHeartbeat = onRequest(
  { cors: true, region: "asia-south1" },
  (req, res) => {
    runCors(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const agent = await verifyAgentToken(req);
      if (!agent) {
        res.status(401).json({ error: "Invalid agent token" });
        return;
      }

      const { tally_status, pending_count } = req.body;
      const db = admin.firestore();

      await db.collection("agent_devices").doc(agent.deviceId).update({
        tally_status: tally_status ?? "unknown",
        pending_count: pending_count ?? 0,
        last_heartbeat: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ success: true });
    });
  }
);

/** HTTPS POST — pair Windows agent with mobile app via 6-digit code */
export const pairAgent = onRequest(
  { cors: true, region: "asia-south1" },
  (req, res) => {
    runCors(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const { pairing_code, tally_company_name } = req.body;

      if (pairing_code) {
        const db = admin.firestore();
        const codeSnap = await db
          .collection("pairing_codes")
          .doc(pairing_code)
          .get();

        if (!codeSnap.exists) {
          res.status(404).json({ error: "Invalid or expired pairing code" });
          return;
        }

        const codeData = codeSnap.data()!;
        const expiresAt = codeData.expires_at?.toDate?.() as Date | undefined;
        if (expiresAt && expiresAt < new Date()) {
          res.status(410).json({ error: "Pairing code expired" });
          return;
        }

        const userId = codeData.user_id as string;
        const deviceToken = uuidv4().replace(/-/g, "");

        const deviceRef = await db.collection("agent_devices").add({
          user_id: userId,
          device_token: deviceToken,
          tally_company_name: tally_company_name ?? "",
          last_heartbeat: null,
          tally_status: "unknown",
          pending_count: 0,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        await db.collection("pairing_codes").doc(pairing_code).delete();

        res.json({
          success: true,
          device_token: deviceToken,
          user_id: userId,
          device_id: deviceRef.id,
        });
        return;
      }

      const uid = await verifyUserToken(req);
      if (!uid) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 10 * 60 * 1000);

      await admin.firestore().collection("pairing_codes").doc(code).set({
        user_id: uid,
        expires_at: expires,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ success: true, pairing_code: code, expires_in_minutes: 10 });
    });
  }
);

/** HTTPS POST — mark queue item in-flight (agent picked it up) */
export const markInFlight = onRequest(
  { cors: true, region: "asia-south1" },
  (req, res) => {
    runCors(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const agent = await verifyAgentToken(req);
      if (!agent) {
        res.status(401).json({ error: "Invalid agent token" });
        return;
      }

      const { queue_id } = req.body;
      await admin
        .firestore()
        .collection("sync_queue")
        .doc(queue_id)
        .update({ status: "in_flight" });

      res.json({ success: true });
    });
  }
);

/** HTTPS POST — ensure user profile exists after first login */
export const ensureUserProfile = onRequest(
  { cors: true, region: "asia-south1" },
  (req, res) => {
    runCors(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const uid = await verifyUserToken(req);
      if (!uid) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { phone, business_name, gstin, state_code, tally_company_name } =
        req.body;
      const db = admin.firestore();
      const ref = db.collection("users").doc(uid);
      const snap = await ref.get();

      if (!snap.exists) {
        await ref.set({
          uid,
          phone: phone ?? "",
          business_name: business_name ?? "",
          gstin: gstin ?? "",
          state_code: state_code ?? "",
          tally_company_name: tally_company_name ?? "",
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      res.json({ success: true });
    });
  }
);
