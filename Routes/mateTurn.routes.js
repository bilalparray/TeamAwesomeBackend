const express = require("express");
const mongoose = require("mongoose");
const MateGroup = require("../models/MateGroupSchema");
const MateTurn = require("../models/MateTurnSchema");
const Player = require("../models/PlayerSchema");

const router = express.Router();

function startOfDayUTC(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function nextSunday(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizePlayersPayload(players) {
  if (!Array.isArray(players) || players.length !== 2) {
    return { error: "players must be an array of exactly 2 entries" };
  }

  const normalized = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!p || !p.playerId || !p.name || !p.role) {
      return {
        error: `players[${i}] requires playerId, name, and role`,
      };
    }
    if (!mongoose.Types.ObjectId.isValid(p.playerId)) {
      return { error: `players[${i}].playerId is not a valid id` };
    }
    if (!["regular", "solo", "helper"].includes(p.role)) {
      return {
        error: `players[${i}].role must be regular, solo, or helper`,
      };
    }

    const entry = {
      playerId: p.playerId,
      name: String(p.name).trim(),
      role: p.role,
    };

    if (p.fromGroupNumber != null) {
      const fg = Number(p.fromGroupNumber);
      if (!Number.isInteger(fg) || fg < 1 || fg > 5) {
        return {
          error: `players[${i}].fromGroupNumber must be between 1 and 5`,
        };
      }
      entry.fromGroupNumber = fg;
    }

    normalized.push(entry);
  }

  return { players: normalized };
}

function validateRolesForGroup(groupNumber, players) {
  const roles = players.map((p) => p.role);

  if (groupNumber === 6) {
    const soloCount = roles.filter((r) => r === "solo").length;
    const helperCount = roles.filter((r) => r === "helper").length;
    if (soloCount !== 1 || helperCount !== 1) {
      return {
        error:
          "Group 6 requires exactly one solo player and one helper player",
      };
    }
    const helper = players.find((p) => p.role === "helper");
    if (!helper.fromGroupNumber) {
      return { error: "Helper player must include fromGroupNumber (1-5)" };
    }
  } else {
    if (!roles.every((r) => r === "regular")) {
      return {
        error: "Groups 1-5 require both players to have role 'regular'",
      };
    }
  }

  const ids = players.map((p) => String(p.playerId));
  if (ids[0] === ids[1]) {
    return { error: "Both players must be different people" };
  }

  return null;
}

async function validatePlayersAgainstGroups(groupNumber, players) {
  const config = await MateGroup.findOne().lean();
  if (!config || !Array.isArray(config.groups) || config.groups.length === 0) {
    return { error: "Mate groups are not configured yet. Save groups first." };
  }

  const group = config.groups.find((g) => g.groupNumber === groupNumber);
  if (!group) {
    return { error: `Group ${groupNumber} is not configured` };
  }

  const groupIdSet = new Set(
    (group.playerIds || []).map((id) => String(id))
  );

  if (groupNumber === 6) {
    const solo = players.find((p) => p.role === "solo");
    if (!groupIdSet.has(String(solo.playerId))) {
      return { error: "Solo player must belong to Group 6" };
    }

    const helper = players.find((p) => p.role === "helper");
    const helperGroup = config.groups.find((g) =>
      (g.playerIds || []).some((id) => String(id) === String(helper.playerId))
    );
    if (!helperGroup || helperGroup.groupNumber === 6) {
      return { error: "Helper must be a player from Groups 1-5" };
    }
    if (helper.fromGroupNumber !== helperGroup.groupNumber) {
      return {
        error: `Helper fromGroupNumber (${helper.fromGroupNumber}) does not match helper's actual group (${helperGroup.groupNumber})`,
      };
    }
  } else {
    for (const p of players) {
      if (!groupIdSet.has(String(p.playerId))) {
        return {
          error: `Player "${p.name}" is not assigned to Group ${groupNumber}`,
        };
      }
    }
  }

  return null;
}

function buildDefaultGroups() {
  return [1, 2, 3, 4, 5, 6].map((n) => ({
    groupNumber: n,
    playerIds: [],
    playerNames: [],
  }));
}

