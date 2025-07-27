import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

export const PORT = process.env.PORT || 4000;
export const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-key";
