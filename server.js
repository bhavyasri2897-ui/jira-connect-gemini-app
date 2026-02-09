const express = require("express");
const path = require("path");
require("dotenv").config();

// ✅ Node 18+ has global fetch. For older Node, fallback to node-fetch.
const fetchFn =
  global.fetch ||
  ((...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args)));

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || "https://jira-connect-gemini-app.onrender.com";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use("/public", express.static(path.join(__dirname, "public")));

// ✅ REQUIRED by Jira Connect during install
app.post("/installed", (req, res) => {
  console.log("✅ /installed called by Jira");
  console.log(req.body);
  return res.status(204).send();
});

app.post("/uninstalled", (req, res) => {
  console.log("❌ /uninstalled called by Jira");
  console.log(req.body);
  return res.status(204).send();
});

// ✅ Descriptor (UNCHANGED)
app.get("/atlassian-connect.json", (req, res) => {
  const descriptor = {
    apiVersion: 1,
    key: "jira-pugin-connect-v1",
    name: "jira-pugin-connect",
    description: "Refine Jira issue descriptions using Gemini AI",
    vendor: {
      name: "jira-pugin-connect",
      url: "https://jira-connect-gemini-app.onrender.com"
    },
    baseUrl: "https://jira-connect-gemini-app.onrender.com",
    links: {
      self: "https://jira-connect-gemini-app.onrender.com/atlassian-connect.json"
    },
    authentication: { type: "jwt" },
    apiMigrations: { "context-qsh": true },
    lifecycle: { installed: "/installed" },
    scopes: ["READ", "WRITE"],
    modules: {
      jiraIssueContents: [
        {
          key: "jira-pugin-connect-issue-panel",
          name: { value: "jira-pugin-connect" },
          target: {
            type: "web_panel",
            url: "/render-refiner?issueKey={issue.key}"
          },
          icon: { width: 16, height: 16, url: "/icon.png" },
          tooltip: { value: "Refine issue description with Gemini AI" }
        }
      ]
    }
  };

  res.status(200).json(descriptor);
});

// ✅ Serve the frontend page used by your descriptor target URL
app.get("/render-refiner", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "render-refiner.html"));
});

// ✅ Gemini API proxy (backend) - reusing your endpoint, just using fetchFn
// app.post("/api/gemini", async (req, res) => {
//   try {
//     const { prompt } = req.body;
//     if (!prompt || !prompt.trim()) {
//       return res.status(400).json({ error: "prompt is required" });
//     }
//     if (!GEMINI_API_KEY) {
//       return res.status(500).json({ error: "GEMINI_API_KEY is missing in env" });
//     }

//     const r = await fetchFn(
//       `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
//       {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           contents: [{ parts: [{ text: prompt }] }]
//         })
//       }
//     );

//     const data = await r.json();

//     const text =
//       data?.candidates?.[0]?.content?.parts?.[0]?.text ||
//       "No response from Gemini";

//     res.json({ response: text, raw: data });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Gemini call failed" });
//   }
// });
app.post("/api/gemini", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "prompt is required" });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY missing" });
    }

    const MODEL = "models/gemini-2.5-flash-native-audio-preview-12-2025";
    const url = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:bidiGenerateContent`;

    // ✅ IMPORTANT: use fetchFn (not fetch)
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ]
      })
    });

    const data = await response.json();

    // ✅ return REAL error (so UI shows it)
    if (!response.ok) {
      console.error("❌ Gemini error:", data);
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini API error",
        details: data
      });
    }

    // ✅ Robust text extraction (bidi can return multiple parts)
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p?.text).filter(Boolean).join("\n").trim();

    if (!text) {
      console.error("❌ Gemini returned no text:", data);
      return res.status(502).json({
        error: "Gemini returned no text",
        details: data
      });
    }

    return res.json({ response: text });
  } catch (err) {
    console.error("❌ /api/gemini crashed:", err);
    return res.status(500).json({ error: "Gemini call failed", details: String(err) });
  }
});




app.listen(PORT, () => {
  console.log(`✅ Running: http://localhost:${PORT}`);
  console.log(`✅ Descriptor: ${BASE_URL}/atlassian-connect.json`);
});
