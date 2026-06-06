const express = require("express");
const router = express.Router();

// POST /api/admin/verify-pin
// Body: { "pin": "1234" }
router.post("/admin/verify-pin", (req, res) => {
  const expected = process.env.ADMIN_PIN;
  if (!expected) {
    return res.status(503).json({
      message: "Admin PIN is not configured on the server (set ADMIN_PIN in process.env)",
    });
  }

  const pin = req.body && req.body.pin != null ? String(req.body.pin) : "";
  if (!pin) {
    return res.status(400).json({ message: "pin is required" });
  }

  if (pin !== expected) {
    return res.status(401).json({ message: "Invalid admin PIN" });
  }

  return res.status(200).json({ ok: true, message: "PIN verified" });
});

module.exports = router;
