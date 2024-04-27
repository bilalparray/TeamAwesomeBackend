const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const { log } = require("console");
const app = express();
const port = 3000;
const MONGODB_URI =
  "mongodb+srv://sorieasal:sorieasal@nodejs.3k8ji4v.mongodb.net/TeamAwesomeBackend";

// MongoDB Connection
mongoose.connect(MONGODB_URI);

// Schema and Model
const playerSchema = new mongoose.Schema({
  name: String,
  role: String,
  born: Date,
  birthplace: String,
  battingstyle: String,
  bowlingstyle: String,
  debut: Date,
  image: String,
  runs: [String],
  balls: [String],
  wickets: [String],
  lastfour: [String],
  innings: [String],
  careerBalls: [String],
  careerRuns: [String],
  careerWickets: [String],
  careerInnings: [String],
});

const Player = mongoose.model("Player", playerSchema);

// Middleware
app.use(bodyParser.json());
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/update", (req, res) => {
  res.sendFile(path.join(__dirname, "updatescore.html"));
});

// Routes

// Get data for a player by ID
app.get("/api/data/:playerId", async (req, res) => {
  try {
    const playerId = req.params.playerId;
    const player = await Player.findById(playerId);
    if (!player) {
      res.status(404).json({ message: "Player not found" });
      return;
    }
    res.status(200).json(player);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Add a route to fetch all player names
app.get("/api/players", async (req, res) => {
  try {
    const players = await Player.find(
      {},
      {
        _id: 1,
        name: 1,
        birthplace: 1,
        born: 1,
        role: 1,
        battingstyle: 1,
        bowlingstyle: 1,
        debut: 1,
        image: 1,
        runs: 1,
        balls: 1,
        wickets: 1,
        lastfour: 1,
        innings: 1,
        careerBalls: 1,
        careerRuns: 1,
        careerWickets: 1,
        careerInnings: 1,
      }
    );
    res.status(200).json(players);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Modify the route to handle updates by ID
app.put("/api/data/:playerId", async (req, res) => {
  try {
    const playerId = req.params.playerId;
    const { runs, balls, wickets, lastfour, innings } = req.body;

    let player = await Player.findById(playerId);

    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    // Append new elements to existing arrays
    if (runs) player.runs.push(...runs);
    if (balls) player.balls.push(...balls);
    if (wickets) player.wickets.push(...wickets);
    if (lastfour) player.lastfour.push(...lastfour);
    if (innings) player.innings.push(...innings);
    if (runs) player.careerRuns.push(...runs);
    if (balls) player.careerBalls.push(...balls);
    if (wickets) player.careerWickets.push(...wickets);
    if (innings) player.careerInnings.push(...innings);

    await player.save();

    res.status(200).json({ message: "Data updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/data", async (req, res) => {
  try {
    const {
      name,
      role,
      born,
      birthplace,
      battingstyle,
      bowlingstyle,
      debut,
      image,
    } = req.body;
    // Create new player with empty arrays for statistics
    const newPlayer = new Player({
      name: name,
      role: role,
      born: born,
      birthplace: birthplace,
      battingstyle: battingstyle,
      bowlingstyle: bowlingstyle,
      debut: debut,
      image: image,
      runs: [],
      balls: [],
      wickets: [],
      lastfour: [],
      innings: [],
      careerBalls: [],
      careerRuns: [],
      careerWickets: [],
      careerInnings: [],
    });

    // Save the new player
    await newPlayer.save();

    res.status(200).json({ message: "Player added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
app.get("/api/data/:playerId", (req, res) => {
  Player.find({}, (err, players) => {
    if (err) {
      res.send(err);
    }
    res.json(players);
  });
});
// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
