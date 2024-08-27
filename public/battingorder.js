import { AppConstants } from "./appconstants.js";

// Define the variables for holding data
let initialBattingOrder = [];
let playersLastFour = [];
let newBattingOrder = [];
let battingOrderWithScores = [];

// Fetch and display the initial batting order
async function fetchInitialBattingOrder() {
  try {
    const response = await fetch(`${AppConstants.baseUrl}/api/batting-order`);
    validateResponse(response);

    const data = await response.json();

    if (data.order) {
      initialBattingOrder = data.order;
      updateBattingOrderList(initialBattingOrder, "battingOrderList");
      await fetchPlayersLastFour();
    } else {
      console.error("Order not found in response");
    }
  } catch (error) {
    handleError(error);
  }
}

// Function to fetch players' last four scores
async function fetchPlayersLastFour() {
  try {
    const response = await fetch(`${AppConstants.baseUrl}/api/players`);
    validateResponse(response);

    const data = await response.json();
    playersLastFour = data.map((player) => ({
      name: player.name,
      lastfour: player.scores.lastfour.map((score) => parseFloat(score) || 0),
    }));

    calculateNewBattingOrder();
  } catch (error) {
    handleError(error);
  }
}

// Function to validate response
function validateResponse(response) {
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
}

// Function to handle errors
function handleError(error) {
  console.error("There was a problem with the fetch operation:", error);
  Swal.fire({
    icon: "error",
    title: "Oops...",
    text: "Something went wrong!",
  });
}

// Function to update the batting order list in the HTML
function updateBattingOrderList(order, elementId) {
  const listElement = document.getElementById(elementId);
  listElement.innerHTML = ""; // Clear any existing content

  order.forEach((player) => {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.textContent = player;
    row.appendChild(cell);
    listElement.appendChild(row);
  });
}

// Function to calculate the new batting order
function calculateNewBattingOrder() {
  if (initialBattingOrder.length === 0 || playersLastFour.length === 0) {
    console.error(
      "Initial batting order or players' last four scores are missing."
    );
    return;
  }

  const sortedInitialOrder = sortPlayersByLastFour(initialBattingOrder);
  const { topFive, lastThreeFromInitial } =
    getTopAndLastPlayers(sortedInitialOrder);
  const remainingPlayers = getRemainingPlayers(
    sortedInitialOrder,
    topFive,
    lastThreeFromInitial
  );

  newBattingOrder = [...topFive, ...lastThreeFromInitial, ...remainingPlayers];

  battingOrderWithScores = calculateScores(newBattingOrder);

  updateBattingOrderList(newBattingOrder, "newBattingOrderList");
}

// Helper function to sort players based on last four scores
function sortPlayersByLastFour(order) {
  return [...order].sort((a, b) => {
    const sumA = getLastFourSum(a);
    const sumB = getLastFourSum(b);
    return sumB - sumA;
  });
}

// Helper function to get the top five and last three players
function getTopAndLastPlayers(sortedOrder) {
  const topFive = sortedOrder.slice(0, 5);
  const lastThreeFromInitial = initialBattingOrder
    .slice(8, 11)
    .filter((player) => !topFive.includes(player));

  const remainingPlayers = getRemainingPlayers(
    sortedOrder,
    topFive,
    lastThreeFromInitial
  );
  while (lastThreeFromInitial.length < 3 && remainingPlayers.length > 0) {
    lastThreeFromInitial.push(remainingPlayers.shift());
  }

  return { topFive, lastThreeFromInitial };
}

// Helper function to get remaining players
function getRemainingPlayers(order, topFive, lastThree) {
  return order.filter(
    (player) => !topFive.includes(player) && !lastThree.includes(player)
  );
}

// Helper function to calculate scores
function calculateScores(order) {
  return order.map((player) => {
    const playerData = playersLastFour.find((p) => p.name === player);
    const totalScore = playerData
      ? playerData.lastfour.reduce((acc, score) => acc + score, 0)
      : 0;
    return {
      name: player,
      totalScore: totalScore,
    };
  });
}

// Helper function to get last four score sum
function getLastFourSum(playerName) {
  const lastfour =
    playersLastFour.find((player) => player.name === playerName)?.lastfour ||
    [];
  return lastfour.reduce((acc, score) => acc + score, 0);
}

// Function to check if all players have exactly 4 scores
function areAllPlayersScoresComplete() {
  return (
    playersLastFour.length === 11 &&
    playersLastFour.every((player) => player.lastfour.length === 4)
  );
}

// Function to post the new batting order
async function postNewBattingOrder() {
  if (!areAllPlayersScoresComplete()) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Not all players have 4 scores in their last four matches.",
    });
    return;
  }

  Swal.fire({
    title: "Posting Batting Order...",
    text: "Please wait while the new batting order is being posted.",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

  try {
    const response = await fetch(`${AppConstants.baseUrl}/api/batting-order`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reqData: { order: newBattingOrder } }),
    });

    validateResponse(response);

    setTimeout(() => {
      Swal.fire({
        icon: "success",
        title: "Success",
        text: "The new batting order has been posted successfully!",
      });
    }, 2000);
  } catch (error) {
    handleError(error);
  }
}

// Event listener for the button click
document.getElementById("postbattingorder").addEventListener("click", () => {
  postNewBattingOrder();
});

// Initial fetch when the page loads
fetchInitialBattingOrder();
