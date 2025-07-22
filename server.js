import express from "express";
import listEndpoints from "express-list-endpoints";
import cors from "cors";
import thoughts from "./thoughts.json";
import mongoose from "mongoose";

// Defines the port the app will run on. Defaults to 8080, but can be overridden
// when starting the server. Example command to overwrite PORT env variable value:
// PORT=9000 npm start
const port = process.env.PORT || 8080;
const app = express();

// Add middlewares to enable cors and json body parsing
app.use(cors());
app.use(express.json());

/*mongoose starting code */
const mongoURL = process.env.mongoURL || "mongodb://localhost/collection";
mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.Promise = Promise;

const ThoughtSchema = new mongoose.Schema({
  message: {
    type: String,
    required: [true, "Message is required"],
    minlength: [5, "Message too short"],
    maxlength: [140, "Message too long"],
  },
  hearts: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Thought = mongoose.model("Thought", ThoughtSchema);

// Start defining your routes here
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Oscar's Thoughts API!",
    endpoints: listEndpoints(app),
  });
});

app.get("/thoughts", async (req, res) => {
  const { page = 1, limit = 5 } = req.query;

  try {
    const totalThoughts = await Thought.countDocuments();
    const thoughts = await Thought.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      page: Number(page),
      limit: Number(limit),
      totalThoughts,
      totalPages: Math.ceil(totalThoughts / limit),
      results: thoughts,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch thoughts" });
  }
});

/* 

get paginated thoughts, e.g
http://localhost:8080/thoughts?page=1&limit=2
returns 2 thoughts 

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

*/

/*
get all thoughts

app.get("/thoughts", (req, res) => {
  res.json(thoughts);
});
*/

app.get("/thoughts/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const thought = await Thought.findById(id);
    if (!thought) {
      return res.status(404).json({ error: "Thought not found" });
    }
    res.json(thought);
  } catch (err) {
    res.status(400).json({ error: "Invalid ID" });
  }
});

/*
get thought by id 

app.get("/thoughts/:id", (req, res) => {
  const { id } = req.params;
  const thought = thoughts.find((t) => t.id === +id);

  if (thought) {
    res.json(thought);
  } else {
    res.status(404).json({ error: "Thought not found" });
  }
});
*/

/*add a thought */
app.post("/thoughts", async (req, res) => {
  const { message } = req.body;

  try {
    const newThought = new Thought({ message });
    const savedThought = await newThought.save();
    res.status(201).json(savedThought);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/*chnage a thought */
app.patch("/thoughts/:id", async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  try {
    const updated = await Thought.findByIdAndUpdate(
      id,
      { message },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Thought not found" });
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/*remove a thought */
app.delete("/thoughts/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await Thought.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Thought not found" });
    }

    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: "Invalid ID" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
