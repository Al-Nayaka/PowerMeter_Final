import express from "express";
import pool from "./config/database.js";

const app = express();

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        message: "PowerMeter Backend is running"
    });
});

app.get("/api/db-test", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT NOW() AS current_time"
        );

        res.json({
            status: "Connected",
            database_time: result.rows[0].current_time
        });

    } catch (error) {
        console.error("Database connection failed:", error);

        res.status(500).json({
            status: "Failed",
            message: "Could not connect to PostgreSQL"
        });
    }
});

export default app;