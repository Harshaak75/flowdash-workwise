import { Request, Response, NextFunction } from "express";
export declare function requireRole(...allowed: Array<"MANAGER" | "OPERATOR" | "PROJECT_MANAGER">): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=role.d.ts.map