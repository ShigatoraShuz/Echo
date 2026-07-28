import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
      supabase: any;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return res.status(401).json({ error: "Token expired" });
    }
    req.user = { id: payload.sub };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
