import type { Firestore } from "firebase-admin/firestore";

/** Resolve Tally company: user profile, then latest paired agent device. */
export async function resolveTallyCompany(
  db: Firestore,
  userId: string,
  userData: Record<string, unknown>
): Promise<string> {
  const fromUser = String(userData.tally_company_name ?? "").trim();
  if (fromUser) return fromUser;

  const devices = await db
    .collection("agent_devices")
    .where("user_id", "==", userId)
    .limit(10)
    .get();

  let best = "";
  let bestTime = 0;
  for (const doc of devices.docs) {
    const name = String(doc.data().tally_company_name ?? "").trim();
    if (!name) continue;
    const created = doc.data().created_at as { toMillis?: () => number } | undefined;
    const t = created?.toMillis?.() ?? 0;
    if (t >= bestTime) {
      bestTime = t;
      best = name;
    }
  }
  if (best) return best;

  return "";
}
