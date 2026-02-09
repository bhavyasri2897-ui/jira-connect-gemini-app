(() => {
  const btn = document.getElementById("btnRefine");
  const statusEl = document.getElementById("status");
  const outputEl = document.getElementById("output") || document.getElementById("refinedDesc");

  function setStatus(msg) {
    statusEl.textContent = msg;
  }
  function setLoading(v) {
    btn.disabled = v;
    btn.textContent = v ? "⏳ Working..." : "✨ Refine with Gemini";
  }
  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }
  const issueKey = qs("issueKey");

  // ADF -> text
  function adfToText(node) {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(adfToText).join("");
    if (node.type === "text") return node.text || "";
    if (node.type === "hardBreak") return "\n";
    const block = new Set(["paragraph", "heading", "blockquote", "listItem"]);
    const t = adfToText(node.content || []);
    return block.has(node.type) ? t + "\n" : t;
  }

  function getIssue(issueKey) {
    return new Promise((resolve, reject) => {
      if (!window.AP) return reject(new Error("AP not available (must open inside Jira)"));
      AP.request({
        url: `/rest/api/3/issue/${issueKey}?fields=summary,description`,
        type: "GET",
        success: (txt) => {
          try { resolve(JSON.parse(txt)); } catch (e) { reject(e); }
        },
        error: (err) => reject(new Error("AP.request failed: " + JSON.stringify(err))),
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
      throw new Error((data?.error || "Gemini API failed") + ` (status ${res.status})`);
    }
    return data.response || "";
  }

  btn.addEventListener("click", async () => {
    try {
      if (!issueKey) {
        setStatus("❌ Missing issueKey in URL");
        return;
      }

      setLoading(true);
      if (outputEl) outputEl.value = "";

      setStatus("1/3 Reading Jira description…");
      const issue = await getIssue(issueKey);

      const summary = issue?.fields?.summary || "";
      const descText = adfToText(issue?.fields?.description).trim();

      setStatus("2/3 Calling /api/gemini…");
      const prompt =
        `Rewrite this Jira ticket professionally.\n\n` +
        `Format:\n1. Problem Summary\n2. Background\n3. Expected Outcome\n4. Acceptance Criteria\n\n` +
        `Issue: ${issueKey}\nSummary: ${summary}\n\nDescription:\n${descText || "(empty)"}`;

      const out = await callGemini(prompt);

      if (outputEl) outputEl.value = out;
      setStatus("✅ Done (Gemini response received).");
    } catch (e) {
      console.error("❌ Click flow failed:", e);
      setStatus("❌ " + (e?.message || "Failed"));
    } finally {
      setLoading(false);
    }
  });

  setStatus("Ready. Click the button.");
})();
