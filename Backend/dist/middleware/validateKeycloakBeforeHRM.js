"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureFreshKeycloakToken = void 0;
// src/middleware/validateKeycloakBeforeHRM.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
const axios_1 = __importDefault(require("axios"));
/**
 * Ensures employee's Keycloak token is valid before sending data to HRM.
 * Refreshes if expired, otherwise continues with the current token.
 */
// export const ensureFreshKeycloakToken = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const accessToken = req.cookies?.keycloak_token;
//     const refreshToken = req.cookies?.keycloak_refresh_token;
//     if (!accessToken && !refreshToken) {
//       return res.status(401).json({ error: "Session expired, login again." });
//     }
//     // Try verifying access token
//     try {
//       const decodedHeader = jwt.decode(accessToken, { complete: true });
//       const kid = decodedHeader?.header?.kid;
//       const client = jwksClient({
//         jwksUri: `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
//       });
//       const key = await client.getSigningKey(kid);
//       const publicKey = key.getPublicKey();
//       jwt.verify(accessToken, publicKey);
//       // Valid → attach and continue
//       req.validAccessToken = accessToken;
//       return next();
//     } catch {
//       console.log("Access token expired, refreshing...");
//     }
//     // If expired, refresh
//     if (!refreshToken)
//       return res.status(401).json({ error: "Session expired, please log in" });
//     const tokenUrl = `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
//     const params = new URLSearchParams({
//       grant_type: "refresh_token",
//       client_id: process.env.KEYCLOAK_CLIENT_ID!,
//       client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
//       refresh_token: refreshToken,
//     });
//     const { data: refreshed } = await axios.post(tokenUrl, params, {
//       headers: { "Content-Type": "application/x-www-form-urlencoded" },
//     });
//     // Update cookies with new tokens
//     res.cookie("keycloak_token", refreshed.access_token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "strict",
//       maxAge: refreshed.expires_in * 1000,
//     });
//     res.cookie("keycloak_refresh_token", refreshed.refresh_token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "strict",
//       maxAge: refreshed.refresh_expires_in * 1000,
//     });
//     req.validAccessToken = refreshed.access_token;
//     next();
//   } catch (error) {
//     console.error("Keycloak check failed:", error);
//     res.status(401).json({ error: "Invalid or expired token" });
//   }
// };
function getRealmFromIss(iss) {
    const parts = iss.split("/realms/");
    if (parts.length !== 2) {
        throw new Error("Invalid issuer format");
    }
    return {
        baseUrl: parts[0],
        realm: parts[1],
    };
}
const ensureFreshKeycloakToken = async (req, res, next) => {
    try {
        const accessToken = req.cookies?.keycloak_token;
        const refreshToken = req.cookies?.keycloak_refresh_token;
        // ❌ No tokens at all → login
        if (!accessToken && !refreshToken) {
            return res.status(401).json({ error: "Session expired, login again." });
        }
        /* -------------------------------------------------
           1️⃣ Try access token ONLY if it exists
        --------------------------------------------------*/
        if (accessToken) {
            try {
                const decodedHeader = jsonwebtoken_1.default.decode(accessToken, { complete: true });
                const kid = decodedHeader?.header?.kid;
                const { baseUrl, realm } = getRealmFromIss(decodedHeader?.payload?.iss);
                const client = (0, jwks_rsa_1.default)({
                    jwksUri: `${baseUrl}/realms/${realm}/protocol/openid-connect/certs`,
                });
                const key = await client.getSigningKey(kid);
                const publicKey = key.getPublicKey();
                jsonwebtoken_1.default.verify(accessToken, publicKey);
                // ✅ Access token valid
                req.validAccessToken = accessToken;
                return next();
            }
            catch {
                // Access token expired or invalid → try refresh
                console.log("Access token invalid/expired, trying refresh...");
            }
        }
        /* -------------------------------------------------
           2️⃣ Refresh using refresh token
        --------------------------------------------------*/
        if (!refreshToken) {
            return res.status(401).json({ error: "Session expired, login again." });
        }
        try {
            const tokenUrl = `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
            const params = new URLSearchParams({
                grant_type: "refresh_token",
                client_id: process.env.KEYCLOAK_CLIENT_ID,
                client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
                refresh_token: refreshToken,
            });
            const { data } = await axios_1.default.post(tokenUrl, params, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });
            // ✅ Store NEW tokens (rotation safe)
            res.cookie("keycloak_token", data.access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: data.expires_in * 1000,
            });
            res.cookie("keycloak_refresh_token", data.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: data.refresh_expires_in * 1000,
            });
            req.validAccessToken = data.access_token;
            return next();
        }
        catch (err) {
            console.error("Refresh token expired or invalid", err);
            return res.status(401).json({ error: "Session expired, login again." });
        }
    }
    catch (err) {
        console.error("Keycloak middleware failure:", err);
        return res.status(401).json({ error: "Authentication failed" });
    }
};
exports.ensureFreshKeycloakToken = ensureFreshKeycloakToken;
//# sourceMappingURL=validateKeycloakBeforeHRM.js.map