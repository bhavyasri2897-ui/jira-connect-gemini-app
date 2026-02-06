const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL; // ngrok https url
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use("/public", express.static(path.join(__dirname, "public")));

// ✅ Connect descriptor
app.get("/atlassian-connect.json", (req, res) => {
  res.json({
    key: "my-connect-app",
    name: "My Connect App",
    baseUrl: BASE_URL,
    authentication: { type: "none" }, // dev demo (keep simple)
    apiVersion: 1,
    scopes: ["READ"],
    modules: {
      jiraIssueContents: [
        {
          key: "gemini-issue-panel",
          name: { value: "Gemini Panel" },
          url: "/public/issue-panel.html?issueKey={issue.key}",
          location: "atl.jira.view.issue.right.context"
        }
      ]
    }
  });
});

// ✅ Gemini API proxy (backend)
app.post("/api/gemini", async (req, res) => {
  try {
    const { prompt } = req.body;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await r.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini";

    res.json({ response: text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Gemini call failed" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Running: http://localhost:${PORT}`);
  console.log(`✅ Descriptor: ${BASE_URL}/atlassian-connect.json`);
});
