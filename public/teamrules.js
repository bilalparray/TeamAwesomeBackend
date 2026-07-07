import { AppConstants } from "./appconstants.js";

const loader = document.getElementById("loader");
const rulesList = document.getElementById("rulesList");
const newRuleInput = document.getElementById("newRuleInput");
const btnAddRule = document.getElementById("btnAddRule");
const btnPublish = document.getElementById("btnPublish");
const updatedAtLabel = document.getElementById("updatedAtLabel");

let rules = [];

function showLoader() {
  loader.classList.remove("d-none");
}
function hideLoader() {
  loader.classList.add("d-none");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatUpdatedAt(iso) {
  if (!iso) return "";
  try {
    return `Updated ${new Date(iso).toLocaleString()}`;
  } catch {
    return "";
  }
}

function renderRules() {
  if (!rules.length) {
    rulesList.innerHTML = `<div class="text-muted">No rules yet. Add some above.</div>`;
    return;
  }

  rulesList.innerHTML = rules
    .map((text, index) => {
      return `
        <div class="rule-item d-flex align-items-start gap-3" data-index="${index}">
          <span class="rule-number">${index + 1}</span>
          <div class="flex-grow-1">${escapeHtml(text)}</div>
          <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-outline-secondary btn-move-up" data-index="${index}" title="Move up">↑</button>
            <button type="button" class="btn btn-outline-secondary btn-move-down" data-index="${index}" title="Move down">↓</button>
            <button type="button" class="btn btn-outline-primary btn-edit" data-index="${index}">Edit</button>
            <button type="button" class="btn btn-outline-danger btn-delete" data-index="${index}">Delete</button>
          </div>
        </div>
      `;
    })
    .join("");

  rulesList.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", () => editRule(Number(btn.dataset.index)));
  });
  rulesList.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteRule(Number(btn.dataset.index)));
  });
  rulesList.querySelectorAll(".btn-move-up").forEach((btn) => {
    btn.addEventListener("click", () => moveRule(Number(btn.dataset.index), -1));
  });
  rulesList.querySelectorAll(".btn-move-down").forEach((btn) => {
    btn.addEventListener("click", () => moveRule(Number(btn.dataset.index), 1));
  });
}

function moveRule(index, delta) {
  const next = index + delta;
  if (next < 0 || next >= rules.length) return;
  const copy = [...rules];
  const tmp = copy[index];
  copy[index] = copy[next];
  copy[next] = tmp;
  rules = copy;
  renderRules();
}

async function editRule(index) {
  const { value: text } = await Swal.fire({
    title: "Edit rule",
    input: "textarea",
    inputValue: rules[index],
    inputAttributes: { rows: 4 },
    showCancelButton: true,
    confirmButtonText: "Save",
  });
  if (text == null) return;
  const trimmed = String(text).trim();
  if (!trimmed) {
    Swal.fire({ icon: "warning", title: "Rule cannot be empty" });
    return;
  }
  rules[index] = trimmed;
  renderRules();
}

function deleteRule(index) {
  rules.splice(index, 1);
  renderRules();
}

function addRule() {
  const text = newRuleInput.value.trim();
  if (!text) {
    Swal.fire({ icon: "warning", title: "Enter rule text first" });
    return;
  }
  rules.push(text);
  newRuleInput.value = "";
  renderRules();
}

async function loadRules() {
  showLoader();
  try {
    const resp = await fetch(`${AppConstants.baseUrl}/api/team-rules`);
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      throw new Error((data && data.message) || "Failed to load rules");
    }
    rules = Array.isArray(data.rules) ? data.rules : [];
    updatedAtLabel.textContent = formatUpdatedAt(data.updatedAt);
    renderRules();
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Load failed",
      text: String(err.message || err),
    });
  } finally {
    hideLoader();
  }
}

async function publishRules() {
  const confirm = await Swal.fire({
    title: "Publish rules?",
    text: "Players will see these in the app.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Publish",
  });
  if (!confirm.isConfirmed) return;

  showLoader();
  try {
    const resp = await fetch(`${AppConstants.baseUrl}/api/team-rules`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      throw new Error((data && data.message) || "Publish failed");
    }
    rules = Array.isArray(data.rules) ? data.rules : rules;
    updatedAtLabel.textContent = formatUpdatedAt(data.updatedAt);
    renderRules();
    Swal.fire({
      icon: "success",
      title: "Published",
      timer: 1400,
      showConfirmButton: false,
    });
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Publish failed",
      text: String(err.message || err),
    });
  } finally {
    hideLoader();
  }
}

btnAddRule.addEventListener("click", addRule);
btnPublish.addEventListener("click", publishRules);
newRuleInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addRule();
});

loadRules();
