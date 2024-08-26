const mongoose = require("mongoose");

const appInfoSchema = new mongoose.Schema({
  minimumVersion: String,
  isError: Boolean,
});

// Define a model
const AppInfo = mongoose.model("AppInfo", appInfoSchema);
module.exports = AppInfo;
