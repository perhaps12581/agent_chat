import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "hub_sec_key_20261013_random_salt_production_safe";

export interface UserSessionPayload {
  userId: string;
  username: string;
  name: string;
  role: string;
  avatar?: string | null;
}

// 1. 密码加盐哈希
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// 2. 密码核验
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 3. 签发 JWT 会话 Token (30 天有效)
export function signSessionToken(payload: UserSessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "30d",
  });
}

// 4. 解析与校验 JWT 会话 Token
export function verifySessionToken(token: string): UserSessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserSessionPayload;
    return decoded;
  } catch {
    return null;
  }
}
