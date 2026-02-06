const btn = document.getElementById("btn");
const out = document.getElementById("out");

function getIssueKey() {
  const p = new URLSearchParams(window.location.search);
  return p.get("issueKey");
}

btn.addEventListener("click", async () => {
  try {
    const issueKey = getIssueKey();
    out.textContent = "Calling Gemini...";

    // Example prompt (you can also fetch Jira issue summary first)
    const prompt = `Rewrite this Jira ticket professionally. IssueKey: ${issueKey}`;

    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    out.textContent = data.response || JSON.stringify(data, null, 2);
  } catch (e) {
    console.error(e);
    out.textContent = "Error calling Gemini";
  }
});
