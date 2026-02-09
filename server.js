const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL; // e.g. https://jira-connect-gemini-app.onrender.com
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use("/public", express.static(path.join(__dirname, "public")));

// ✅ REQUIRED by Jira Connect during install
app.post("/installed", (req, res) => {
  console.log("✅ /installed called by Jira");
  console.log(req.body); // contains clientKey, baseUrl, etc.
  return res.status(204).send();
});

app.post("/uninstalled", (req, res) => {
  console.log("❌ /uninstalled called by Jira");
  console.log(req.body);
  return res.status(204).send();
});

// ✅ Connect descriptor
// app.get("/atlassian-connect.json", (req, res) => {
//   const descriptor = {
//     key: "jira-gemini-connect-app-001", // ✅ MUST be unique
//     description: "Plugin to generate stories within an epic, create test cases, and add a new button at the Sprint Board level and Backlog Level",
//     name: "Gemini Jira Connect",
//     baseUrl: BASE_URL,
//     authentication: { type: "none" }, // dev/demo
//     apiVersion: 1,
//     scopes: ["READ"],
//     lifecycle: {
//       installed: "/installed",
//       uninstalled: "/uninstalled"
//     },
//     modules: {
//       jiraIssueContents: [
//         {
//           key: "gemini-issue-panel",
//           name: { value: "Gemini AI" },
//           url: "/public/issue-pannel.html",
//           location: "atl.jira.view.issue.right.context"
//         }
//       ]
//     }
//   };

//   res.status(200).type("application/json").json(descriptor);
// });
// ✅ Connect descriptor
app.get("/atlassian-connect.json", (req, res) => {
  const descriptor = {
    "apiVersion": 1,
    "key": "aava-refiner-v4",
    "name": "AAVA Description Refiner",
    "description": "Refine Jira issue descriptions using Gemini AI",
    "vendor": {
        "name": "AAVA",
        "url": "https://example.com"
    },
    "baseUrl": "https://jira-connect-gemini-app.onrender.com",
    "links": {
        "self": "https://jira-connect-gemini-app.onrender.com/atlassian-connect.json",
    },
    "authentication": {
        "type": "jwt"
    },
    "apiMigrations": {
        "context-qsh": true
    },
    "lifecycle": {
        "installed": "/installed"
    },
    "scopes": [
        "READ",
        "WRITE"
    ],
    "modules": {
        "jiraIssueContents": [
            {
                "key": "aava-refiner-left",
                "name": {
                    "value": "Refine with AAVA"
                },
                "target": {
                    "type": "web_panel",
                    "url": "/render-refiner?issueKey={issue.key}"
                },
                "icon": {
                    "width": 16,
                    "height": 16,
                    "url": "/icon.png"
                },
                "tooltip": {
                    "value": "Refine issue description with Gemini AI"
                }
            }
        ]
    }
}
  res.status(200).json(descriptor);
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
