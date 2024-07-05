const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const sharp = require("sharp");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config({
  path: path.join(__dirname, "process.env"),
});
const cors = require("cors");

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI);

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
  scores: {
    runs: [String],
    balls: [String],
    wickets: [String],
    lastfour: [String],
    innings: [String],
    career: {
      balls: [String],
      runs: [String],
      wickets: [String],
      innings: [String],
    },
  },
});

const Player = mongoose.model("Player", playerSchema);
// Enable CORS
app.use(cors());

// Middleware
app.use(bodyParser.json());
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/update", (req, res) => {
  res.sendFile(path.join(__dirname, "updatescore.html"));
});
app.get("/updateplayer", (req, res) => {
  res.sendFile(path.join(__dirname, "updateplayer.html"));
});

// Routes

// Get data for a player by ID
// app.get("/api/data/:playerId", async (req, res) => {
//   try {
//     const playerId = req.params.playerId;
//     const player = await Player.findById(playerId);
//     if (!player) {
//       res.status(404).json({ message: "Player not found" });
//       return;
//     }
//     res.status(200).json(player);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });
app.get("/api/data/:playerId", async (req, res) => {
  try {
    const playerId = req.params.playerId;
    const player = await Player.findById(playerId).lean(); // Use .lean() for plain JavaScript object

    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    // Compress image if available
    if (player.image) {
      const compressedImage = await compressImage(
        Buffer.from(player.image, "base64")
      );
      player.image = compressedImage || null; // Update player object with compressed image
    } else {
      player.image = null; // Handle case where image is null or empty
    }

    res.status(200).json(player);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
// Add a route to fetch all player names
// app.get("/api/players", async (req, res) => {
//   try {
//     const players = await Player.find(
//       {},
//       {
//         _id: 1,
//         name: 1,
//         birthplace: 1,
//         born: 1,
//         role: 1,
//         battingstyle: 1,
//         bowlingstyle: 1,
//         debut: 1,
//         image: 1,
//         scores: 1,
//       }
//     );
//     res.status(200).json(players);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });
const compressImage = async (imageBuffer) => {
  try {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error("Empty or undefined image buffer");
    }

    const resizedImageBuffer = await sharp(imageBuffer)
      .resize({ height: 300, width: 300 })
      .toBuffer();

    const base64Image = resizedImageBuffer.toString("base64");
    return base64Image;
  } catch (error) {
    console.error("Error compressing image:", error.message);
    return null; // Return null if there's an error with image processing
  }
};
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
        scores: 1,
      }
    );

    // Map players and compress image if available
    const playersWithCompressedImages = await Promise.all(
      players.map(async (player) => {
        if (player.image) {
          const compressedImage = await compressImage(
            Buffer.from(player.image, "base64")
          );
          return { ...player.toObject(), image: compressedImage };
        } else {
          return { ...player.toObject(), image: null }; // Handle case where image is null or empty
        }
      })
    );

    res.status(200).json(playersWithCompressedImages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//update player score
app.put("/api/data/:playerId", async (req, res) => {
  try {
    const playerId = req.params.playerId;
    const { runs, balls, wickets, lastfour, innings } = req.body;

    let player = await Player.findById(playerId);

    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    // Append new elements to existing arrays
    if (runs) player.scores.runs.push(...runs);
    if (balls) player.scores.balls.push(...balls);
    if (wickets) player.scores.wickets.push(...wickets);
    if (lastfour) player.scores.lastfour.push(...lastfour);
    if (innings) player.scores.innings.push(...innings);
    if (runs) player.scores.career.runs.push(...runs);
    if (balls) player.scores.career.balls.push(...balls);
    if (wickets) player.scores.career.wickets.push(...wickets);
    if (innings) player.scores.career.innings.push(...innings);

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
      scores: {
        runs: [],
        balls: [],
        wickets: [],
        lastfour: [],
        innings: [],
        career: {
          balls: [],
          runs: [],
          wickets: [],
          innings: [],
        },
      },
    });

    // Save the new player
    await newPlayer.save();

    res.status(200).json({ message: "Player added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

///update player details
app.put("/api/update/:playerId", async (req, res) => {
  try {
    const playerId = req.params.playerId;
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

    let player = await Player.findById(playerId);

    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    // Update specific fields
    if (name) player.name = name;
    if (role) player.role = role;
    if (born) player.born = born;
    if (birthplace) player.birthplace = birthplace;
    if (battingstyle) player.battingstyle = battingstyle;
    if (bowlingstyle) player.bowlingstyle = bowlingstyle;
    if (debut) player.debut = debut;
    if (image) player.image = image;

    await player.save();

    res.status(200).json({ message: "Player details updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
