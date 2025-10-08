const express = require("express");
const router = express.Router();
const Player = require("../models/PlayerSchema");
const BattingOrder = require("../models/BattingOrderSchema");
const NextMatch = require("../models/NextMatchSchema");
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
router.get("/updatewicket", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "updatewicket.html"));
});
router.get("/updatelast", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "updatelast.html"));
});
router.get("/addmatch", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "addmatch.html"));
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
        return { ...player.toObject() };
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
    const { runs, balls, wickets } = req.body; // Remove lastfour and innings from the body

    // Validate that runs, balls, and wickets are arrays
    if (
      (runs && !Array.isArray(runs)) ||
      (balls && !Array.isArray(balls)) ||
      (wickets && !Array.isArray(wickets))
    ) {
      return res.status(400).json({
        message: "Invalid input: runs, balls, and wickets should be arrays",
      });
    }

    let player = await Player.findById(playerId);

    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    // Update lastfour and innings arrays directly with runs if provided
    if (runs) {
      // Update lastfour array
      if (player.scores.lastfour.length >= 4) {
        player.scores.lastfour = runs.slice(0, 4); // Replace with the first 4 elements of runs
      } else {
        player.scores.lastfour.push(...runs);
        // Trim the lastfour array to maintain only the latest 4 entries
        player.scores.lastfour = player.scores.lastfour.slice(-4);
      }

      // Append runs to innings and career's innings arrays
      player.scores.innings.push(...runs);
      player.scores.career.innings.push(...runs);

      // Append runs to runs and career's runs arrays
      player.scores.runs.push(...runs);
      player.scores.career.runs.push(...runs);
    }

    // Append balls and wickets to their respective arrays if they exist
    if (balls) {
      player.scores.balls.push(...balls);
      player.scores.career.balls.push(...balls);
    }

    if (wickets) {
      player.scores.wickets.push(...wickets);
      player.scores.career.wickets.push(...wickets);
    }

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

