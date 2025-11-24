const express = require("express");
const cors = require("cors");
const ApiError = require("./app/api-error");
const path = require("path");

// --- Import routers ---
const publisherRouter = require("./app/routes/publisher.route");
const bookRouter = require("./app/routes/book.route");
const readerRouter = require("./app/routes/reader.route");
const employeeRouter = require("./app/routes/employee.route");
const loanRouter = require("./app/routes/loan.route.js");

const authRouter = require("./app/routes/auth.route");

const app = express();

app.use(cors());
app.use(express.json());

// Test API root
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Library Management API" });
});

// --- Routes ---
// --- Routes ---
app.use("/api/publishers", publisherRouter);
app.use("/api/books", bookRouter);
const uploadRouter = require("./app/routes/upload.route");

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api/readers", readerRouter);
app.use("/api/employees", employeeRouter);
app.use("/api/loans", loanRouter);
app.use("/api/auth", authRouter);


// 404 handler (không khớp route nào)
app.use((req, res, next) => {
  return next(new ApiError(404, "Resource not found"));
});

// Middleware xử lý lỗi tập trung
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  return res.status(err.statusCode || 500).json({
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
