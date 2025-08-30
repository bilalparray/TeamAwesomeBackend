// addmatch.js
import { AppConstants } from "./appconstants.js";

const API_BASE = `${AppConstants.baseUrl}/api/nextmatch`;

document.addEventListener("DOMContentLoaded", () => {
  wireUp();
  loadMatches();
});

/*
  Expected/optional HTML element IDs (script will work even if some are absent):
    - matchForm (form)
    - matchId (hidden input for editing)
    - matchVs (opponent)                        -> maps to schema: opponent
    - isSeriesInput OR matchType                -> isSeries boolean (either checkbox/select with 'Series'/'Individual')
    - seriesName                                -> seriesName
    - totalMatches                              -> totalMatches
    - seriesMatchNumber OR matchNumber          -> matchNumber (match index in series)
    - seriesLeader                              -> seriesLeader
    - seriesScoreOur / seriesScoreOpponent      -> seriesScore object (optional)
    - venue                                     -> venue
    - overs                                     -> overs
    - isHomeMatchCheckbox                       -> isHomeMatch (checkbox)
    - statusSelect                              -> status (upcoming/completed)
    - matchDate (date or datetime-local)        -> date
    - matchTable tbody                          -> table body where rows will be appended
*/

const form = document.getElementById("matchForm");
const idField = document.getElementById("matchId");
const opponentEl = document.getElementById("matchVs");
const matchTypeEl = document.getElementById("matchType"); // optional: select 'Series'/'Individual'
const isSeriesCheckbox = document.getElementById("isSeriesInput"); // optional: checkbox boolean
const seriesNameEl = document.getElementById("seriesName");
const totalMatchesEl = document.getElementById("totalMatches");
const seriesMatchNumberEl = document.getElementById("seriesMatchNumber") || document.getElementById("matchNumber");
const seriesLeaderEl = document.getElementById("seriesLeader");
const seriesScoreOurEl = document.getElementById("seriesScoreOur");
const seriesScoreOppEl = document.getElementById("seriesScoreOpponent");
const venueEl = document.getElementById("venue");
const oversEl = document.getElementById("overs");
const isHomeMatchEl = document.getElementById("isHomeMatchCheckbox");
const statusEl = document.getElementById("statusSelect");
const dateEl = document.getElementById("matchDate");
const tableBody = document.querySelector("#matchTable tbody") || document.querySelector("#matchTableBody");

// wire up listeners
function wireUp() {
  // form submit create/update
  if (form) form.addEventListener("submit", (e) => {
    e.preventDefault();
    saveMatch();
  });

  // toggle series fields (if matchType select exists)
  const typeToggleEl = matchTypeEl || isSeriesCheckbox;
  if (typeToggleEl) {
    typeToggleEl.addEventListener("change", () => {
      toggleSeriesFields(isSeriesValue());
    });
    // initial toggle
    toggleSeriesFields(isSeriesValue());
  }
}

// determines if the current form selection indicates a series
function isSeriesValue() {
  if (isSeriesCheckbox) {
    return Boolean(isSeriesCheckbox.checked);
  }
  if (matchTypeEl) {
    return String(matchTypeEl.value).toLowerCase() === "series";
  }
  // default: false
  return false;
}

// show/hide series-related inputs if they exist
function toggleSeriesFields(show) {
  const ids = [
    "seriesName",
    "seriesWon",
    "totalMatches",
    "seriesMatchNumber",
    "matchNumber",
    "seriesLeader",
    "seriesScoreOur",
    "seriesScoreOpponent"
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    // enable/disable the field
    el.disabled = !show;

    // find a wrapper to hide (closest div) so whole column disappears on small screens
    const wrapper = el.closest("div");

    if (show) {
      // remove d-none on wrapper and element (if they were hidden)
      if (wrapper) wrapper.classList.remove("d-none");
      el.classList.remove("d-none");
    } else {
      el.classList.add("d-none")
    }
  });
}


// safe JSON parse only if JSON content-type
async function safeJson(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return null;
}

// load and render matches (LIFO - backend already sorts by createdAt desc)
async function loadMatches() {
  try {
    const res = await fetch(API_BASE, { method: "GET" });
    if (!res.ok) {
      const txt = await res.text();
      console.error("Failed to load matches:", txt);
      alert("Failed to load matches. See console for server response.");
      return;
    }
    const matches = await safeJson(res) || [];
    renderMatches(matches);
  } catch (err) {
    console.error("Error loading matches:", err);
    alert("Error loading matches (see console).");
  }
}

