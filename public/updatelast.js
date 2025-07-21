import { AppConstants } from "./appconstants.js";

const loader = document.getElementById("loader");
const playerSelect = document.getElementById("playerSelect");
const lastForm = document.getElementById("lastForm");

function showLoader() {
  loader.classList.remove("d-none");
}
function hideLoader() {
  loader.classList.add("d-none");
}
function showAlert(icon, msg) {
  Swal.fire({
    position: "center",
    icon,
    title: msg,
    showConfirmButton: false,
    timer: 1500,
  });
}

// Fetch all players on load
async function fetchPlayers() {
  showLoader();
  try {
    const res = await fetch(`${AppConstants.baseUrl}/api/players`);
    if (!res.ok) throw new Error("Failed to fetch players");
    const players = await res.json();
    players.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p._id;
      opt.textContent = p.name;
      playerSelect.appendChild(opt);
    });
  } catch (err) {
    showAlert("error", "Could not load players");
  } finally {
    hideLoader();
  }
}

// Handle form submit
lastForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const playerId = playerSelect.value;
  const runs = document.getElementById("runsInput").value.trim();
  const balls = document.getElementById("ballsInput").value.trim();
  const wickets = document.getElementById("wicketsInput").value.trim();

  if (!playerId) {
    return showAlert("warning", "Please select a player");
  }
  if (!runs && !balls && !wickets) {
    return showAlert("warning", "Enter at least one field to update");
  }

  // Build body with only provided fields
  const body = {};
  if (runs) body.runs = runs;
  if (balls) body.balls = balls;
  if (wickets) body.wickets = wickets;

  // Confirm
  const htmlLines = [];
  if (runs) htmlLines.push(`<li><strong>Runs:</strong> ${runs}</li>`);
  if (balls) htmlLines.push(`<li><strong>Balls:</strong> ${balls}</li>`);
  if (wickets) htmlLines.push(`<li><strong>Wickets:</strong> ${wickets}</li>`);

  const confirmResult = await Swal.fire({
    title: "Confirm Update",
    html: `<p>Updating last entries for <strong>${
      playerSelect.selectedOptions[0].text
    }</strong>:</p>
           <ul>${htmlLines.join("")}</ul>`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, update",
    cancelButtonText: "Cancel",
  });
  if (!confirmResult.isConfirmed) return;

  // Send request
  showLoader();
  try {
    const res = await fetch(
      `${AppConstants.baseUrl}/api/update/${playerId}/last`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) throw new Error("Update failed");
    const data = await res.json();
    showAlert("success", "Last entries updated!");
    lastForm.reset();
  } catch (err) {
    showAlert("error", "Error updating last entries");
  } finally {
    hideLoader();
  }
});

// Init
fetchPlayers();
