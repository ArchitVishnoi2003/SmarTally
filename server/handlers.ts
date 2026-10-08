import type { VercelRequest, VercelResponse } from "@vercel/node";
import { v4 as uuidv4 } from "uuid";
import { getAdmin } from "./firebase";
import { verifyUserToken, verifyAgentToken } from "./lib/auth";
import { extractBillWithGemini } from "./lib/gemini";
import { buildPurchaseVoucherXml, buildSalesVoucherXml } from "./lib/tallyXml";
import { isInterState, stateFromGstin } from "./lib/gst";
import { ConfirmInvoiceInput, LineItem } from "./lib/types";
import { resolveTallyCompany } from "./lib/tallyCompany";

import * as dotenv from "dotenv";
dotenv.config();

function geminiKey(): string {
  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (envKey && envKey !== "") {
    return envKey;
  }
  throw new Error("GEMINI_API_KEY is not configured in environment variables");
}

async function getNextSequence(userId: string): Promise<number> {
  const db = getAdmin().firestore();
  const ref = db.collection("counters").doc(userId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = snap.exists ? (snap.data()?.sync_sequence ?? 0) + 1 : 1;
    tx.set(ref, { sync_sequence: next }, { merge: true });
    return next;
  });
}

async function getNextInvoiceNumber(userId: string): Promise<string> {
  const db = getAdmin().firestore();
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

export async function handleExtractBill(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const uid = await verifyUserToken(req);
  if (!uid) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { file_base64, file_type, text_content } = req.body ?? {};
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
  const mime = mimeMap[(file_type as string)?.toLowerCase()] ?? "image/jpeg";

  const extracted = await extractBillWithGemini(
    geminiKey(),
    file_base64 ?? "",
    mime,
    text_content
  );

  res.json({ success: true, data: extracted });
}

export async function handleConfirmInvoice(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const uid = await verifyUserToken(req);
  if (!uid) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const input = req.body as ConfirmInvoiceInput;
  const admin = getAdmin();
  const db = admin.firestore();

  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.data() ?? {};
  const businessGstin = (userData.gstin as string) ?? "";
  const businessState =
    (userData.state_code as string) ?? stateFromGstin(businessGstin);
  let tallyCompany = await resolveTallyCompany(db, uid, userData);
  if (!tallyCompany) {
    res.status(400).json({
      error:
        "Tally company name not set. Pair the Windows agent and enter your company name exactly as in Tally.",
    });
    return;
  }

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

  const batch = db.batch();
  batch.set(db.collection("invoices").doc(invoiceId), {
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
  });
  batch.set(db.collection("sync_queue").doc(), {
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
  });
  await batch.commit();

  if (!input.party_id && input.party_name) {
    await db.collection("parties").add({
      user_id: uid,
      name: input.party_name,
      gstin: partyGstin,
      phone: "",
      address: input.party_address ?? "",
      state_code: partyState,
      party_type: input.bill_type === "purchase" ? "supplier" : "customer",
      created_at: now,
    });
  }

  res.json({
    success: true,
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    sequence_number: sequenceNumber,
  });
}

export async function handleGetPendingQueue(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const agent = await verifyAgentToken(req);
  if (!agent) {
    res.status(401).json({ error: "Invalid agent token" });
    return;
  }

  const snap = await getAdmin()
    .firestore()
    .collection("sync_queue")
    .where("user_id", "==", agent.userId)
    .where("status", "in", ["pending", "failed"])
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
}

export async function handleMarkSynced(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const agent = await verifyAgentToken(req);
  if (!agent) {
    res.status(401).json({ error: "Invalid agent token" });
    return;
  }

  const { queue_id, invoice_id, tally_voucher_id, status, error_message } =
    req.body ?? {};
  const admin = getAdmin();
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  if (queue_id) {
    await db
      .collection("sync_queue")
      .doc(queue_id)
      .update({
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
}

export async function handleAgentHeartbeat(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const agent = await verifyAgentToken(req);
  if (!agent) {
    res.status(401).json({ error: "Invalid agent token" });
    return;
  }

  const { tally_status, pending_count } = req.body ?? {};
  await getAdmin()
    .firestore()
    .collection("agent_devices")
    .doc(agent.deviceId)
    .update({
      tally_status: tally_status ?? "unknown",
      pending_count: pending_count ?? 0,
      last_heartbeat: getAdmin().firestore.FieldValue.serverTimestamp(),
    });

  res.json({ success: true });
}

export async function handlePairAgent(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const { pairing_code, tally_company_name } = req.body ?? {};

  if (pairing_code) {
    const admin = getAdmin();
    const db = admin.firestore();
    const codeSnap = await db.collection("pairing_codes").doc(pairing_code).get();

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

    const company = String(tally_company_name ?? "").trim();
    if (!company) {
      res.status(400).json({
        error:
          "tally_company_name is required (exact name as shown in Tally title bar)",
      });
      return;
    }

    const deviceRef = await db.collection("agent_devices").add({
      user_id: userId,
      device_token: deviceToken,
      tally_company_name: company,
      last_heartbeat: null,
      tally_status: "unknown",
      pending_count: 0,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("users").doc(userId).set(
      { tally_company_name: company },
      { merge: true }
    );

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

  await getAdmin().firestore().collection("pairing_codes").doc(code).set({
    user_id: uid,
    expires_at: expires,
    created_at: getAdmin().firestore.FieldValue.serverTimestamp(),
  });

  res.json({ success: true, pairing_code: code, expires_in_minutes: 10 });
}

export async function handleMarkInFlight(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const agent = await verifyAgentToken(req);
  if (!agent) {
    res.status(401).json({ error: "Invalid agent token" });
    return;
  }

  const { queue_id } = req.body ?? {};
  await getAdmin()
    .firestore()
    .collection("sync_queue")
    .doc(queue_id)
    .update({ status: "in_flight" });

  res.json({ success: true });
}

export async function handleEnsureUserProfile(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const uid = await verifyUserToken(req);
  if (!uid) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { phone, business_name, gstin, state_code, tally_company_name } =
    req.body ?? {};
  const db = getAdmin().firestore();
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
      created_at: getAdmin().firestore.FieldValue.serverTimestamp(),
    });
  }

  res.json({ success: true });
}
