const express = require("express");
const multer = require("multer");
const {
  extractPlayers,
  processScorecard,
} = require("../controllers/scorecard.controller");

const router = express.Router();

// Multer: keep file in memory for pdf-parse
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
  },
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === "application/pdf" ||
      (file.originalname || "").toLowerCase().endsWith(".pdf");
    if (!ok) return cb(new Error("Only PDF files are allowed"));
    cb(null, true);
  },
});

// POST /api/scorecard/extract-players
router.post("/extract-players", upload.single("pdf"), extractPlayers);

// POST /api/scorecard/process
router.post("/process", upload.single("pdf"), processScorecard);

// Multer/fileFilter errors
router.use((err, req, res, next) => {
  if (!err) return next();
  const msg = err && err.message ? err.message : "Upload failed";
  return res.status(400).json({ message: msg });
});

module.exports = router;
