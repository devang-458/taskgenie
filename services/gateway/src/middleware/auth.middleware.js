import jwt from "jsonwebtoken";
import redis from "../config/redis.js";
import { JWT_SECRET } from "../config/env.js";

export const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, error: "Access token required" });

  const isBlacklisted = await redis.get(`blacklist:${token}`);
  if (isBlacklisted) return res.status(401).json({ success: false, error: "Token revoked" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ success: false, error: "Invalid or expired token" });
  }
};

export const optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next();

  try {
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (!isBlacklisted) {
      req.user = jwt.verify(token, JWT_SECRET);
    }
  } catch {}
  next();
};
