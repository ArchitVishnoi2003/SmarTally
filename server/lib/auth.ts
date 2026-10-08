import type { VercelRequest } from "@vercel/node";
import { getAdmin } from "../firebase";

export async function verifyUserToken(
  req: VercelRequest
): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  try {
    const decoded = await getAdmin().auth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function verifyAgentToken(
  req: VercelRequest
): Promise<{ userId: string; deviceId: string } | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Agent ")) return null;
  const token = header.slice(6);
  const db = getAdmin().firestore();
  const snap = await db
    .collection("agent_devices")
    .where("device_token", "==", token)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { userId: doc.data().user_id as string, deviceId: doc.id };
}
