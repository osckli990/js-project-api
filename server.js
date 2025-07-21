import express from "express";
import listEndpoints from "express-list-endpoints";
import cors from "cors";
import thoughts from "./thoughts.json";

// Defines the port the app will run on. Defaults to 8080, but can be overridden
// when starting the server. Example command to overwrite PORT env variable value:
// PORT=9000 npm start
const port = process.env.PORT || 8080;
const app = express();

// Add middlewares to enable cors and json body parsing
app.use(cors());
app.use(express.json());

// Start defining your routes here
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Oscar's Thoughts Api!",
    endpoints: listEndpoints(app),
  });
});

app.get("/thoughts", (req, res) => {
  const { page = 1, limit = 5 } = req.query;

  // Convert query strings to numbers
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  // Calculate starting and ending index
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;

  // Slice the array
  const paginatedThoughts = thoughts.slice(startIndex, endIndex);

  // Response
  res.json({
    page: pageNum,
    limit: limitNum,
    totalThoughts: thoughts.length,
    totalPages: Math.ceil(thoughts.length / limitNum),
    results: paginatedThoughts,
  });
});
/*
get all thoughts
app.get("/thoughts", (req, res) => {
  res.json(thoughts);
});
*/

app.get("/thoughts/:id", (req, res) => {
  const { id } = req.params;
  const thought = thoughts.find((t) => t.id === +id);

  if (thought) {
    res.json(thought);
  } else {
    res.status(404).json({ error: "Thought not found" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
