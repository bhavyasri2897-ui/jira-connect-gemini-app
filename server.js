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
app.get("/atlassian-connect.json", (req, res) => {
  const descriptor = {
    name: "A.AVA Digital Ascender",
    description:
      "Plugin to generate stories within an epic, create test cases, and add a new button at the Sprint Board level and Backlog Level",

    key: "AVA.Ascender.Plugin-v1",
    baseUrl: BASE_URL,

    vendor: {
      name: "Ascendion, Inc.",
      url: "https://Ascendion.com"
    },

    authentication: {
      type: "none"
    },

    apiMigrations: {
      gdpr: true
    },

    scopes: ["read", "write", "act_as_user", "admin"],

    apiVersion: 1,

    modules: {
      jiraIssueContents: [
        {
          key: "my-issue-content-panel",
          name: { value: "Digital Ascender" },
          icon: { url: "/public/icon.png" },

          // ✅ REQUIRED for install (fixes connect.install.error.missing.url)
          url: "/public/issue-panel.html",
          location: "atl.jira.view.issue.right.context",

          tooltip: { value: "A.AVA Digital Ascender" },
          contentPresentConditions: [
            { condition: "user_is_admin", invert: false }
          ],
          jiraNativeAppsEnabled: false
        }
      ],

      webItems: [
        {
          key: "board-custom-action",
          location: "jira.software.board.tools",
          name: { value: "AVA+ Digi Sprinter" },
          context: "addon",
          tooltip: { value: "AVA+ Digi Sprinter" },
          weight: 10,
          icon: {
            url: "/public/avaplus.png",
            width: 24,
            height: 24
          },
          contentPresentConditions: [
            { condition: "user_is_admin", invert: false }
          ],
          jiraNativeAppsEnabled: false
        },
        {
          key: "backlog-custom-action",
          location: "jira.software.backlog.tools",
          name: { value: "AVA+ Digi Sprinter" },
          context: "addon",
          tooltip: { value: "AVA+ Digi Sprinter" },
          weight: 20,
          icon: {
            url: "/public/avaplus.png",
            width: 24,
            height: 24
          },
          contentPresentConditions: [
            { condition: "user_is_admin", invert: false }
          ],
          jiraNativeAppsEnabled: false
        }
      ],

      configurePage: {
        key: "configuration",
        url: "/configure",
        name: { value: "Configure A.AVA Digital Ascender" }
      },

      webhooks: [
        {
          event: "jira:issue_updated",
          url: "/issue-updated",
          excludeBody: false
        }
      ]
    }
  };

  res.status(200).type("application/json").json(descriptor);
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
