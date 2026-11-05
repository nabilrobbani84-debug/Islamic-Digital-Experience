export type Role = "USER" | "ADMIN" | "SUPER_ADMIN";

export interface AuthContext {
  userId: string;
  role: Role;
  sessionId: string;
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
  }
}
