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
    // Populate form fields with playerData
    document.getElementById("name").value = playerData.name;
    document.getElementById("role").value = playerData.role;
    document.getElementById("born").value = playerData.born;
    document.getElementById("birthplace").value = playerData.birthplace;
    document.getElementById("battingstyle").value = playerData.battingstyle;
    document.getElementById("bowlingstyle").value = playerData.bowlingstyle;
    document.getElementById("debut").value = playerData.debut;
    document.getElementById("image").value = playerData.image;
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

    // const imageFile = formData.get("image");
    // const base64Image = imageFile ? await convertToBase64(imageFile) : null;

    const requestData = {
      name: formData.get("name"),
      role: formData.get("role"),
      born: formData.get("born"),
      birthplace: formData.get("birthplace"),
      battingstyle: formData.get("battingstyle"),
      bowlingstyle: formData.get("bowlingstyle"),
      debut: formData.get("debut"),
      image: formData.get("image"),
    };

    // Display confirmation dialog
    const confirmResult = await Swal.fire({
      title: "Confirm Update",
      html: `
        <p>You are about to update the following data:</p>
        <ul>
          <li><strong>Name:</strong> ${requestData.name}</li>
          <li><strong>Role:</strong> ${requestData.role}</li>
          <li><strong>Born:</strong> ${requestData.born}</li>
          <li><strong>Birthplace:</strong> ${requestData.birthplace}</li>
          <li><strong>Batting Style:</strong> ${requestData.battingstyle}</li>
          <li><strong>Bowling Style:</strong> ${requestData.bowlingstyle}</li>
          <li><strong>Debut:</strong> ${requestData.debut}</li>
          <li><strong>Debut:</strong> ${requestData.image}</li>
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
          `${AppConstants.baseUrl}/api/update/${playerId}`,
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

// Function to convert image file to base64
// function convertToBase64(file) {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.onload = () => resolve(reader.result);
//     reader.onerror = (error) => reject(error);
//     reader.readAsDataURL(file);
//   });
// }

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