function renderMatches(matches) {
  if (!tableBody) return;
  tableBody.innerHTML = "";

  // Ensure array order: assume backend returns newest-first. If not, uncomment below line to reverse
  // matches = matches.reverse();

  matches.forEach((m) => {
    const tr = document.createElement("tr");

    // Some backends use different field names; we try multiple fallbacks
    const opponent = m.opponent ?? m.matchVs ?? m.opponentName ?? "";
    const isSeries = m.isSeries ?? (m.seriesName ? true : false);
    const dateRaw = m.date ?? m.matchDate ?? m.createdAt ?? null;
    let dateText = "-";
    if (dateRaw) {
      try { dateText = new Date(dateRaw).toLocaleString(); } catch (e) { dateText = String(dateRaw); }
    }

    const seriesInfo = isSeries
      ? `${m.seriesName ? escapeHtml(m.seriesName) + " | " : ""}#${m.matchNumber ?? m.seriesMatchNumber ?? "-"} / total:${m.totalMatches ?? "-"}`
      : "-";

    // seriesScore formatting
    let seriesScoreText = "-";
    if (m.seriesScore) {
      seriesScoreText = `${m.seriesScore.ourTeam ?? 0} - ${m.seriesScore.opponent ?? 0}`;
    }

    // build actions (buttons attach via delegation after inserting)
    tr.innerHTML = `
      <td>${escapeHtml(opponent)}</td>
      <td>${isSeries ? "Series" : "Individual"}</td>
      <td>${escapeHtml(seriesInfo)}</td>
      <td>${seriesScoreText}</td>
      <td>${escapeHtml(m.venue ?? "-")}</td>
      <td>${dateText}</td>
      <td>
        <button class="action-edit" data-id="${m._id}">Edit</button>
        <button class="action-delete" data-id="${m._id}">Delete</button>
      </td>
    `;

    tableBody.appendChild(tr);
  });

  // attach listeners (delegation alternative)
  tableBody.querySelectorAll(".action-edit").forEach(btn => {
    btn.removeEventListener("click", handleEditClick);
    btn.addEventListener("click", handleEditClick);
  });
  tableBody.querySelectorAll(".action-delete").forEach(btn => {
    btn.removeEventListener("click", handleDeleteClick);
    btn.addEventListener("click", handleDeleteClick);
  });
}

function handleEditClick(e) {
  const id = e.currentTarget.dataset.id;
  if (!id) return;
  editMatch(id);
}

function handleDeleteClick(e) {
  const id = e.currentTarget.dataset.id;
  if (!id) return;
  deleteMatch(id);
}

// Build payload reading values from form if present; uses schema field names
function buildPayloadFromForm() {
  const payload = {};

  // opponent
  if (opponentEl) payload.opponent = String(opponentEl.value || "").trim();

  // isSeries (boolean)
  payload.isSeries = isSeriesValue();

  // date - convert to ISO if input available
  if (dateEl && dateEl.value) {
    // If input is datetime-local, add timezone by creating Date object and toISOString
    // If input is date only, toISOString will include midnight UTC -> backend handles Date parsing
    try {
      const dt = new Date(dateEl.value);
      payload.date = dt.toISOString();
    } catch (e) {
      payload.date = dateEl.value;
    }
  }

  // series fields
  if (seriesNameEl) payload.seriesName = seriesNameEl.value || undefined;
  if (totalMatchesEl) payload.totalMatches = totalMatchesEl.value ? Number(totalMatchesEl.value) : undefined;
  if (seriesMatchNumberEl) payload.matchNumber = seriesMatchNumberEl.value ? Number(seriesMatchNumberEl.value) : undefined;
  if (seriesLeaderEl) payload.seriesLeader = seriesLeaderEl.value || undefined;

  // seriesScore object: either from two inputs or from a single 'seriesWon' style field (try both)
  if (seriesScoreOurEl || seriesScoreOppEl) {
    payload.seriesScore = {
      ourTeam: seriesScoreOurEl && seriesScoreOurEl.value ? Number(seriesScoreOurEl.value) : 0,
      opponent: seriesScoreOppEl && seriesScoreOppEl.value ? Number(seriesScoreOppEl.value) : 0
    };
  } else {
    // fallback: if there is an element named 'seriesWon' treat it as ourTeam score
    const fallbackWon = document.getElementById("seriesWon");
    if (fallbackWon && fallbackWon.value) {
      payload.seriesScore = { ourTeam: Number(fallbackWon.value), opponent: 0 };
    }
  }

  if (venueEl) payload.venue = venueEl.value || undefined;
  if (oversEl) payload.overs = oversEl.value ? Number(oversEl.value) : undefined;
  if (isHomeMatchEl) payload.isHomeMatch = Boolean(isHomeMatchEl.checked);
  if (statusEl) payload.status = statusEl.value || undefined;

  // Clean undefined keys (so backend defaults work)
  Object.keys(payload).forEach(k => {
    if (payload[k] === undefined) delete payload[k];
  });

  return payload;
}