// PUT /api/update/:playerId/wicket
router.put("/api/update/:playerId/wicket", async (req, res) => {
  try {
    const { playerId } = req.params;
    const { wicket } = req.body;

    if (typeof wicket !== "string" || !wicket.trim()) {
      return res
        .status(400)
        .json({ message: "Please provide a non-empty wicket string." });
    }

    // Atomically push to both arrays and return the updated doc
    const updatedPlayer = await Player.findByIdAndUpdate(
      playerId,
      {
        $push: {
          "scores.wickets": wicket,
          "scores.career.wickets": wicket,
        },
      },
      { new: true, runValidators: true } // new: return the updated document
    );

    if (!updatedPlayer) {
      return res.status(404).json({ message: "Player not found" });
    }

    res.status(200).json({
      message: "Wicket added to both season and career records",
      scores: {
        seasonWickets: updatedPlayer.scores.wickets,
        careerWickets: updatedPlayer.scores.career.wickets,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/update/:playerId/last
router.put("/api/update/:playerId/last", async (req, res) => {
  try {
    const { playerId } = req.params;
    const { runs, balls, wickets } = req.body;

    // Validate that at least one field is provided
    if (runs == null && balls == null && wickets == null) {
      return res
        .status(400)
        .json({ message: "Provide at least one of: runs, balls, wickets" });
    }

    // Load player
    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    // Helper fn to update last element of an array
    const updateLast = (arr, value) => {
      if (!Array.isArray(arr) || arr.length === 0) return false;
      arr[arr.length - 1] = value;
      return true;
    };

    // Update each if provided; track which failed because array was empty
    const errors = [];
    if (runs != null) {
      const okSeason = updateLast(player.scores.runs, runs);
      const okCareer = updateLast(player.scores.career.runs, runs);
      if (!okSeason || !okCareer) errors.push("runs");
    }
    if (balls != null) {
      const okSeason = updateLast(player.scores.balls, balls);
      const okCareer = updateLast(player.scores.career.balls, balls);
      if (!okSeason || !okCareer) errors.push("balls");
    }
    if (wickets != null) {
      const okSeason = updateLast(player.scores.wickets, wickets);
      const okCareer = updateLast(player.scores.career.wickets, wickets);
      if (!okSeason || !okCareer) errors.push("wickets");
    }

    // Save document
    await player.save();

    // Build response
    const resp = {
      message: "Last entries updated",
      updated: {},
    };
    if (runs != null)
      resp.updated.runs = {
        season: player.scores.runs,
        career: player.scores.career.runs,
      };
    if (balls != null)
      resp.updated.balls = {
        season: player.scores.balls,
        career: player.scores.career.balls,
      };
    if (wickets != null)
      resp.updated.wickets = {
        season: player.scores.wickets,
        career: player.scores.career.wickets,
      };
    if (errors.length) {
      resp.warning = `Could not update last element for: ${errors.join(
        ", "
      )} (empty array)`;
    }

    return res.status(200).json(resp);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST: Add new match
router.post("/api/nextmatch", async (req, res) => {
  try {
    const newMatch = new NextMatch(req.body);
    await newMatch.save();
    res
      .status(201)
      .json({ message: "Match added successfully", match: newMatch });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error adding match" });
  }
});

// GET: All upcoming matches (sorted by date)
router.get("/api/nextmatch", async (req, res) => {
  try {
    const matches = await NextMatch.find().sort({ createdAt: -1 });
    res.status(200).json(matches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching matches" });
  }
});

// GET: Single match by ID
// PUT: Update a match
router.put("/api/nextmatch/:id", async (req, res) => {
  try {
    const updatedMatch = await NextMatch.findByIdAndUpdate(
      req.params.id,
      req.body, // Accepts all fields: opponent, matchType, isSeries, etc.
      { new: true, runValidators: true }
    );
    if (!updatedMatch) {
      return res.status(404).json({ message: "Match not found" });
    }
    res.status(200).json(updatedMatch);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating match" });
  }
});

// PUT: Update a match by ID
router.put("/api/nextmatch/:id", async (req, res) => {
  try {
    const match = await NextMatch.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!match) return res.status(404).json({ message: "Match not found" });
    res.status(200).json({ message: "Match updated successfully", match });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating match" });
  }
});

// DELETE: Remove a match by ID
router.delete("/api/nextmatch/:id", async (req, res) => {
  try {
    const match = await NextMatch.findByIdAndDelete(req.params.id);
    if (!match) return res.status(404).json({ message: "Match not found" });
    res.status(200).json({ message: "Match deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting match" });
  }
});
// GET single match by ID
router.get("/api/nextmatch/:id", async (req, res) => {
  try {
    const match = await NextMatch.findById(req.params.id);
    if (!match) return res.status(404).json({ message: "Match not found" });
    res.status(200).json(match);
  } catch (err) {
    console.error("Error fetching single match:", err);
    res.status(500).json({ message: "Error fetching match" });
  }
});

// POST /api/stats/top
// Body: { metric: "50s" | "100s" | "wickets", scope?: "year" | "career" }
// scope defaults to "career"
router.post("/api/stats/top", async (req, res) => {
  try {
    const { metric, scope = "career" } = req.body || {};

    if (!metric) return res.status(400).json({ message: "metric is required" });

    const normalizedMetric = String(metric).toLowerCase();

    if (
      !["50s", "fifties", "100s", "hundreds", "wickets"].includes(
        normalizedMetric
      )
    ) {
      return res
        .status(400)
        .json({ message: "metric must be one of: 50s, 100s, wickets" });
    }
    if (!["year", "career"].includes(scope)) {
      return res
        .status(400)
        .json({ message: "scope must be 'year' or 'career'" });
    }

    // Fetch only fields we need
    const players = await Player.find(
      {},
      { name: 1, role: 1, image: 1, scores: 1 }
    ).lean();

    const results = await Promise.all(
      players.map(async (p) => {
        // helpers to safely access arrays
        const getInnings = () =>
          scope === "career"
            ? p.scores &&
              p.scores.career &&
              Array.isArray(p.scores.career.innings)
              ? p.scores.career.innings
              : []
            : p.scores && Array.isArray(p.scores.innings)
            ? p.scores.innings
            : [];

        const getWickets = () =>
          scope === "career"
            ? p.scores &&
              p.scores.career &&
              Array.isArray(p.scores.career.wickets)
              ? p.scores.career.wickets
              : []
            : p.scores && Array.isArray(p.scores.wickets)
            ? p.scores.wickets
            : [];

        let count = 0;

        if (["50s", "fifties"].includes(normalizedMetric)) {
          const innings = getInnings();
          for (const entry of innings) {
            const runs = parseInt(entry, 10);
            if (!isNaN(runs) && runs >= 50 && runs < 100) count++;
          }
        } else if (["100s", "hundreds"].includes(normalizedMetric)) {
          const innings = getInnings();
          for (const entry of innings) {
            const runs = parseInt(entry, 10);
            if (!isNaN(runs) && runs >= 100) count++;
          }
        } else if (normalizedMetric === "wickets") {
          const wicketsArr = getWickets();
          for (const w of wicketsArr) {
            const wk = parseInt(w, 10);
            if (!isNaN(wk)) count += wk;
          }
        }

        return {
          _id: p._id,
          name: p.name || "Unknown",
          role: p.role || null,
          image: p.image || null, // base64 compressed image or null
          count: count, // will be 0 if no data
        };
      })
    );

    // sort descending by metricCount
    results.sort((a, b) => b.count - a.count);

    return res
      .status(200)
      .json({ metric: normalizedMetric, scope, players: results });
  } catch (err) {
    console.error("Error in /api/stats/top:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
