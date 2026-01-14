import { Router } from "express";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import prisma from "../db";
import { ensureFreshKeycloakToken } from "../middleware/validateKeycloakBeforeHRM";
import axios from "axios";
import { auth } from "../middleware/auth";

const router = Router();

const getTodayDate = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

router.post("/register", async (req, res) => {
  try {
    const { email, password, role, name, roleTitle, department } = req.body;
    if (!email || !password || !role)
      return res.status(400).json({ error: "email, password, role required" });

    const hash = await bcrypt.hash(
      password,
      Number(process.env.BCRYPT_ROUNDS) || 10
    );
    const user = await prisma.user.create({
      data: { email, password: hash, role },
    });

    // if operator, optionally create Employee profile
    if (role === "OPERATOR") {
      await prisma.employee.create({
        data: {
          userId: user.id,
          name: name ?? email.split("@")[0],
          roleTitle: roleTitle ?? "Operator",
          department: department ?? "Operations",
        },
      });
    }

    res.json({ id: user.id, email: user.email, role: user.role });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "register failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email & password required" });

    // 1️⃣ Authenticate with Keycloak
    const tokenUrl = `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;

    const body = new URLSearchParams({
      grant_type: "password",
      client_id: process.env.KEYCLOAK_PROVISIONER_CLIENT_ID!, // e.g. hrm-backend
      client_secret: process.env.KEYCLOAK_PROVISIONER_CLIENT_SECRET!, // from Credentials tab
      username: email,
      password,
    });
    console.log("token url: ", tokenUrl);

    let kc;
    try {
      const { data } = await axios.post(tokenUrl, body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      kc = data;
      console.log(data);
    } catch (err: any) {
      return res
        .status(401)
        .json({ error: "Invalid credentials (Keycloak)", err });
    }

    // 2️⃣ Decode Keycloak access token to extract info
    const decoded = JSON.parse(
      Buffer.from(kc.access_token.split(".")[1], "base64").toString("utf8")
    );

    const keycloakSub = decoded.sub;
    const roles = decoded.realm_access?.roles || [];
    const role = roles.includes("MANAGER") ? "MANAGER" : "OPERATOR";

    // 3️⃣ Find or create user in Prisma
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password: "", // handled by Keycloak
          role,
        },
      });

      if (role === "MANAGER" || role === "OPERATOR") {
        await prisma.employee.create({
          data: {
            userId: user.id,
            name: email.split("@")[0], // placeholder name
            roleTitle: role,
            department: null,
            managerId: null, // Managers have no manager initially
          },
        });
      }
    }

    // 4️⃣ Link with ExternalIdentity table
    await prisma.externalIdentity.upsert({
      where: { email },
      update: { subject: keycloakSub },
      create: {
        provider: "keycloak",
        subject: keycloakSub,
        email,
        userId: user.id,
      },
    });



    // 5️⃣ Return your app’s own JWT for frontend
    const appToken = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    res.cookie("keycloak_token", kc.access_token, {
      httpOnly: true,
      secure: true, // ✅ must be false in localhost (no HTTPS)
      sameSite: "none", // ✅ allows cookies for cross-site GETs
      maxAge: kc.expires_in * 1000, // 5 mins
    });

    res.cookie("keycloak_refresh_token", kc.refresh_token, {
      httpOnly: true,
      secure: true, // ✅ must be false in localhost (no HTTPS)
      sameSite: "none", // ✅ allows cookies for cross-site GETs
      maxAge: kc.refresh_expires_in * 1000, // ~30 mins
    });


    const today = getTodayDate();

    const attendance = await prisma.userAttendance.upsert({
      where: {
        userId_workDate: {
          userId: user.id,
          workDate: today,
        },
      },
      update: {
        // Do NOT overwrite loginTime if already exists
        isActiveSession: true,
      },
      create: {
        userId: user.id,
        workDate: today,
        loginTime: new Date(),
        isActiveSession: true,
      },
    });

    console.log("✅ Attendance started:", attendance.id);

    res.json({
      token: appToken, // your app token (frontend uses this)
      keycloakToken: kc.access_token,
      role: user.role,
      userId: user.id,
      email,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || "login failed" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const refreshToken = req.cookies["keycloak_refresh_token"];

    if (!refreshToken) {
      return res.status(400).json({ error: "No refresh token found" });
    }

    const logoutUrl = `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/logout`;

    const body = new URLSearchParams({
      client_id: process.env.KEYCLOAK_PROVISIONER_CLIENT_ID!,
      client_secret: process.env.KEYCLOAK_PROVISIONER_CLIENT_SECRET!,
      refresh_token: refreshToken,
    });

    await axios.post(logoutUrl, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    //  Remove cookies
    res.clearCookie("keycloak_token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    res.clearCookie("keycloak_refresh_token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    const today = getTodayDate();
    const now = new Date();

    const userId = req.user?.id;

    if (!userId) {
      return res.status(500).json({ error: "User not found" });
    }

    /* ---------------- ATTENDANCE LOGOUT ---------------- */

    const attendance = await prisma.userAttendance.findUnique({
      where: {
        userId_workDate: {
          userId,
          workDate: today,
        },
      },
      include: {
        breakLogs: true,
      },
    });

    if (attendance && attendance.isActiveSession) {
      let totalBreakMinutes = attendance.totalBreakMinutes;

      // 🔴 Edge case: user logs out during a break
      const openBreak = attendance.breakLogs
        .filter(b => !b.breakEnd)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      if (openBreak) {
        const breakMinutes = Math.ceil(
          (now.getTime() - openBreak.breakStart.getTime()) / 60000
        );

        await prisma.breakLog.update({
          where: { id: openBreak.id },
          data: { breakEnd: now },
        });

        totalBreakMinutes += breakMinutes;
      }

      const totalWorkedMinutes = Math.max(
        Math.floor(
          (now.getTime() - attendance.loginTime.getTime()) / 60000
        ) - totalBreakMinutes,
        0
      );

      await prisma.userAttendance.update({
        where: { id: attendance.id },
        data: {
          logoutTime: now,
          totalBreakMinutes,
          totalWorkingMinutes: totalWorkedMinutes,
          isActiveSession: false,
          breakStartTime: null,
          breakEndTime: null,
        },
      });

      console.log("✅ Attendance closed:", attendance.id);
    }


    return res.json({ message: "Logged out successfully" });
  } catch (err: any) {
    console.error("Logout Error:", err.response?.data || err.message);
    return res.status(500).json({
      error: err?.message || "Failed to log out",
    });
  }
});

router.post("/token", async (req, res) => {
  try {
    const url = `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;

    const body = new URLSearchParams({
      client_id: process.env.KEYCLOAK_AUDIENCE!,
      client_secret: process.env.KEYCLOAK_AUDIENCE_SECRET!,
      grant_type: "client_credentials",
    });

    const { data } = await axios.post(url, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to get token" });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    return res.json({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  } catch (error) { }
});

router.get("/go-to-hrm", ensureFreshKeycloakToken, async (req, res) => {
  try {
    const { tenantCode } = req.query;
    const backend_url = process.env.HRM_BACKEND_ROUTE;

    if (!tenantCode)
      return res.status(400).json({ error: "tenantCode is required" });

    const accessToken = req.validAccessToken;

    // Redirect to HRM frontend
    const hrmRedirectUrl = `${backend_url}/api/tenant/sso-login/${tenantCode}?token=${accessToken}&sso=1`;
    res.json({ redirectUrl: hrmRedirectUrl });
  } catch (err: any) {
    console.error("Redirect failed:", err.message);
    res.status(500).json({ error: "Failed to redirect to HRM" });
  }
});

export default router;
