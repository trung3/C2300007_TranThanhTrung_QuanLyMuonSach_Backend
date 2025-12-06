const app = require("./app");
const { getClient } = require("./utils/mongodb.util");

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Kết nối MongoDB
    await getClient();
    console.log("Connected to MongoDB");

    // Lắng nghe cổng
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Cannot connect to MongoDB:", error);
    process.exit(1);
  }
}

startServer();
