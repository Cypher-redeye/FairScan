/* ════════════════════════════════════════════════════
   FairScan — Express Server
   Serves static files & proxies Gemini API calls
   so the API key stays server-side in .env
   ════════════════════════════════════════════════════ */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ── Security Middleware ──────────────────────────────
app.use((req, res, next) => {
  // Prevent serving sensitive backend files
  const reqPath = req.path.toLowerCase();
  const blockedPaths = ['.env', 'server.js', 'package.json', 'package-lock.json', '.git', 'node_modules'];
  if (blockedPaths.some(p => reqPath.includes(p))) {
    return res.status(403).json({ error: "Access Denied" });
  }

  // Basic security headers to prevent XSS and clickjacking
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Serve static files safely
app.use(express.static(path.join(__dirname), {
  dotfiles: 'deny' // Extra protection against hidden files
}));

// ── Demo Dataset Endpoint ───────────────────────────
app.get("/demo-dataset", (req, res) => {
  // Try multiple common filenames for the UCI Adult Income dataset
  const candidates = ["adult.csv", "UCI_Adult_Income_Dataset.csv"];
  let filePath = null;

  for (const name of candidates) {
    const p = path.join(__dirname, "data", name);
    if (fs.existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    return res.status(404).json({
      error: "Demo dataset not found. Please place adult.csv in the data/ folder.",
    });
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "inline; filename=adult.csv");
  fs.createReadStream(filePath).pipe(res);
});

// ── Gemini Proxy Endpoint ───────────────────────────
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

app.post("/api/gemini", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return res.status(500).json({
      error: "Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.",
    });
  }

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || response.statusText;
      return res.status(response.status).json({ error: errMsg });
    }

    res.json(data);
  } catch (err) {
    console.error("Gemini proxy error:", err);
    res.status(500).json({ error: "Failed to reach Gemini API." });
  }
});

// ── Start Server ────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ✦ FairScan server running at http://localhost:${PORT}\n`);
});

