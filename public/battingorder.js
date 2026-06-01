import { AppConstants } from "./appconstants.js";

/** Top 7 by last-four sum, Zahid Bashir at 8, then 9–11 by form. Bump when logic changes. */
export const BATTING_ORDER_LOGIC_VERSION = 6;

// Define the variables for holding data
let initialBattingOrder = [];
let playersLastFour = [];
let newBattingOrder = [];
let battingOrderWithScores = [];

// Fetch and display the initial batting order
async function fetchInitialBattingOrder() {
  try {
    showLoader("Fetching Initial Batting Order...");
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
    hideLoader();
  } catch (error) {
    handleError(error);
  }
}

// Function to fetch players' last four scores
async function fetchPlayersLastFour() {
  try {
    showLoader("Fetching Players' Last Four Scores...");
    const response = await fetch(`${AppConstants.baseUrl}/api/players`);
    validateResponse(response);

    const data = await response.json();
    playersLastFour = data.map((player) => ({
      name: player.name,
      lastfour: player.scores.lastfour.map((score) => parseFloat(score) || 0),
    }));

    calculateNewBattingOrder();
    hideLoader();
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
  hideLoader();
  console.error("There was a problem with the fetch operation:", error);
  Swal.fire({
    icon: "error",
    title: "Oops...",
    text: "Something went wrong!",
  });
}

// Function to show the loader
function showLoader(message) {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
}

// Function to hide the loader
function hideLoader() {
  Swal.close();
}

// Function to update the batting order list in the HTML
function updateBattingOrderList(order, elementId) {
  const listElement = document.getElementById(elementId);
  listElement.innerHTML = "";

  const showScores = elementId === "newBattingOrderList" && battingOrderWithScores.length;

  order.forEach((player, index) => {
    const row = document.createElement("tr");
    if (showScores) {
      const pos = document.createElement("td");
      pos.className = "text-center";
      pos.textContent = String(index + 1);
      row.appendChild(pos);

      const nameCell = document.createElement("td");
      nameCell.textContent = player;
      row.appendChild(nameCell);

      const scoreCell = document.createElement("td");
      scoreCell.className = "text-end";
      const rowScore = battingOrderWithScores.find((r) => r.name === player);
      scoreCell.textContent = rowScore ? String(rowScore.totalScore) : "—";
      row.appendChild(scoreCell);
    } else {
      const cell = document.createElement("td");
      cell.textContent = player;
      row.appendChild(cell);
    }
    listElement.appendChild(row);
  });

  const verEl = document.getElementById("battingOrderLogicVersion");
  if (verEl && showScores) {
    verEl.textContent = `Logic v${BATTING_ORDER_LOGIC_VERSION}: positions 1–7 by form, 8 = Zahid Bashir, 9–11 by form`;
  }
}

const ZAHID_BASHIR_MATCH = /^zahid\s+bashir$/i;

function isZahidBashir(playerName) {
  return ZAHID_BASHIR_MATCH.test(
    String(playerName || "")
      .replace(/\([^)]*\)/g, "")
      .trim()
  );
}

function toDbPlayerName(playerName) {
  const row = findPlayerLastFour(playerName);
  return row ? row.name : playerName;
}

// Positions 1–7 and 9–11 by form; position 8 is always Zahid Bashir.
function calculateNewBattingOrder() {
  if (initialBattingOrder.length === 0 || playersLastFour.length === 0) {
    console.error(
      "Initial batting order or players' last four scores are missing."
    );
    return;
  }

  const zahidInSquad = initialBattingOrder.find((n) => isZahidBashir(n));
  const withoutZahid = initialBattingOrder.filter((n) => !isZahidBashir(n));
  const sorted = sortPlayersByLastFour(withoutZahid);

  if (!zahidInSquad) {
    newBattingOrder = sorted.map(toDbPlayerName);
  } else {
    const topSeven = sorted.slice(0, 7).map(toDbPlayerName);
    const fromNine = sorted.slice(7).map(toDbPlayerName);
    newBattingOrder = [
      ...topSeven,
      toDbPlayerName(zahidInSquad),
      ...fromNine,
    ];
  }

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

function findPlayerLastFour(playerName) {
  const key = String(playerName || "").toLowerCase().trim();
  return playersLastFour.find(
    (p) => String(p.name || "").toLowerCase().trim() === key
  );
}

// Helper function to calculate scores
function calculateScores(order) {
  return order.map((player) => {
    const playerData = findPlayerLastFour(player);
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
  const row = findPlayerLastFour(playerName);
  const lastfour = row ? row.lastfour : [];
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

  showLoader("Posting Batting Order...");
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
  } finally {
    hideLoader();
  }
}

// Event listener for the button click
document.getElementById("postbattingorder").addEventListener("click", () => {
  postNewBattingOrder();
});

// Initial fetch when the page loads
fetchInitialBattingOrder();
