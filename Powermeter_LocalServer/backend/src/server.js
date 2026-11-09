import "dotenv/config";
import http from "http";
import app from "./app.js";

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", () => {
    console.log(`PowerMeter Backend running on port ${PORT}`);
});

console.log("Database host:", process.env.DB_HOST);
console.log("Database user:", process.env.DB_USER);
console.log(
    "Password loaded:",
    Boolean(process.env.DB_PASSWORD)
);