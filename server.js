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

// Enable CORS
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
// Middleware

// Routes
app.use("/", routes);
// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
