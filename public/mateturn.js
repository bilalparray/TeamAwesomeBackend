import { AppConstants } from "./appconstants.js";

const API = AppConstants.baseUrl;
const loader = document.getElementById("loader");

let allPlayers = [];
let mateGroups = [];
let playerGroupMap = new Map();

const groupsContainer = document.getElementById("groupsContainer");
const saveGroupsBtn = document.getElementById("saveGroupsBtn");
const mateTurnForm = document.getElementById("mateTurnForm");
const turnIdField = document.getElementById("turnId");
const turnDateEl = document.getElementById("turnDate");
const turnGroupEl = document.getElementById("turnGroup");
const turnNotesEl = document.getElementById("turnNotes");
const player1Select = document.getElementById("player1Select");
const player2Select = document.getElementById("player2Select");
const player1Label = document.getElementById("player1Label");
const player2Label = document.getElementById("player2Label");
const player2Wrap = document.getElementById("player2Wrap");
const suggestionBanner = document.getElementById("suggestionBanner");
const turnTableBody = document.querySelector("#turnTable tbody");
const resetTurnBtn = document.getElementById("resetTurnBtn");

document.addEventListener("DOMContentLoaded", () => {
  wireUp();
  bootstrapPage();
});

function showLoader() {
  loader?.classList.remove("d-none");
}

function hideLoader() {
  loader?.classList.add("d-none");
}

function showAlert(icon, msg) {
  Swal.fire({
    position: "center",
    icon,
    title: msg,
    showConfirmButton: false,
    timer: 1800,
  });
}

async function bootstrapPage() {
  showLoader();
  try {
    await loadPlayers();
    await loadGroups();
    renderGroupSetup();
    rebuildPlayerGroupMap();
    await loadSuggestion();
    await loadTurns();
    onGroupChange();
  } catch (err) {
    console.error(err);
    showAlert("error", err.message || "Failed to load page data");
  } finally {
    hideLoader();
  }
}

function wireUp() {
  saveGroupsBtn?.addEventListener("click", saveGroups);
  mateTurnForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveTurn();
  });
  resetTurnBtn?.addEventListener("click", resetTurnForm);
  turnGroupEl?.addEventListener("change", onGroupChange);
  player2Select?.addEventListener("change", onHelperChange);
}