async function resolvePlayerNames(playerIds) {
  const players = await Player.find(
    { _id: { $in: playerIds } },
    { name: 1 }
  ).lean();
  const nameById = new Map(players.map((p) => [String(p._id), p.name || ""]));
  return playerIds.map((id) => nameById.get(String(id)) || "");
}

// GET /api/mate-groups
router.get("/mate-groups", async (req, res) => {
  try {
    let config = await MateGroup.findOne().lean();
    if (!config) {
      return res.status(200).json({ groups: buildDefaultGroups() });
    }
    res.status(200).json({ groups: config.groups || buildDefaultGroups() });
  } catch (err) {
    console.error("GET /api/mate-groups:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/mate-groups
// Body: { groups: [{ groupNumber, playerIds: [id, ...] }] }
router.put("/mate-groups", async (req, res) => {
  try {
    const { groups } = req.body || {};
    if (!Array.isArray(groups) || groups.length !== 6) {
      return res
        .status(400)
        .json({ message: "groups must be an array of exactly 6 entries" });
    }

    const normalized = [];
    const allPlayerIds = new Set();

    for (const g of groups) {
      const groupNumber = Number(g.groupNumber);
      if (!Number.isInteger(groupNumber) || groupNumber < 1 || groupNumber > 6) {
        return res.status(400).json({
          message: "Each group must have groupNumber between 1 and 6",
        });
      }

      if (!Array.isArray(g.playerIds)) {
        return res.status(400).json({
          message: `Group ${groupNumber}: playerIds must be an array`,
        });
      }

      const expectedCount = groupNumber === 6 ? 1 : 2;
      if (g.playerIds.length !== expectedCount) {
        return res.status(400).json({
          message: `Group ${groupNumber} must have exactly ${expectedCount} player(s)`,
        });
      }

      for (const id of g.playerIds) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({
            message: `Group ${groupNumber}: invalid player id ${id}`,
          });
        }
        const sid = String(id);
        if (allPlayerIds.has(sid)) {
          return res.status(400).json({
            message: "Each player can only belong to one mate group",
          });
        }
        allPlayerIds.add(sid);
      }

      const playerNames = await resolvePlayerNames(g.playerIds);
      normalized.push({
        groupNumber,
        playerIds: g.playerIds,
        playerNames,
      });
    }

    normalized.sort((a, b) => a.groupNumber - b.groupNumber);

    let config = await MateGroup.findOne();
    if (!config) {
      config = new MateGroup({ groups: normalized });
    } else {
      config.groups = normalized;
    }
    await config.save();

    res.status(200).json({
      message: "Mate groups saved successfully",
      groups: config.groups,
    });
  } catch (err) {
    console.error("PUT /api/mate-groups:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/mate-turns/suggested
router.get("/mate-turns/suggested", async (req, res) => {
  try {
    const config = await MateGroup.findOne().lean();
    if (!config || !config.groups?.length) {
      return res.status(404).json({
        message: "Mate groups not configured. Save groups first.",
      });
    }

    const lastTurn = await MateTurn.findOne().sort({ date: -1 }).lean();
    const lastGroup = lastTurn ? lastTurn.groupNumber : 0;
    const suggestedGroupNumber = lastGroup >= 6 ? 1 : lastGroup + 1;

    const group = config.groups.find(
      (g) => g.groupNumber === suggestedGroupNumber
    );
    if (!group) {
      return res.status(404).json({ message: "Suggested group not found" });
    }

    const suggestedDate = nextSunday(new Date());

    res.status(200).json({
      suggestedGroupNumber,
      suggestedDate,
      group,
      lastTurn: lastTurn || null,
      note:
        suggestedGroupNumber === 6
          ? "Group 6 solo player needs a helper from Groups 1-5"
          : null,
    });
  } catch (err) {
    console.error("GET /api/mate-turns/suggested:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/mate-turns
router.get("/mate-turns", async (req, res) => {
  try {
    const turns = await MateTurn.find().sort({ date: -1 }).lean();
    res.status(200).json(turns);
  } catch (err) {
    console.error("GET /api/mate-turns:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/mate-turns/:id
router.get("/mate-turns/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const turn = await MateTurn.findById(req.params.id).lean();
    if (!turn) {
      return res.status(404).json({ message: "Mate turn not found" });
    }
    res.status(200).json(turn);
  } catch (err) {
    console.error("GET /api/mate-turns/:id:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/mate-turns
router.post("/mate-turns", async (req, res) => {
  try {
    const { date, groupNumber, players, notes } = req.body || {};

    const gn = Number(groupNumber);
    if (!Number.isInteger(gn) || gn < 1 || gn > 6) {
      return res
        .status(400)
        .json({ message: "groupNumber must be an integer between 1 and 6" });
    }

    const normalizedDate = startOfDayUTC(date);
    if (!normalizedDate) {
      return res.status(400).json({ message: "Valid date is required" });
    }

    const playerResult = normalizePlayersPayload(players);
    if (playerResult.error) {
      return res.status(400).json({ message: playerResult.error });
    }

    const roleError = validateRolesForGroup(gn, playerResult.players);
    if (roleError) {
      return res.status(400).json({ message: roleError.error });
    }

    const groupError = await validatePlayersAgainstGroups(
      gn,
      playerResult.players
    );
    if (groupError) {
      return res.status(400).json({ message: groupError.error });
    }

    const existing = await MateTurn.findOne({ date: normalizedDate });
    if (existing) {
      return res.status(409).json({
        message: "A mate turn already exists for this date",
      });
    }

    const turn = new MateTurn({
      date: normalizedDate,
      groupNumber: gn,
      players: playerResult.players,
      notes: notes ? String(notes).trim() : "",
    });
    await turn.save();

    res.status(201).json({
      message: "Mate turn recorded successfully",
      turn,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "A mate turn already exists for this date",
      });
    }
    console.error("POST /api/mate-turns:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/mate-turns/:id
router.put("/mate-turns/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const turn = await MateTurn.findById(req.params.id);
    if (!turn) {
      return res.status(404).json({ message: "Mate turn not found" });
    }

    const { date, groupNumber, players, notes } = req.body || {};

    if (date != null) {
      const normalizedDate = startOfDayUTC(date);
      if (!normalizedDate) {
        return res.status(400).json({ message: "Valid date is required" });
      }
      const duplicate = await MateTurn.findOne({
        date: normalizedDate,
        _id: { $ne: turn._id },
      });
      if (duplicate) {
        return res.status(409).json({
          message: "Another mate turn already exists for this date",
        });
      }
      turn.date = normalizedDate;
    }

    const gn = groupNumber != null ? Number(groupNumber) : turn.groupNumber;
    if (!Number.isInteger(gn) || gn < 1 || gn > 6) {
      return res
        .status(400)
        .json({ message: "groupNumber must be an integer between 1 and 6" });
    }
    turn.groupNumber = gn;

    if (players != null) {
      const playerResult = normalizePlayersPayload(players);
      if (playerResult.error) {
        return res.status(400).json({ message: playerResult.error });
      }

      const roleError = validateRolesForGroup(gn, playerResult.players);
      if (roleError) {
        return res.status(400).json({ message: roleError.error });
      }

      const groupError = await validatePlayersAgainstGroups(
        gn,
        playerResult.players
      );
      if (groupError) {
        return res.status(400).json({ message: groupError.error });
      }

      turn.players = playerResult.players;
    } else {
      const roleError = validateRolesForGroup(gn, turn.players);
      if (roleError) {
        return res.status(400).json({ message: roleError.error });
      }
    }

    if (notes != null) {
      turn.notes = String(notes).trim();
    }

    await turn.save();

    res.status(200).json({
      message: "Mate turn updated successfully",
      turn,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "Another mate turn already exists for this date",
      });
    }
    console.error("PUT /api/mate-turns/:id:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/mate-turns/:id
router.delete("/mate-turns/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const turn = await MateTurn.findByIdAndDelete(req.params.id);
    if (!turn) {
      return res.status(404).json({ message: "Mate turn not found" });
    }

    res.status(200).json({ message: "Mate turn deleted successfully" });
  } catch (err) {
    console.error("DELETE /api/mate-turns/:id:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
