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
// ✅ Gemini API proxy (backend)
app.post("/api/gemini", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "prompt is required" });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY missing in env" });
    }

    // ✅ Use a current model (fast + cheap)
    const MODEL = "gemini-1.5-flash"; // you can also try "gemini-3-flash-preview"
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    });

    const data = await r.json();

    // ✅ IMPORTANT: if Gemini returns an error, show it
    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || "Gemini API error",
        details: data
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(502).json({
        error: "Gemini returned no text",
        details: data
      });
    }

    return res.json({ response: text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Gemini call failed", details: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Running: http://localhost:${PORT}`);
  console.log(`✅ Descriptor: ${BASE_URL}/atlassian-connect.json`);
});
