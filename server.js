import express from "express";
import listEndpoints from "express-list-endpoints";
import cors from "cors";
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcrypt";

const port = process.env.PORT || 8080;
const app = express();

app.use(cors());
app.use(express.json());

const mongoURL = process.env.mongoURL;
mongoose.connect(mongoURL);
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

/* */
const Thought = mongoose.model("Thought", ThoughtSchema);

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    minlength: 3,
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: 6,
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString("hex"),
  },
});

const User = mongoose.model("User", UserSchema);

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
  } catch (err) {
    res.status(401).json({ error: "Invalid request" });
  }
};

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

app.post("/thoughts", authenticateUser, async (req, res) => {
  const { message } = req.body;
  try {
    const newThought = new Thought({ message, createdBy: req.user._id });
    const savedThought = await newThought.save();
    res.status(201).json(savedThought);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/thoughts/:id/like", async (req, res) => {
  const { id } = req.params;
  try {
    const updatedThought = await Thought.findByIdAndUpdate(
      id,
      { $inc: { hearts: 1 } },
      { new: true }
    );
    if (!updatedThought) {
      return res.status(404).json({ error: "Thought not found" });
    }
    res.status(200).json(updatedThought);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch("/thoughts/:id", authenticateUser, async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  try {
    const thought = await Thought.findById(id);
    if (!thought) return res.status(404).json({ error: "Thought not found" });
    if (String(thought.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ error: "Not your thought to edit" });
    }

    thought.message = message;
    await thought.save();
    res.json(thought);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/thoughts/:id", authenticateUser, async (req, res) => {
  const { id } = req.params;

  try {
    const thought = await Thought.findById(id);
    if (!thought) return res.status(404).json({ error: "Thought not found" });
    if (String(thought.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ error: "Not your thought to delete" });
    }

    await thought.deleteOne();
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: "Invalid ID" });
  }
});

app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const salt = bcrypt.genSaltSync();
    const hashedPassword = bcrypt.hashSync(password, salt);

    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

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
  } catch (err) {
    res.status(400).json({ error: "Something went wrong" });
  }
});

// 🚀 Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
