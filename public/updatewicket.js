import { AppConstants } from "./appconstants.js";

const loader = document.getElementById("loader");
const playerSelect = document.getElementById("playerSelect");
const wicketForm = document.getElementById("wicketForm");

function showLoader() {
  loader.classList.remove("d-none");
}
function hideLoader() {
  loader.classList.add("d-none");
}
function showAlert(icon, text) {
  Swal.fire({
    position: "center",
    icon,
    title: text,
    showConfirmButton: false,
    timer: 1500,
  });
}

// 1) Load players into dropdown
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

// 2) Handle form submission
wicketForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const playerId = playerSelect.value;
  const wicket = document.getElementById("wicketInput").value.trim();

  if (!playerId || !wicket) {
    return showAlert("warning", "Please select a player and enter a wicket");
  }

  // Confirm before pushing
  const confirmResult = await Swal.fire({
    title: "Add this wicket?",
    html: `<p>Player: <strong>${playerSelect.selectedOptions[0].text}</strong></p>
           <p>Wicket entry: <strong>${wicket}</strong></p>`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, add it",
    cancelButtonText: "Cancel",
  });

  if (!confirmResult.isConfirmed) return;

  // Send to server
  showLoader();
  try {
    const res = await fetch(
      `${AppConstants.baseUrl}/api/update/${playerId}/wicket`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wicket }),
      }
    );
    if (!res.ok) throw new Error("Update failed");
    showAlert("success", "Wicket added successfully");
    wicketForm.reset();
  } catch (err) {
    showAlert("error", "Error adding wicket");
  } finally {
    hideLoader();
  }
});

// Initialize
fetchPlayers();
