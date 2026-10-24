const mqtt = require('mqtt');
const mysql = require('mysql2/promise');
const express = require('express');

const app = express();
app.use(express.json());

const DB_CONFIG = {
    host: '127.0.0.1',
    user: 'root',
    password: '', 
    database: 'hlw8012_db'
};

const MQTT_BROKER = 'mqtt://10.166.170.236:1883'; 
const MQTT_TOPIC_WILDCARD = 'esp/hlw8012/+';

let dbPool;

// Helper function using direct string concatenation to guarantee accuracy
async function ensureMeterTableExists(tableName) {
    const createTableQuery = 
        "CREATE TABLE IF NOT EXISTS `" + tableName + "` (" +
        "id BIGINT PRIMARY KEY AUTO_INCREMENT," +
        "timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
        "raw_voltage DOUBLE," +
        "calibrated_voltage DOUBLE," +
        "standard_voltage DOUBLE DEFAULT NULL," +
        "raw_current DOUBLE," +
        "calibrated_current DOUBLE," +
        "standard_current DOUBLE DEFAULT NULL," +
        "raw_power DOUBLE," +
        "calibrated_power DOUBLE," +
        "standard_power DOUBLE DEFAULT NULL" +
        ");";
        
    await dbPool.query(createTableQuery);
}

async function startSystem() {
    dbPool = await mysql.createPool(DB_CONFIG);
    console.log('⚡ Connected to XAMPP MySQL Database.');

    const mqttClient = mqtt.connect(MQTT_BROKER);

    mqttClient.on('connect', () => {
        console.log('📡 Connected to local Mosquitto Broker.');
        mqttClient.subscribe(MQTT_TOPIC_WILDCARD);
    });

    mqttClient.on('message', async (topic, message) => {
        try {
            const topicParts = topic.split('/');
            const meterId = topicParts[topicParts.length - 1]; 
            const tableName = 'power_logs_' + meterId; // Safe concatenation

            // Verify or build table
            await ensureMeterTableExists(tableName);

            const data = JSON.parse(message.toString());
            
            const insertQuery = "INSERT INTO `" + tableName + "` " +
                "(raw_voltage, calibrated_voltage, raw_current, calibrated_current, raw_power, calibrated_power) " +
                "VALUES (?, ?, ?, ?, ?, ?);";
                
            await dbPool.query(insertQuery, [
                parseFloat(data.raw_v), parseFloat(data.cal_v), 
                parseFloat(data.raw_c), parseFloat(data.cal_c), 
                parseFloat(data.raw_p), parseFloat(data.cal_p)
            ]);
            
            console.log(`[Logged to ${tableName}] V: ${data.cal_v}V | C: ${data.cal_c}A | P: ${data.cal_p}W`);
        } catch (err) {
            console.error('❌ MQTT Processing Error:', err.message);
        }
    });
}

// ==========================================
// WEB API ENDPOINTS 
// ==========================================

app.post('/api/standard/:meterId', async (req, res) => {
    const { meterId } = req.params;
    const { std_v, std_c, std_p } = req.body;
    const tableName = 'power_logs_' + meterId;

    if (std_v === undefined || std_c === undefined || std_p === undefined) {
        return res.status(400).json({ error: "Missing parameters." });
    }

    try {
        const selectQuery = "SELECT id FROM `" + tableName + "` ORDER BY id DESC LIMIT 1;";
        const [rows] = await dbPool.query(selectQuery);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: "No records found in " + tableName });
        }
        
        const latestId = rows[0].id;

        const updateQuery = "UPDATE `" + tableName + "` SET standard_voltage = ?, standard_current = ?, standard_power = ? WHERE id = ?;";
        await dbPool.query(updateQuery, [std_v, std_c, std_p, latestId]);

        res.json({ success: true, message: "Updated row in " + tableName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/logs/:meterId', async (req, res) => {
    const { meterId } = req.params;
    const tableName = 'power_logs_' + meterId;
    try {
        const selectLogsQuery = "SELECT * FROM `" + tableName + "` ORDER BY id DESC LIMIT 10;";
        const [rows] = await dbPool.query(selectLogsQuery);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log('🌐 Web API Server running on http://localhost:3000'));
startSystem();
