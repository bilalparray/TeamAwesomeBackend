const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({
  path: path.join(__dirname, "..", "process.env"),
});

const SCORE_ARRAY_PATHS = [
  "scores.runs",
  "scores.balls",
  "scores.wickets",
  "scores.lastfour",
  "scores.career.runs",
  "scores.career.balls",
  "scores.career.wickets",
];

async function getTypeCounts(col) {
  const counts = {};
  for (const pathName of SCORE_ARRAY_PATHS) {
    counts[pathName] = {
      string: await col.countDocuments({
        [pathName]: { $elemMatch: { $type: "string" } },
      }),
      number: await col.countDocuments({
        [pathName]: { $elemMatch: { $type: "number" } },
      }),
    };
  }
  return counts;
}

function printTypeCounts(label, counts) {
  console.log(label);
  for (const pathName of SCORE_ARRAY_PATHS) {
    const c = counts[pathName] || { string: 0, number: 0 };
    console.log(`- ${pathName}: stringDocs=${c.string}, numberDocs=${c.number}`);
  }
}

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing in process.env");
  }

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB${dryRun ? " (dry-run)" : ""}`);

  const col = mongoose.connection.db.collection("players");
  const totalPlayers = await col.countDocuments({});
  const beforeCounts = await getTypeCounts(col);
  printTypeCounts("Before conversion", beforeCounts);

  let modifiedCount = 0;
  if (!dryRun) {
    const updateResult = await col.updateMany(
      {},
      [
        {
          $set: {
            "scores.runs": {
              $map: {
                input: { $ifNull: ["$scores.runs", []] },
                as: "v",
                in: {
                  $convert: {
                    input: "$$v",
                    to: "int",
                    onError: 0,
                    onNull: 0,
                  },
                },
              },
            },
            "scores.balls": {
              $map: {
                input: { $ifNull: ["$scores.balls", []] },
                as: "v",
                in: {
                  $convert: {
                    input: "$$v",
                    to: "int",
                    onError: 0,
                    onNull: 0,
                  },
                },
              },
            },
            "scores.wickets": {
              $map: {
                input: { $ifNull: ["$scores.wickets", []] },
                as: "v",
                in: {
                  $convert: {
                    input: "$$v",
                    to: "int",
                    onError: 0,
                    onNull: 0,
                  },
                },
              },
            },
            "scores.lastfour": {
              $map: {
                input: { $ifNull: ["$scores.lastfour", []] },
                as: "v",
                in: {
                  $convert: {
                    input: "$$v",
                    to: "int",
                    onError: 0,
                    onNull: 0,
                  },
                },
              },
            },
            "scores.career.runs": {
              $map: {
                input: { $ifNull: ["$scores.career.runs", []] },
                as: "v",
                in: {
                  $convert: {
                    input: "$$v",
                    to: "int",
                    onError: 0,
                    onNull: 0,
                  },
                },
              },
            },
            "scores.career.balls": {
              $map: {
                input: { $ifNull: ["$scores.career.balls", []] },
                as: "v",
                in: {
                  $convert: {
                    input: "$$v",
                    to: "int",
                    onError: 0,
                    onNull: 0,
                  },
                },
              },
            },
            "scores.career.wickets": {
              $map: {
                input: { $ifNull: ["$scores.career.wickets", []] },
                as: "v",
                in: {
                  $convert: {
                    input: "$$v",
                    to: "int",
                    onError: 0,
                    onNull: 0,
                  },
                },
              },
            },
          },
        },
      ]
    );
    modifiedCount = updateResult.modifiedCount || 0;
  }

  const afterCounts = await getTypeCounts(col);
  printTypeCounts("After conversion", afterCounts);
  console.log(`Total players scanned: ${totalPlayers}`);
  if (!dryRun) {
    console.log(`Players modified by update pipeline: ${modifiedCount}`);
    console.log("Migration complete.");
  } else {
    console.log("Dry-run complete. No changes saved.");
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Migration failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors
  }
  process.exit(1);
});
