"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
const db_1 = __importDefault(require("../db"));
const base = process.env.KEYCLOAK_BASE_URL;
const realm = process.env.KEYCLOAK_REALM;
const audience = process.env.KEYCLOAK_AUDIENCE;
const issuer = `${base}/realms/${realm}`;
const jwksUri = `${issuer}/protocol/openid-connect/certs`;
const client = (0, jwks_rsa_1.default)({ jwksUri });
function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
        const signingKey = key?.getPublicKey();
        callback(null, signingKey);
    });
}
async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Missing or invalid Authorization header" });
        }
        const token = authHeader.split(" ")[1];
        jsonwebtoken_1.default.verify(token, getKey, { audience, issuer, algorithms: ["RS256"] }, async (err, decoded) => {
            if (err)
                return res.status(401).json({ error: "Invalid token" });
            const email = decoded?.email;
            const tenantId = decoded.tenantId;
            const roles = decoded?.realm_access?.roles || [];
            let user = await db_1.default.user.findUnique({
                where: {
                    email_tenantId: {
                        email,
                        tenantId,
                    },
                },
            });
            // ✅ FIX 2: create user with tenantId
            if (!user) {
                const role = roles.includes("MANAGER") ? "MANAGER" : "OPERATOR";
                user = await db_1.default.user.create({
                    data: {
                        email,
                        password: "",
                        role,
                        tenantId,
                    },
                });
            }
            req.user = user;
            next();
        });
    }
    catch (e) {
        res.status(401).json({ error: "Unauthorized" });
    }
}
//# sourceMappingURL=requireAuth.js.map