import { AppConstants } from "./appconstants.js";

const loader = document.getElementById("loader");
const matchForm = document.getElementById("matchForm");
const isSeriesSelect = document.getElementById("isSeries");

function showLoader() {
  loader.classList.remove("d-none");
}
function hideLoader() {
  loader.classList.add("d-none");
}
function showAlert(icon, msg) {
  Swal.fire({ icon, title: msg, timer: 1500, showConfirmButton: false });
}

// Toggle series fields
isSeriesSelect.addEventListener("change", () => {
  const show = isSeriesSelect.value === "true";
  document.querySelectorAll(".series-field").forEach(el => {
    el.classList.toggle("d-none", !show);
  });
});

// Handle form submit
matchForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    opponent: document.getElementById("opponentInput").value,
    isSeries: isSeriesSelect.value === "true",
    date: document.getElementById("dateInput").value
  };

  if (body.isSeries) {
    body.seriesName = document.getElementById("seriesName").value;
    body.totalMatches = Number(document.getElementById("totalMatches").value);
    body.matchNumber = Number(document.getElementById("matchNumber").value);
    body.seriesLeader = document.getElementById("seriesLeader").value;
  }

  showLoader();
  try {
    const res = await fetch(`${AppConstants.baseUrl}/api/nextmatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("Failed to add match");
    showAlert("success", "Match added successfully!");
    matchForm.reset();
  } catch (err) {
    showAlert("error", err.message);
  } finally {
    hideLoader();
  }
});
