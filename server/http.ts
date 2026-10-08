import type { VercelRequest, VercelResponse } from "@vercel/node";

export function setCors(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type"
  );
}

export function withHandler(
  allowedMethod: "GET" | "POST",
  fn: (req: VercelRequest, res: VercelResponse) => Promise<void>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    setCors(res);
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    if (req.method !== allowedMethod) {
      return res.status(405).json({ error: "Method not allowed" });
    }
    try {
      await fn(req, res);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Internal error";
      return res.status(500).json({ error: msg });
    }
  };
}