async function loadPlayers() {
  const res = await fetch(`${API}/api/players`);
  if (!res.ok) throw new Error("Failed to load players");
  allPlayers = await res.json();
  allPlayers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

async function loadGroups() {
  const res = await fetch(`${API}/api/mate-groups`);
  if (!res.ok) throw new Error("Failed to load mate groups");
  const data = await res.json();
  mateGroups = data.groups || [];
  mateGroups.sort((a, b) => a.groupNumber - b.groupNumber);
}

function rebuildPlayerGroupMap() {
  playerGroupMap = new Map();
  for (const g of mateGroups) {
    for (const id of g.playerIds || []) {
      playerGroupMap.set(String(id), g.groupNumber);
    }
  }
}

function playerOptions(selectedIds = []) {
  const selected = new Set(selectedIds.map(String));
  return allPlayers
    .map((p) => {
      const id = String(p._id);
      const sel = selected.has(id) ? " selected" : "";
      return `<option value="${id}"${sel}>${escapeHtml(p.name || "Unknown")}</option>`;
    })
    .join("");
}

function renderGroupSetup() {
  if (!groupsContainer) return;

  groupsContainer.innerHTML = "";
  for (let n = 1; n <= 6; n++) {
    const existing = mateGroups.find((g) => g.groupNumber === n) || {
      groupNumber: n,
      playerIds: [],
    };
    const count = n === 6 ? 1 : 2;
    const ids = (existing.playerIds || []).map(String);

    let selectsHtml = "";
    for (let i = 0; i < count; i++) {
      const selectedId = ids[i] || "";
      selectsHtml += `
        <div class="col-md-${n === 6 ? 12 : 6} mb-2">
          <select class="form-select group-player-select" data-group="${n}" data-slot="${i}">
            <option value="">Select player</option>
            ${allPlayers
              .map((p) => {
                const id = String(p._id);
                const sel = id === selectedId ? " selected" : "";
                return `<option value="${id}"${sel}>${escapeHtml(p.name || "")}</option>`;
              })
              .join("")}
          </select>
        </div>`;
    }

    groupsContainer.innerHTML += `
      <div class="group-row">
        <div class="fw-semibold mb-2">Group ${n}${n === 6 ? " (solo)" : ""}</div>
        <div class="row">${selectsHtml}</div>
      </div>`;
  }
}

async function saveGroups() {
  const selects = groupsContainer.querySelectorAll(".group-player-select");
  const groupsByNumber = {};

  for (const sel of selects) {
    const gn = Number(sel.dataset.group);
    if (!groupsByNumber[gn]) groupsByNumber[gn] = [];
    groupsByNumber[gn].push(sel.value);
  }

  const groups = [];
  for (let n = 1; n <= 6; n++) {
    const playerIds = (groupsByNumber[n] || []).filter(Boolean);
    const expected = n === 6 ? 1 : 2;
    if (playerIds.length !== expected) {
      showAlert(
        "warning",
        `Group ${n} needs exactly ${expected} player(s) selected`
      );
      return;
    }
    groups.push({ groupNumber: n, playerIds });
  }

  showLoader();
  try {
    const res = await fetch(`${API}/api/mate-groups`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groups }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Save failed");

    mateGroups = data.groups || groups;
    rebuildPlayerGroupMap();
    showAlert("success", "Groups saved");
    await loadSuggestion();
    onGroupChange();
  } catch (err) {
    showAlert("error", err.message);
  } finally {
    hideLoader();
  }
}

async function loadSuggestion() {
  const res = await fetch(`${API}/api/mate-turns/suggested`);
  if (!res.ok) {
    suggestionBanner.classList.add("d-none");
    return;
  }
  const data = await res.json();
  const dateStr = formatDateInput(data.suggestedDate);
  if (!turnIdField.value) {
    turnDateEl.value = dateStr;
    turnGroupEl.value = String(data.suggestedGroupNumber);
  }

  const names = (data.group?.playerNames || []).join(" & ") || "—";
  suggestionBanner.classList.remove("d-none");
  suggestionBanner.innerHTML =
    data.suggestedGroupNumber === 6
      ? `<strong>Suggested:</strong> Group 6 — <em>${escapeHtml(names)}</em> (solo) + pick a helper from Groups 1–5`
      : `<strong>Suggested:</strong> Group ${data.suggestedGroupNumber} — ${escapeHtml(names)}`;
}

function onGroupChange() {
  const gn = Number(turnGroupEl.value);
  if (!gn) return;

  const group = mateGroups.find((g) => g.groupNumber === gn);
  const groupIds = (group?.playerIds || []).map(String);

  if (gn === 6) {
    player1Label.textContent = "Solo Player (Group 6)";
    player2Label.textContent = "Helper (from Groups 1–5)";
    player1Select.innerHTML =
      `<option value="">Select solo player</option>` +
      groupIds
        .map((id) => {
          const p = allPlayers.find((x) => String(x._id) === id);
          return p
            ? `<option value="${id}">${escapeHtml(p.name)}</option>`
            : "";
        })
        .join("");
    player1Select.value = groupIds[0] || "";
    player1Select.disabled = groupIds.length === 1;

    const helperOptions = allPlayers
      .filter((p) => {
        const pg = playerGroupMap.get(String(p._id));
        return pg != null && pg >= 1 && pg <= 5;
      })
      .map(
        (p) =>
          `<option value="${p._id}">${escapeHtml(p.name)} (Group ${playerGroupMap.get(String(p._id))})</option>`
      )
      .join("");
    player2Select.innerHTML =
      `<option value="">Select helper</option>` + helperOptions;
    player2Select.disabled = false;
  } else {
    player1Label.textContent = "Player 1";
    player2Label.textContent = "Player 2";
    player1Select.disabled = false;
    player2Select.disabled = false;

    player1Select.innerHTML =
      `<option value="">Select player</option>` +
      groupIds
        .map((id) => {
          const p = allPlayers.find((x) => String(x._id) === id);
          return p
            ? `<option value="${id}">${escapeHtml(p.name)}</option>`
            : "";
        })
        .join("");
    player2Select.innerHTML =
      `<option value="">Select player</option>` +
      groupIds
        .map((id) => {
          const p = allPlayers.find((x) => String(x._id) === id);
          return p
            ? `<option value="${id}">${escapeHtml(p.name)}</option>`
            : "";
        })
        .join("");

    if (groupIds[0]) player1Select.value = groupIds[0];
    if (groupIds[1]) player2Select.value = groupIds[1];
  }
}

function onHelperChange() {
  // read-only; fromGroupNumber resolved on save from playerGroupMap
}

function buildPlayersPayload(groupNumber) {
  const p1Id = player1Select.value;
  const p2Id = player2Select.value;
  const p1 = allPlayers.find((p) => String(p._id) === p1Id);
  const p2 = allPlayers.find((p) => String(p._id) === p2Id);

  if (!p1 || !p2) {
    throw new Error("Select both players");
  }

  if (groupNumber === 6) {
    return [
      { playerId: p1Id, name: p1.name, role: "solo" },
      {
        playerId: p2Id,
        name: p2.name,
        role: "helper",
        fromGroupNumber: playerGroupMap.get(String(p2Id)),
      },
    ];
  }

  return [
    { playerId: p1Id, name: p1.name, role: "regular" },
    { playerId: p2Id, name: p2.name, role: "regular" },
  ];
}

async function saveTurn() {
  const groupNumber = Number(turnGroupEl.value);
  if (!groupNumber) {
    showAlert("warning", "Select a group");
    return;
  }

  let players;
  try {
    players = buildPlayersPayload(groupNumber);
  } catch (err) {
    showAlert("warning", err.message);
    return;
  }

  if (groupNumber === 6 && !players[1].fromGroupNumber) {
    showAlert("warning", "Helper must be from Groups 1–5");
    return;
  }

  const body = {
    date: turnDateEl.value,
    groupNumber,
    players,
    notes: turnNotesEl.value.trim(),
  };

  const id = turnIdField.value;
  const url = id ? `${API}/api/mate-turns/${id}` : `${API}/api/mate-turns`;
  const method = id ? "PUT" : "POST";

  showLoader();
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Save failed");

    showAlert("success", id ? "Mate turn updated" : "Mate turn saved");
    resetTurnForm();
    await loadSuggestion();
    await loadTurns();
  } catch (err) {
    showAlert("error", err.message);
  } finally {
    hideLoader();
  }
}

