import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import prisma from "../db";
export async function auth(req: Request, res: Response, next: NextFunction) {

/* =========================
     DEV AUTH (DB-DRIVEN)
  ========================== */
  if (process.env.AUTH_MODE === "DEV") {
    const email = process.env.DEV_LOGIN_EMAIL;
    const tenantId = process.env.DEV_TENANT_ID;

    if (!email || !tenantId) {
      return res.status(500).json({
        error: "DEV_LOGIN_EMAIL or DEV_TENANT_ID missing in env",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email_tenantId: {
          email,
          tenantId,
        },
      },
    });

    if (!user) {
      return res.status(500).json({
        error: `DEV user not found in DB: ${email}`,
      });
    }

    req.user = user; // ✅ real DB user
    return next();
  }


  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as Express.UserJWTPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
// export const auth = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     /*******************************
//      * 1. EXTRACT TOKENS
//      *******************************/
//     const bearer = req.headers.authorization;
//     const appToken = bearer?.startsWith("Bearer ") ? bearer.slice(7) : null;

//     const appRefresh = req.cookies?.refreshToken;

//     const kcToken = req.cookies?.keycloak_token;
//     const kcRefresh = req.cookies?.keycloak_refresh_token;

//     console.log("Auth Middleware - Tokens:", {
//       hasAppToken: appToken,
//       hasAppRefresh: appRefresh,
//       hasKcToken: kcToken,
//       hasKcRefresh: kcRefresh,
//     });

//     let appPayload: any = null;
//     let keycloakPayload: any = null;

//     let isAppTokenValid = true;
//     let isKeycloakValid = true;

//     /*******************************
//      * 2. VALIDATE APP TOKEN
//      *******************************/
//     if (appToken) {
//       try {
//         appPayload = jwt.verify(appToken, process.env.JWT_SECRET!);
//       } catch {
//         isAppTokenValid = false;
//       }
//     } else {
//       isAppTokenValid = false;
//     }

//     /*******************************
//      * 3. VALIDATE KEYCLOAK TOKEN
//      *******************************/
//     if (kcToken) {
//       const decoded: any = jwt.decode(kcToken);

//       if (!decoded || decoded.exp * 1000 < Date.now()) {
//         isKeycloakValid = false;
//       } else {
//         keycloakPayload = decoded;
//       }
//     } else {
//       isKeycloakValid = false;
//     }

//     /*******************************
//      * ✅ 4. BOTH VALID → ALLOW
//      *******************************/
//     if (isAppTokenValid && isKeycloakValid) {
//       req.user = {
//         id: appPayload.userId,
//         role: appPayload.role,
//         email: appPayload.email,
//       };
//       return next();
//     }

//     /*******************************
//      * 🔁 5. REFRESH APP TOKEN
//      *******************************/
//     if (!isAppTokenValid && appRefresh) {
//       try {
//         const decoded: any = jwt.verify(
//           appRefresh,
//           process.env.REFRESH_SECRET!
//         );

//         const newAppToken = jwt.sign(
//           {
//             userId: decoded.userId,
//             role: decoded.role,
//             tenantId: decoded.tenantId,
//           },
//           process.env.JWT_SECRET!,
//           { expiresIn: "1d" }
//         );

//         res.setHeader("x-new-access-token", newAppToken);

//         appPayload = decoded;
//         isAppTokenValid = true;
//       } catch {
//         isAppTokenValid = false;
//       }
//     }

//     /*******************************
//      * 🔁 6. REFRESH KEYCLOAK TOKEN
//      *******************************/
//     if (!isKeycloakValid && kcRefresh) {
//       try {
//         const tokenUrl = `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
//         console.log("Refreshing Keycloak token...");
//         const params = new URLSearchParams();
//         params.append("grant_type", "refresh_token");
//         params.append("client_id", process.env.KEYCLOAK_CLIENT_ID!);
//         params.append("client_secret", process.env.KEYCLOAK_CLIENT_SECRET!);
//         params.append("refresh_token", kcRefresh);

//         const { data } = await axios.post(tokenUrl, params, {
//           headers: { "Content-Type": "application/x-www-form-urlencoded" },
//         });

//         res.cookie("keycloak_token", data.access_token, {
//           httpOnly: true,
//           secure: process.env.NODE_ENV === "production",
//           sameSite: "lax",
//           maxAge: data.expires_in * 1000,
//         });

//         res.cookie("keycloak_refresh_token", data.refresh_token, {
//           httpOnly: true,
//           secure: process.env.NODE_ENV === "production",
//           sameSite: "lax",
//           maxAge: data.refresh_expires_in * 1000,
//         });

//         isKeycloakValid = true;
//       } catch (err) {
//         console.error("Keycloak refresh failed", err);
//       }
//     }

//     /*******************************
//      * ✅ 7. FINAL CHECK
//      *******************************/
//     if (isAppTokenValid && isKeycloakValid) {
//       req.user = {
//         id: appPayload.userId,
//         role: appPayload.role,
//         email: appPayload.email,
//       };
//       return next();
//     }

//     return res.status(401).json({
//       error: "Session expired. Please login again.",
//     });
//   } catch (error) {
//     console.error("Auth error:", error);
//     return res.status(401).json({ error: "Unauthorized" });
//   }
// };
