import "dotenv/config";

const express = require('express')
const app = express()

app.get("/api", (req, res) => {
    res.json({ "users": ["userOne", "userTwo", "userThree", "userFour", "userFive"] })
})

app.listen(process.env.PORT || 5000, () => { console.log(`Server is running on port ${process.env.PORT || 5000}`) })