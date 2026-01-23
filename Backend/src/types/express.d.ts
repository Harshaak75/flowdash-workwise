// src/types/express.d.ts

// What your JWT contains:
export type JWTPayload = {
  id: string;
  role: "MANAGER" | "OPERATOR" | "PROJECT_MANAGER";
  email: string;
  tenantId: string;
};

// Augment the core Express Request type
declare module "express-serve-static-core" {
  interface Request {
    user?: JWTPayload;
  }
  interface Request {
    validAccessToken?: string;
  }
}
