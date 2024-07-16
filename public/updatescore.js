import { AppConstants } from "./appconstants.js";

const loader = document.getElementById("loader");

function showLoader() {
  loader.classList.remove("d-none");
}

function hideLoader() {
  loader.classList.add("d-none");
}

// Function to fetch players and populate dropdown
async function fetchPlayers() {
  showLoader();
  try {
    const response = await fetch(`${AppConstants.baseUrl}/api/players`);
    if (!response.ok) {
      throw new Error("Failed to fetch players");
    }
    const players = await response.json();

    const playerSelect = document.getElementById("playerSelect");
    players.forEach((player) => {
      const option = document.createElement("option");
      option.value = player._id;
      option.textContent = player.name;
      playerSelect.appendChild(option);
    });
  } catch (error) {
    showAlert("error", "An error occurred while fetching players");
  } finally {
    hideLoader();
  }
}

// Function to fetch player details and fill form when player selected
async function fetchPlayerDetails(playerId) {
  showLoader();
  try {
    const response = await fetch(
      `${AppConstants.baseUrl}/api/data/${playerId}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch player details: ${response.status}`);
    }
    const playerData = await response.json();
    // Populate form fields with playerData if needed
  } catch (error) {
    showAlert("error", "An error occurred while fetching player details");
  } finally {
    hideLoader();
  }
}

// Add event listener for dropdown change
document.getElementById("playerSelect").addEventListener("change", function () {
  const selectedPlayerId = this.value;
  fetchPlayerDetails(selectedPlayerId);
});

// Add event listener for form submission
document
  .getElementById("updateForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const formData = new FormData(this);
    const playerId = formData.get("playerId");

    const requestData = {
      runs: formData.get("runs").split(","),
      balls: formData.get("balls").split(","),
      wickets: formData.get("wickets").split(","),
      lastfour: formData.get("lastfour").split(","),
      innings: formData.get("innings").split(","),
    };

    // Display confirmation dialog
    const confirmResult = await Swal.fire({
      title: "Confirm Update",
      html: `
        <p>You are about to update the following data:</p>
        <ul>
          <li><strong>Runs:</strong> ${requestData.runs}</li>
          <li><strong>Balls:</strong> ${requestData.balls}</li>
          <li><strong>Wickets:</strong> ${requestData.wickets}</li>
          <li><strong>Last Four:</strong> ${requestData.lastfour}</li>
          <li><strong>Innings Runs:</strong> ${requestData.innings}</li>
        </ul>
        <p>Are you sure you want to proceed?</p>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Update",
      cancelButtonText: "Cancel",
    });

    if (confirmResult.isConfirmed) {
      showLoader();
      try {
        const response = await fetch(
          `${AppConstants.baseUrl}/api/data/${playerId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update data");
        } else {
          showAlert("success", "Data updated successfully!");
          this.reset();
        }
      } catch (error) {
        showAlert("error", "An error occurred while updating data");
      } finally {
        hideLoader();
      }
    }
  });

// Function to show SweetAlert
function showAlert(icon, message) {
  Swal.fire({
    position: "center",
    icon: icon,
    title: message,
    showConfirmButton: false,
    timer: 1500,
  });
}

// Fetch players when page loads
fetchPlayers();
