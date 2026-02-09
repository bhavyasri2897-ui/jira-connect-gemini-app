// public/render-refiner.js

(() => {
  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  const issueKey = qs("issueKey");

  const btnRefine = document.getElementById("btnRefine");
  const statusEl = document.getElementById("status");
  const refinedDescEl = document.getElementById("refinedDesc");

  if (!btnRefine || !statusEl || !refinedDescEl) {
    console.error("Missing UI elements. Check IDs: btnRefine, status, refinedDesc");
    return;
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function setLoading(isLoading) {
    btnRefine.disabled = isLoading;
    btnRefine.textContent = isLoading ? "⏳ Working..." : "✨ Refine with Gemini";
  }

  // Convert Jira ADF -> plain text
  function adfToText(node) {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(adfToText).join("");

    if (node.type === "text") return node.text || "";
    if (node.type === "hardBreak") return "\n";

    const blockTypes = new Set(["paragraph", "heading", "blockquote", "listItem"]);
    const text = adfToText(node.content || []);
    return blockTypes.has(node.type) ? text + "\n" : text;
  }

  function getIssueData(issueKey) {
    return new Promise((resolve, reject) => {
      if (!window.AP) {
        return reject(new Error("AP is not available. Open this panel inside Jira."));
      }

      AP.request({
        url: `/rest/api/3/issue/${issueKey}?fields=summary,description`,
        type: "GET",
        success: (responseText) => {
          try {
            resolve(JSON.parse(responseText));
          } catch (e) {
            reject(e);
          }
        },
        error: (err) => reject(err),
      });
    });
  }

  async function callGemini(prompt) {
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // show backend error clearly
      throw new Error(data?.error || `Gemini API failed (${res.status})`);
    }

    return data.response || "";
  }

  btnRefine.addEventListener("click", async () => {
    if (!issueKey) {
      setStatus("❌ Missing issueKey in URL");
      return;
    }

    try {
      setLoading(true);
      refinedDescEl.value = "";

      setStatus("1/3 Fetching Jira description…");
      const issue = await getIssueData(issueKey);

      const summary = issue?.fields?.summary || "";
      const descADF = issue?.fields?.description || null;
      const descText = adfToText(descADF).trim();

      setStatus("2/3 Calling Gemini API…");
      const prompt =
        `Analyze the Jira ticket and rewrite professionally.\n\n` +
        `Follow this format:\n` +
        `1. Problem Summary\n2. Background\n3. Expected Outcome\n4. Acceptance Criteria\n\n` +
        `Issue Key: ${issueKey}\n` +
        `Summary: ${summary}\n\n` +
        `Description:\n${descText || "(empty)"}`;

      const output = await callGemini(prompt);

      refinedDescEl.value = output;
      setStatus("✅ Done (Gemini API called).");
    } catch (e) {
      console.error(e);
      setStatus("❌ " + (e?.message || "Failed"));
    } finally {
      setLoading(false);
    }
  });

  setStatus("Ready. Click the button to call Gemini.");
})();
