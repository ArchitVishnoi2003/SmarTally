import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "../server/http";

export default function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  return res.status(200).json({
    ok: true,
    service: "wholesale-tally-api",
    version: "1.0.0",
    firebase: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    gemini: !!process.env.GEMINI_API_KEY,
  });
}
