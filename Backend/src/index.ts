// src/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import employeeRoutes from './routes/employees';
import taskRoutes from './routes/tasks';
import CommnetRoutes from "./routes/Comment"
import cookieParser from "cookie-parser";

const app = express();

app.use(cookieParser());

app.use(
  cors({
    origin: ["http://localhost:8080","http://194.163.139.103:4001", "http://localhost:5000", "http://localhost:8082"], // your frontend origin
    credentials: true, // ✅ allows cookies
  })
);
app.use(express.json());

app.use((req, res, next) => {
  res.removeHeader("X-Frame-Options"); // you already had this
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' http://localhost:8082"
  );
  res.setHeader("Permissions-Policy", "geolocation=(self)");
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/tasks', taskRoutes);
app.use("/api/comments", CommnetRoutes);

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
