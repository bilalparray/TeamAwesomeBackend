const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const sharp = require("sharp");
const routes = require("./Routes/routes");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config({
  path: path.join(__dirname, "process.env"),
});
const cors = require("cors");
// Increase the request body size limit
app.use(bodyParser.json({ limit: "500kb" }));
app.use(bodyParser.urlencoded({ limit: "500kb", extended: true }));
// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI);

// Schema and Model
// const playerSchema = new mongoose.Schema({
//   name: String,
//   role: String,
//   born: Date,
//   birthplace: String,
//   battingstyle: String,
//   bowlingstyle: String,
//   debut: Date,
//   image: String,
//   scores: {
//     runs: [String],
//     balls: [String],
//     wickets: [String],
//     lastfour: [String],
//     innings: [String],
//     career: {
//       balls: [String],
//       runs: [String],
//       wickets: [String],
//       innings: [String],
//       ranking: String,
//     },
//   },
// });

// Enable CORS
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
// Middleware
// app.use(bodyParser.json());

// Routes
app.use("/", routes);
// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
