const express = require("express");
const router = express.Router();
const Player = require("../models/PlayerSchema");
const BattingOrder = require("../models/BattingOrderSchema");
const AppInfo = require("../models/AppInfoSchema");
const sharp = require("sharp");
const path = require("path");

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});
router.get("/update", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "updatescore.html"));
});
router.get("/updateplayer", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "updateplayer.html"));
});
router.get("/battingorder", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "battingorder.html"));
});
// Get data for a player by ID

router.get("/api/data/:playerId", async (req, res) => {
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
router.get("/api/players", async (req, res) => {
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

    // Calculate average runs for each player
    const playersWithAverages = players.map((player) => {
      const runsArray = player.scores.career.runs || []; // Ensure runs array exists
      const totalMatches = runsArray.length;
      const totalRuns = runsArray.reduce((acc, score) => {
        const runValue = parseInt(score, 10);
        return isNaN(runValue) ? acc : acc + runValue;
      }, 0);
      const averageRuns = totalMatches > 0 ? totalRuns / totalMatches : 0;

      return {
        player,
        averageRuns,
      };
    });

    // Sort players based on average runs in descending order
    playersWithAverages.sort((a, b) => b.averageRuns - a.averageRuns);

    // Assign rankings based on sorted position
    for (let i = 0; i < playersWithAverages.length; i++) {
      playersWithAverages[i].player.scores.career.ranking = (i + 1).toString();
      await playersWithAverages[i].player.save();
    }

    // Map players and compress image if available
    const playersWithCompressedImages = await Promise.all(
      playersWithAverages.map(async ({ player }) => {
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
router.put("/api/data/:playerId", async (req, res) => {
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

router.post("/api/data", async (req, res) => {
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
router.put("/api/update/:playerId", async (req, res) => {
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

// app update code below

// Endpoint to get the application update information
router.get("/api/updateapp", async (req, res) => {
  try {
    const appInfo = await AppInfo.findOne();
    if (appInfo) {
      res.json(appInfo);
    } else {
      res.status(404).send("No update information found.");
    }
  } catch (error) {
    res.status(500).send("Error retrieving update information.");
  }
});
// man of the match
router.get("/api/mom", async (req, res) => {
  try {
    const players = await Player.find({});

    let motmPlayer = null;
    let highestScore = 0;

    players.forEach((player) => {
      let playerScore = 0;

      // Get the last run entry if it exists
      const lastRun = player.scores.runs.slice(-1)[0];
      if (lastRun) {
        playerScore += parseInt(lastRun, 10);
      }

      // Get the last wicket entry if it exists
      const lastWicket = player.scores.wickets.slice(-1)[0];
      if (lastWicket) {
        playerScore += 10 * parseInt(lastWicket, 10);
      }

      if (playerScore > highestScore) {
        highestScore = playerScore;
        motmPlayer = player;
      }
    });

    if (!motmPlayer) {
      return res.status(404).json({ message: "No players found" });
    }

    // Compress image if it exists
    let compressedImage = null;
    if (motmPlayer.image) {
      compressedImage = await compressImage(
        Buffer.from(motmPlayer.image, "base64")
      );
    }

    // Create the response object with only the required fields
    const response = {
      _id: motmPlayer._id,
      name: motmPlayer.name,
      runs: motmPlayer.scores.runs.slice(-1)[0],
      wickets: motmPlayer.scores.wickets.slice(-1)[0],
      image: compressedImage || null,
    };

    // Create a descriptive paragraph
    let paragraph = `${motmPlayer.name} delivered an outstanding performance. Scoring ${response.runs} runs`;
    if (response.wickets > 0) {
      paragraph += ` and taking ${response.wickets} wickets`;
    }
    paragraph += ` in the most recent match, ${motmPlayer.name} proved to be a formidable player.`;

    // Include the paragraph in the response
    response.paragraph = paragraph;

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching MOTM:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Update player image route
router.put("/api/players/image", async (req, res) => {
  try {
    const { image, _id } = req.body.reqData || {}; // Using optional chaining and default object for safety

    if (!image || !_id) {
      return res.status(400).json({ message: "Invalid request format" });
    }

    const player = await Player.findById(_id);

    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    // Update only the image field
    player.image = image;

    // Save the updated player
    await player.save();

    res.json({ message: "Player image updated successfully", player });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Update batting order
router.put("/api/batting-order", async (req, res) => {
  try {
    const { reqData } = req.body;
    const { order } = reqData;

    if (!order || !Array.isArray(order)) {
      return res.status(400).json({
        message:
          "Invalid request format: 'order' should be an array of strings",
      });
    }

    // Create or update the batting order document (assuming there's only one document)
    let battingOrder = await BattingOrder.findOne();

    if (!battingOrder) {
      battingOrder = new BattingOrder({ order });
    } else {
      battingOrder.order = order;
    }

    await battingOrder.save();

    res.status(200).json({ message: "Batting order updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET current batting order
router.get("/api/batting-order", async (req, res) => {
  try {
    // Retrieve the batting order document (assuming there's only one document)
    const battingOrder = await BattingOrder.findOne();

    if (!battingOrder) {
      return res.status(404).json({ message: "Batting order not found" });
    }

    res.status(200).json(battingOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
module.exports = router;
