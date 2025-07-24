import express from "express";
import listEndpoints from "express-list-endpoints";
import cors from "cors";
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcrypt";

// Setup
const port = process.env.PORT || 8080;
const app = express();
const mongoURL = process.env.mongoURL || "mongodb://127.0.0.1/happy-thoughts";
mongoose.connect(mongoURL);
mongoose.Promise = Promise;

app.use(cors());
app.use(express.json());

// Schemas
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    match: [/.+@.+\..+/, "Invalid email format"],
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString("hex"),
  },
});

const ThoughtSchema = new mongoose.Schema({
  message: {
    type: String,
    required: [true, "Message is required"],
    minlength: 5,
    maxlength: 140,
  },
  hearts: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

const User = mongoose.model("User", UserSchema);
const Thought = mongoose.model("Thought", ThoughtSchema);

// Auth middleware
const authenticateUser = async (req, res, next) => {
  const accessToken = req.header("Authorization");
  try {
    const user = await User.findOne({ accessToken });
    if (user) {
      req.user = user;
      next();
    } else {
      res.status(401).json({ error: "Please log in to access this resource" });
    }
  } catch {
    res.status(401).json({ error: "Invalid request" });
  }
};

// Routes
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
      .limit(Number(limit));
    res.json({
      page: Number(page),
      totalThoughts,
      totalPages: Math.ceil(totalThoughts / limit),
      results: thoughts,
    });
  } catch {
    res.status(500).json({ error: "Could not fetch thoughts" });
  }
});

app.get("/thoughts/:id", async (req, res) => {
  try {
    const thought = await Thought.findById(req.params.id);
    if (!thought) return res.status(404).json({ error: "Thought not found" });
    res.json(thought);
  } catch {
    res.status(400).json({ error: "Invalid ID" });
  }
});

app.post("/thoughts", async (req, res) => {
  const { message } = req.body;
  const accessToken = req.header("Authorization");

  try {
    let createdBy = null;
    if (accessToken) {
      const user = await User.findOne({ accessToken });
      if (user) {
        createdBy = user._id;
      }
    }

    const newThought = new Thought({ message, createdBy });
    const savedThought = await newThought.save();
    res.status(201).json(savedThought);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/thoughts/:id/like", async (req, res) => {
  try {
    const updated = await Thought.findByIdAndUpdate(
      req.params.id,
      { $inc: { hearts: 1 } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Thought not found" });
    res.status(200).json(updated);
  } catch {
    res.status(400).json({ error: "Invalid ID" });
  }
});

app.patch("/thoughts/:id", authenticateUser, async (req, res) => {
  try {
    const thought = await Thought.findById(req.params.id);
    if (!thought) return res.status(404).json({ error: "Thought not found" });
    if (
      !thought.createdBy ||
      thought.createdBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ error: "Not allowed to edit this thought" });
    }
    thought.message = req.body.message;
    await thought.save();
    res.json(thought);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/thoughts/:id", authenticateUser, async (req, res) => {
  try {
    const thought = await Thought.findById(req.params.id);
    if (!thought) return res.status(404).json({ error: "Thought not found" });
    if (
      !thought.createdBy ||
      thought.createdBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ error: "Not allowed to delete this thought" });
    }
    await thought.deleteOne();
    res.status(204).end();
  } catch {
    res.status(400).json({ error: "Invalid ID" });
  }
});

app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password)
      return res.status(400).json({ error: "All fields are required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res
        .status(400)
        .json({ error: "That email address already exists" });

    const hashed = bcrypt.hashSync(password, bcrypt.genSaltSync());
    const newUser = await new User({ email, password: hashed }).save();

    res.status(201).json({
      email: newUser.email,
      id: newUser._id,
      accessToken: newUser.accessToken,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    res.status(200).json({
      email: user.email,
      id: user._id,
      accessToken: user.accessToken,
    });
  } catch {
    res.status(400).json({ error: "Something went wrong" });
  }
});

// Server startup
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