// Save match (create or update)
async function saveMatch() {
  // basic validation
  if (!opponentEl || !opponentEl.value.trim()) {
    alert("Opponent is required.");
    return;
  }
  if (!dateEl || !dateEl.value) {
    alert("Date is required.");
    return;
  }

  const payload = buildPayloadFromForm();

  try {
    if (idField && idField.value) {
      // Update
      const id = idField.value;
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("Update failed:", txt);
        alert("Update failed. See console.");
        return;
      }
      await safeJson(res);
      // reset form
      form?.reset();
      if (typeToggleExists()) (matchTypeEl || isSeriesCheckbox).dispatchEvent(new Event("change"));
      if (idField) idField.value = "";
      await loadMatches();
      return;
    }

    // Create
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("Create failed:", txt);
      alert("Create failed. See console.");
      return;
    }
    await safeJson(res);
    form?.reset();
    if (typeToggleExists()) (matchTypeEl || isSeriesCheckbox).dispatchEvent(new Event("change"));
    await loadMatches();
  } catch (err) {
    console.error("Error saving match:", err);
    alert("Error saving match (see console).");
  }
}

function typeToggleExists() {
  return Boolean(matchTypeEl || isSeriesCheckbox);
}

// Edit: fetch a single match and populate the form with returned fields
async function editMatch(id) {
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: "GET" });
    if (!res.ok) {
      const txt = await res.text();
      console.error("Failed to fetch match:", txt);
      alert("Failed to fetch match details. See console.");
      return;
    }
    const match = await safeJson(res);
    if (!match) {
      alert("No match data returned.");
      return;
    }

    // fill form (safe fallbacks)
    if (idField) idField.value = match._id ?? id;
    if (opponentEl) opponentEl.value = match.opponent ?? match.matchVs ?? "";
    if (matchTypeEl) matchTypeEl.value = match.isSeries ? "Series" : (match.matchType ?? (match.isSeries ? "Series" : "Individual"));
    if (isSeriesCheckbox) isSeriesCheckbox.checked = Boolean(match.isSeries);

    if (seriesNameEl) seriesNameEl.value = match.seriesName ?? "";
    if (totalMatchesEl) totalMatchesEl.value = match.totalMatches ?? "";
    if (seriesMatchNumberEl) seriesMatchNumberEl.value = match.matchNumber ?? match.seriesMatchNumber ?? "";
    if (seriesLeaderEl) seriesLeaderEl.value = match.seriesLeader ?? "";
    if (seriesScoreOurEl) seriesScoreOurEl.value = (match.seriesScore && match.seriesScore.ourTeam) ?? "";
    if (seriesScoreOppEl) seriesScoreOppEl.value = (match.seriesScore && match.seriesScore.opponent) ?? "";
    if (venueEl) venueEl.value = match.venue ?? "";
    if (oversEl) oversEl.value = match.overs ?? "";
    if (isHomeMatchEl) isHomeMatchEl.checked = Boolean(match.isHomeMatch);
    if (statusEl) statusEl.value = match.status ?? "upcoming";

    // set date input (try datetime-local or date)
    const d = match.date ?? match.matchDate ?? match.createdAt ?? "";
    if (d) {
      try {
        const dt = new Date(d);
        // if user's input is datetime-local in HTML, set to yyyy-mm-ddThh:mm (slice 0-16)
        if (dateEl && dateEl.type === "datetime-local") {
          dateEl.value = dt.toISOString().slice(0, 16);
        } else if (dateEl) {
          // date-only input
          dateEl.value = dt.toISOString().slice(0, 10);
        }
      } catch (e) {
        if (dateEl) dateEl.value = String(d).split("T")[0];
      }
    }

    // toggle series fields state
    if (typeToggleExists()) (matchTypeEl || isSeriesCheckbox).dispatchEvent(new Event("change"));
    // scroll to form (optional)
    opponentEl?.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (err) {
    console.error("Error in editMatch:", err);
    alert("Error fetching match details (see console).");
  }
}

// Delete
async function deleteMatch(id) {
  if (!confirm("Delete this match? This action cannot be undone.")) return;
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const txt = await res.text();
      console.error("Delete failed:", txt);
      alert("Delete failed. See console.");
      return;
    }
    await safeJson(res);
    await loadMatches();
  } catch (err) {
    console.error("Error deleting match:", err);
    alert("Error deleting match (see console).");
  }
}

// escape helper
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
