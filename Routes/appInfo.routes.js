const express = require("express");
const AppInfo = require("../models/AppInfoSchema");

const router = express.Router();

function normalizeMinimumVersion(value) {
  if (value == null) return "";
  return String(value).trim();
}

// PUT /api/app-info — set minimum version and maintenance flag (admin app)
// Body: { "minimumVersion": "1.0.10", "isError": false }
router.put("/app-info", async (req, res) => {
  try {
    const body = req.body || {};
    const minimumVersion = normalizeMinimumVersion(body.minimumVersion);
    const isError = body.isError === true;

    let doc = await AppInfo.findOne();
    if (!doc) {
      doc = new AppInfo({ minimumVersion, isError });
    } else {
      doc.minimumVersion = minimumVersion;
      doc.isError = isError;
    }
    await doc.save();

    return res.status(200).json({
      message: "App info updated",
      minimumVersion: doc.minimumVersion,
      isError: doc.isError,
    });
  } catch (err) {
    console.error("Error updating app info:", err);
    return res.status(500).json({ message: "Failed to update app info" });
  }
});

module.exports = router;
