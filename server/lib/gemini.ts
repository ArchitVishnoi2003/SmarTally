import { GoogleGenerativeAI } from "@google/generative-ai";
import { ExtractedBill } from "./types";

const EXTRACTION_PROMPT = `You are an invoice data extractor for an Indian wholesale business.

Extract ALL data from this bill image and return ONLY valid JSON.

No explanation, no markdown, just the JSON object.

Return this exact schema:

{
  "bill_type": "purchase or sales or unknown",
  "bill_number": "string or null",
  "bill_date": "YYYY-MM-DD or null",
  "supplier": {
    "name": "",
    "gstin": "",
    "address": ""
  },
  "buyer": {
    "name": "",
    "gstin": "",
    "address": ""
  },
  "items": [
    {
      "name": "",
      "hsn_code": "",
      "quantity": 0,
      "unit": "PCS or MTR or KG or BOX",
      "rate": 0,
      "discount_pct": 0,
      "gst_rate": 5,
      "amount_before_tax": 0,
      "confidence": "high or medium or low"
    }
  ],
  "totals": {
    "subtotal": 0,
    "cgst": 0,
    "sgst": 0,
    "igst": 0,
    "total": 0
  },
  "extraction_notes": ""
}`;

const MODEL_FALLBACKS = [
  process.env.GEMINI_MODEL,
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
].filter((m, i, arr): m is string => !!m && arr.indexOf(m) === i);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isQuotaError(err: unknown): boolean {
  const msg = errorMessage(err);
  return msg.includes("429") || msg.toLowerCase().includes("quota");
}

/** Model retired or wrong name — try next in chain */
function isModelUnavailableError(err: unknown): boolean {
  const msg = errorMessage(err);
  return (
    msg.includes("404") ||
    msg.toLowerCase().includes("not found") ||
    msg.includes("is not supported")
  );
}

function retrySeconds(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/retry in ([\d.]+)s/i);
  if (m) return Math.ceil(parseFloat(m[1]) * 1000);
  return 15000;
}

function friendlyGeminiError(err: unknown): string {
  if (isQuotaError(err)) {
    return (
      "Gemini free quota used up for today. Wait 1–2 minutes and try again, " +
      "or create a new API key at https://aistudio.google.com/apikey"
    );
  }
  return err instanceof Error ? err.stack || err.message : String(err);
}

async function generateOnce(
  apiKey: string,
  modelName: string,
  fileBase64: string,
  mimeType: string,
  textContent?: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
  });

  let result;
  if (textContent) {
    result = await model.generateContent([
      EXTRACTION_PROMPT,
      `\n\nBill text to extract:\n${textContent}`,
    ]);
  } else {
    result = await model.generateContent([
      EXTRACTION_PROMPT,
      {
        inlineData: {
          mimeType,
          data: fileBase64,
        },
      },
    ]);
  }

  return result.response.text();
}

export async function extractBillWithGemini(
  apiKey: string,
  fileBase64: string,
  mimeType: string,
  textContent?: string
): Promise<ExtractedBill> {
  let lastError: unknown;

  for (const modelName of MODEL_FALLBACKS) {
    try {
      const text = await generateOnce(
        apiKey,
        modelName,
        fileBase64,
        mimeType,
        textContent
      );
      const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleaned) as ExtractedBill;

      if (!parsed.items) parsed.items = [];
      if (!parsed.totals) {
        parsed.totals = { subtotal: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      }
      if (!parsed.supplier) parsed.supplier = { name: "", gstin: "", address: "" };
      if (!parsed.buyer) parsed.buyer = { name: "", gstin: "", address: "" };

      return parsed;
    } catch (err) {
      lastError = err;
      console.warn(`Gemini model ${modelName} failed:`, err);

      if (isQuotaError(err)) {
        await sleep(retrySeconds(err));
        continue;
      }
      if (isModelUnavailableError(err)) {
        continue;
      }
      break;
    }
  }

  throw new Error(friendlyGeminiError(lastError));
}
