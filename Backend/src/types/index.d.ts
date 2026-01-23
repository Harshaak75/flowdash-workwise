import "express";

declare global {
  namespace Express {
    interface UserJWTPayload {
      id: string;
      role: "MANAGER" | "OPERATOR" | "PROJECT_MANAGER";
      email: string;
      tenantId: string;
    }
    interface Request {
      user?: UserJWTPayload;
    }
  }
}
