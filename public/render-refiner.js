function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

const issueKey = qs("issueKey");

const metaEl = document.getElementById("meta");
const statusEl = document.getElementById("status");
const promptBox = document.getElementById("promptBox");
const outputBox = document.getElementById("outputBox");
const btnCall = document.getElementById("btnCall");

function setStatus(msg) {
  statusEl.textContent = msg;
}


function setLoading(isLoading) {
  btnCall.disabled = isLoading;
  btnCall.textContent = isLoading ? "⏳ Refining..." : "✨ Refine with Gemini";
}

metaEl.textContent = issueKey ? `Issue: ${issueKey}` : "Issue: (missing issueKey)";

/**
 * Jira Cloud description is often ADF (Atlassian Document Format).
 * This function extracts readable text from ADF JSON.
 */
function adfToText(node) {
  if (!node) return "";

  // If it's already a string (rare), return directly
  if (typeof node === "string") return node;

  // If it's an array of nodes
  if (Array.isArray(node)) return node.map(adfToText).join("");

  // Text node
  if (node.type === "text") return node.text || "";

  // Hard break
  if (node.type === "hardBreak") return "\n";

  // Paragraph / heading / listItem etc - add line breaks between blocks
  const blockTypes = new Set([
    "paragraph",
    "heading",
    "blockquote",
    "listItem",
    "codeBlock",
    "panel",
    "tableRow",
  ]);

  const contentText = adfToText(node.content || []);

  if (blockTypes.has(node.type)) return contentText + "\n";

  return contentText;
}
function onGeminiClick(){
  alert("Gemini Clicked")
}
function getIssueFromJira(issueKey) {
  return new Promise((resolve, reject) => {
    if (!window.AP) return reject(new Error("AP is not available. Load inside Jira."));
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

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Gemini call failed");
  return data.response || "";
}

btnCall.addEventListener("click", async () => {
  if (!issueKey) {
    setStatus("❌ Missing issueKey in URL");
    return;
  }

  try {
    setLoading(true);
    outputBox.value = "";
    setStatus("1/3 Fetching current Jira description…");

    // ✅ 1) Get current issue description from Jira
    const issue = await getIssueFromJira(issueKey);
    const summary = issue?.fields?.summary || "";
    const descADF = issue?.fields?.description || null;

    const descText = adfToText(descADF).trim();
    if (!descText) {
      setStatus("⚠️ Issue has no description. Still calling Gemini with summary.");
    }

    // ✅ 2) Build prompt
    const prompt =
      `Analyze the input Jira ticket description and rewrite it in a structured and professional manner.\n\n` +
      `Follow this format:\n` +
      `1. Problem Summary\n` +
      `2. Background\n` +
      `3. Expected Outcome\n` +
      `4. Acceptance Criteria\n\n` +
      `Issue Key: ${issueKey}\n` +
      `Summary: ${summary}\n\n` +
      `Description:\n${descText || "(empty)"}\n`;

    // show user what prompt is being used (optional)
    promptBox.value = prompt;

    setStatus("2/3 Calling Gemini API…");

    // ✅ 3) Call backend → Gemini
    const geminiOutput = await callGemini(prompt);

    // ✅ 4) Show output
    outputBox.value = geminiOutput;
    setStatus("✅ Done: Gemini output received.");
  } catch (e) {
    console.error(e);
    setStatus(
      "❌ Failed. If description is not loading, check: Jira app scopes (READ) + JWT/auth setup. " +
        (e?.message || "")
    );
  } finally {
    setLoading(false);
  }
});
