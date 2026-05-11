import { AppConstants } from "./appconstants.js";

const loader = document.getElementById("loader");
const pdfFile = document.getElementById("pdfFile");
const btnExtract = document.getElementById("btnExtract");
const btnProcess = document.getElementById("btnProcess");
const btnClear = document.getElementById("btnClear");
const playerList = document.getElementById("playerList");
const searchInput = document.getElementById("searchInput");
const btnSelectAll = document.getElementById("btnSelectAll");
const btnSelectNone = document.getElementById("btnSelectNone");
const outputJson = document.getElementById("outputJson");
const btnCopy = document.getElementById("btnCopy");
const btnDownload = document.getElementById("btnDownload");
const btnApplyDb = document.getElementById("btnApplyDb");

let extractedPlayers = [];
let latestOutput = null;

function showLoader() {
  loader.classList.remove("d-none");
}
function hideLoader() {
  loader.classList.add("d-none");
}

function requirePdf() {
  const f = pdfFile.files && pdfFile.files[0];
  if (!f) {
    Swal.fire({
      icon: "warning",
      title: "Please select a PDF",
      text: "Choose a scorecard PDF file first.",
    });
    return null;
  }
  return f;
}

function renderPlayers(filter = "") {
  const q = String(filter || "").toLowerCase().trim();
  const list = q
    ? extractedPlayers.filter((n) => n.toLowerCase().includes(q))
    : extractedPlayers;

  if (!list.length) {
    playerList.innerHTML = `<div class="muted">No players found.</div>`;
    return;
  }

  playerList.innerHTML = list
    .map((name) => {
      const safeId = `p_${btoa(unescape(encodeURIComponent(name)))}`.replace(
        /[^a-zA-Z0-9_]/g,
        "_"
      );
      return `
        <div class="form-check">
          <input class="form-check-input late-player" type="checkbox" value="${escapeHtml(
            name
          )}" id="${safeId}">
          <label class="form-check-label" for="${safeId}">${escapeHtml(
        name
      )}</label>
        </div>
      `;
    })
    .join("");
}

function getLatePlayersSelection() {
  const checks = Array.from(
    document.querySelectorAll("input.late-player[type='checkbox']")
  );
  return checks.filter((c) => c.checked).map((c) => c.value);
}

function setAllCheckboxes(checked) {
  const checks = Array.from(
    document.querySelectorAll("input.late-player[type='checkbox']")
  );
  for (const c of checks) c.checked = checked;
}

function setOutput(obj) {
  latestOutput = obj;
  outputJson.textContent = JSON.stringify(obj, null, 2);
  btnCopy.disabled = false;
  btnDownload.disabled = false;
  btnApplyDb.disabled = false;
}

function clearAll() {
  extractedPlayers = [];
  latestOutput = null;
  outputJson.textContent = "No output yet.";
  playerList.innerHTML = `<div class="muted">Extract players to see the list.</div>`;
  btnProcess.disabled = true;
  btnCopy.disabled = true;
  btnDownload.disabled = true;
  btnApplyDb.disabled = true;
  searchInput.value = "";
  pdfFile.value = "";
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

btnExtract.addEventListener("click", async () => {
  const f = requirePdf();
  if (!f) return;

  showLoader();
  try {
    const fd = new FormData();
    fd.append("pdf", f);

    const resp = await fetch(
      `${AppConstants.baseUrl}/api/scorecard/extract-players`,
      { method: "POST", body: fd }
    );

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      throw new Error((data && data.message) || "Extract failed");
    }

    extractedPlayers = Array.isArray(data) ? data : [];
    if (!extractedPlayers.length) {
      Swal.fire({
        icon: "info",
        title: "No players detected",
        text: "Parser did not find any names in this PDF. You may need to tweak parsing rules.",
      });
    }

    renderPlayers(searchInput.value);
    btnProcess.disabled = extractedPlayers.length === 0;
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Extract failed",
      text: String(err && err.message ? err.message : err),
    });
  } finally {
    hideLoader();
  }
});

btnProcess.addEventListener("click", async () => {
  const f = requirePdf();
  if (!f) return;

  showLoader();
  try {
    const latePlayers = getLatePlayersSelection();

    const fd = new FormData();
    fd.append("pdf", f);
    fd.append("latePlayers", JSON.stringify(latePlayers));

    const resp = await fetch(`${AppConstants.baseUrl}/api/scorecard/process`, {
      method: "POST",
      body: fd,
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      throw new Error((data && data.message) || "Process failed");
    }

    setOutput(data);
    Swal.fire({
      icon: "success",
      title: "Processed",
      text: `Generated JSON for ${Array.isArray(data) ? data.length : 0} players.`,
      timer: 1200,
      showConfirmButton: false,
    });
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Process failed",
      text: String(err && err.message ? err.message : err),
    });
  } finally {
    hideLoader();
  }
});

btnClear.addEventListener("click", () => clearAll());

searchInput.addEventListener("input", (e) => {
  renderPlayers(e.target.value);
});

btnSelectAll.addEventListener("click", () => setAllCheckboxes(true));
btnSelectNone.addEventListener("click", () => setAllCheckboxes(false));

btnCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(latestOutput, null, 2));
    Swal.fire({
      icon: "success",
      title: "Copied",
      timer: 900,
      showConfirmButton: false,
    });
  } catch {
    Swal.fire({
      icon: "error",
      title: "Copy failed",
      text: "Your browser blocked clipboard access.",
    });
  }
});

btnDownload.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(latestOutput, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "scorecard-output.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

btnApplyDb.addEventListener("click", async () => {
  if (!Array.isArray(latestOutput) || latestOutput.length === 0) {
    Swal.fire({
      icon: "warning",
      title: "No JSON to apply",
      text: "Generate scorecard JSON first.",
    });
    return;
  }

  showLoader();
  try {
    const resp = await fetch(`${AppConstants.baseUrl}/api/scorecard/apply-to-db`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ players: latestOutput }),
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      throw new Error((data && data.message) || "Apply to DB failed");
    }

    Swal.fire({
      icon: "success",
      title: "Scores added to DB",
      text: `Updated: ${data.updatedCount || 0}, Skipped: ${data.skippedCount || 0}`,
    });
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Apply failed",
      text: String(err && err.message ? err.message : err),
    });
  } finally {
    hideLoader();
  }
});

// initial state
clearAll();

