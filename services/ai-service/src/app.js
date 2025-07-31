const express = require("express");
const aiRoutes = require("./routes/aiRoutes");
const healthRoutes = require("./routes/healthRoutes");
const statsRoutes = require("./routes/statsRoutes");
const errorHandler = require("./middleware/errorHandler");
const usageTracker = require("./middleware/usageTracker");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(usageTracker);

app.use("/", aiRoutes);
app.use("/health", healthRoutes);
app.use("/stats", statsRoutes);

app.use(errorHandler);
export default app;
