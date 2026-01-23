import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import prisma from "../db";

const base = process.env.KEYCLOAK_BASE_URL!;
const realm = process.env.KEYCLOAK_REALM!;
const audience = process.env.KEYCLOAK_AUDIENCE!;
const issuer = `${base}/realms/${realm}`;
const jwksUri = `${issuer}/protocol/openid-connect/certs`;

const client = jwksClient({ jwksUri });

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = authHeader.split(" ")[1];
    jwt.verify(
      token,
      getKey,
      { audience, issuer, algorithms: ["RS256"] },
      async (err, decoded: any) => {
        if (err) return res.status(401).json({ error: "Invalid token" });

        const email = decoded?.email;
        const tenantId = decoded.tenantId;
        const roles = decoded?.realm_access?.roles || [];


        let user = await prisma.user.findUnique({
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

          user = await prisma.user.create({
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
      }
    );
  } catch (e) {
    res.status(401).json({ error: "Unauthorized" });
  }
}
