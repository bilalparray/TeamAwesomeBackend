import { AppConstants } from "./appconstants.js";

const loader = document.getElementById("loader");
function showLoader() {
  loader.classList.remove("d-none");
}

function hideLoader() {
  loader.classList.add("d-none");
}

document
  .getElementById("dataForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();
    showLoader();

    const formData = new FormData(this);

    // Convert image to base64
    const imageFile = formData.get("image");
    const base64Image = await convertToBase64(imageFile);

    const requestData = {
      name: formData.get("name"),
      role: formData.get("role"),
      born: formData.get("born"),
      birthplace: formData.get("birthplace"),
      battingstyle: formData.get("battingstyle"),
      bowlingstyle: formData.get("bowlingstyle"),
      debut: formData.get("debut"),
      image: base64Image,
    };

    try {
      const response = await fetch(`${AppConstants.baseUrl}/api/data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        Swal.fire({
          position: "center",
          icon: "error",
          title: "An error occurred! Please try again",
          showConfirmButton: false,
          timer: 1500,
        });
      } else {
        Swal.fire({
          position: "center",
          icon: "success",
          title: "Player saved successfully",
          showConfirmButton: false,
          timer: 1500,
        });
        this.reset();
      }
    } catch (error) {
      Swal.fire({
        position: "center",
        icon: "error",
        title: error,
        showConfirmButton: false,
        timer: 1500,
      });
    } finally {
      hideLoader();
    }
  });

function convertToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = (error) => reject(error);
  });
}