function resetTurnForm() {
  mateTurnForm?.reset();
  turnIdField.value = "";
  document.getElementById("saveTurnBtn").textContent = "Save Mate Turn";
  loadSuggestion();
  onGroupChange();
}

async function loadTurns() {
  const res = await fetch(`${API}/api/mate-turns`);
  if (!res.ok) throw new Error("Failed to load mate turns");
  const turns = await res.json();
  renderTurns(turns);
}

function formatPlayersCell(turn) {
  const players = turn.players || [];
  if (turn.groupNumber === 6) {
    const solo = players.find((p) => p.role === "solo");
    const helper = players.find((p) => p.role === "helper");
    const soloName = solo?.name || "—";
    const helperName = helper?.name || "—";
    const helperGroup = helper?.fromGroupNumber
      ? ` (Group ${helper.fromGroupNumber})`
      : "";
    return `${escapeHtml(soloName)} <span class="text-muted">+ helped by</span> ${escapeHtml(helperName)}${escapeHtml(helperGroup)}`;
  }
  return players.map((p) => escapeHtml(p.name)).join(" & ");
}

function renderTurns(turns) {
  if (!turnTableBody) return;
  turnTableBody.innerHTML = "";

  if (!turns.length) {
    turnTableBody.innerHTML =
      '<tr><td colspan="5" class="text-center text-muted">No mate turns recorded yet</td></tr>';
    return;
  }

  for (const turn of turns) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(formatDisplayDate(turn.date))}</td>
      <td>Group ${turn.groupNumber}</td>
      <td>${formatPlayersCell(turn)}</td>
      <td>${escapeHtml(turn.notes || "—")}</td>
      <td>
        <button type="button" class="btn btn-sm btn-outline-primary me-1 edit-turn" data-id="${turn._id}">Edit</button>
        <button type="button" class="btn btn-sm btn-outline-danger delete-turn" data-id="${turn._id}">Delete</button>
      </td>`;
    turnTableBody.appendChild(tr);
  }

  turnTableBody.querySelectorAll(".edit-turn").forEach((btn) => {
    btn.addEventListener("click", () => editTurn(btn.dataset.id, turns));
  });
  turnTableBody.querySelectorAll(".delete-turn").forEach((btn) => {
    btn.addEventListener("click", () => deleteTurn(btn.dataset.id));
  });
}

function editTurn(id, turns) {
  const turn = turns.find((t) => String(t._id) === String(id));
  if (!turn) return;

  turnIdField.value = turn._id;
  turnDateEl.value = formatDateInput(turn.date);
  turnGroupEl.value = String(turn.groupNumber);
  turnNotesEl.value = turn.notes || "";
  document.getElementById("saveTurnBtn").textContent = "Update Mate Turn";

  onGroupChange();

  const players = turn.players || [];
  if (turn.groupNumber === 6) {
    const solo = players.find((p) => p.role === "solo");
    const helper = players.find((p) => p.role === "helper");
    if (solo) player1Select.value = String(solo.playerId);
    if (helper) player2Select.value = String(helper.playerId);
  } else {
    if (players[0]) player1Select.value = String(players[0].playerId);
    if (players[1]) player2Select.value = String(players[1].playerId);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteTurn(id) {
  const confirm = await Swal.fire({
    title: "Delete this mate turn?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Delete",
    confirmButtonColor: "#dc3545",
  });
  if (!confirm.isConfirmed) return;

  showLoader();
  try {
    const res = await fetch(`${API}/api/mate-turns/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Delete failed");
    showAlert("success", "Deleted");
    await loadSuggestion();
    await loadTurns();
  } catch (err) {
    showAlert("error", err.message);
  } finally {
    hideLoader();
  }
}

function formatDateInput(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
