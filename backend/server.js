const express = require('express');
const bodyParser = require('body-parser');
const ruleRoute = require("../backend/routes/rulesRoutes");
const studentRoute = require("../backend/routes/studentRoutes");
const cors = require('cors');
const cron = require('node-cron');
const {executeRules, takeAction} = require('../backend/jobs/cronJobs');
const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use("/api/rules", ruleRoute);
app.use("/api/students", studentRoute);


const fetchJob = cron.schedule('* * * * *', () => {
    console.log("Executing rules...");
    executeRules();
});

fetchJob.start();

const execJob = cron.schedule('* * * * *', ()=>{
    console.log("Second jobs in process");
    takeAction();
})

execJob.start();

app.listen(3000, () => {
    console.log(`Server started on port 3000`);
});
