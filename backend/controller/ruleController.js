const { poolPromise } = require('../dbconfig/dbconfig');

exports.fetchrules = async (req, res) => {
    try {
        const pool = await poolPromise; 
        const result = await pool.request().query("SELECT * FROM Rules"); 
        res.json(result.recordset); 
    } catch (err) {
        console.error('SQL error', err); 
        res.status(500).json({ error: 'Database error' }); 
    }
};



// exports.fetchrules = (req, res) => {
//     pool.query("SELECT * FROM Rules", (error, results)=>{
//         if(error){
//             console.error("No data found in database",error);
//             return res.status(500).json({error:"Error in database"});
//         }
//         res.json(results);
//     });
// };

exports.addRules = async (req, res) => {
    let nextActionTime;

    // Check if Rule_Frequency is provided and calculate Rule_Action_Time dynamically
    if (req.body.Rule_Frequency) {
        // Extract frequency details from the format (e.g., '1_minute')
        const frequencyParts = req.body.Rule_Frequency.split('_');
        if (frequencyParts.length !== 2) {
            return res.status(400).json({ error: 'Invalid Rule_Frequency format' });
        }

        const frequencyAmount = parseInt(frequencyParts[0], 10); // e.g., '1'
        const frequencyUnit = frequencyParts[1]; // e.g., 'minute'

        // Ensure frequencyAmount is a valid number
        if (isNaN(frequencyAmount)) {
            return res.status(400).json({ error: 'Frequency amount must be a number' });
        }

        // Construct the SQL DATEADD expression
        nextActionTime = `DATEADD(${frequencyUnit}, ${frequencyAmount}, GETDATE())`;
    } else {
        nextActionTime = null; // If no frequency is provided, leave it as null
    }

    const rule = [
        req.body.Rule_Name,
        req.body.Rule_Object,
        req.body.Rule_Condition,
        req.body.Rule_Value,
        req.body.Rule_Parameter,
        req.body.Rule_Frequency,
        req.body.Rule_Action,
        req.body.Rule_Priority,
        new Date(), // Rule_Creation_Date
        new Date()  // Rule_Modify_Date
    ];

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Rule_Name', rule[0])
            .input('Rule_Object', rule[1])
            .input('Rule_Condition', rule[2])
            .input('Rule_Value', rule[3])
            .input('Rule_Parameter', rule[4])
            .input('Rule_Frequency', rule[5])
            .input('Rule_Action', rule[6])
            .input('Rule_Priority', rule[7])
            .input('Rule_Creation_Date', rule[8])
            .input('Rule_Modify_Date', rule[9])
            .query(`
                DECLARE @nextActionTime DATETIME;
                SET @nextActionTime = ${nextActionTime};

                INSERT INTO Rules 
                (Rule_Name, Rule_Object, Rule_Condition, Rule_Value, Rule_Parameter, Rule_Frequency, Rule_Action, Rule_Action_Time, Rule_Priority, Rule_Creation_Date, Rule_Modify_Date)
                VALUES (@Rule_Name, @Rule_Object, @Rule_Condition, @Rule_Value, @Rule_Parameter, @Rule_Frequency, @Rule_Action, @nextActionTime, @Rule_Priority, @Rule_Creation_Date, @Rule_Modify_Date)
            `);
        
        res.status(201).json({ id: result.recordset.insertId });
    } catch (err) {
        console.error("Error in the database:", err);
        res.status(500).json({ error: "Database error" });
    }
};


// exports.addRules = async (req, res) => {
//     let nextActionTime;

//     // Check if Rule_Frequency is provided and calculate Rule_Action_Time dynamically
//     if (req.body.Rule_Frequency) {
//         // Using SQL's DATEADD to handle frequency dynamically (e.g., '1_minute', '1_hour')
//         nextActionTime = `DATEADD(${req.body.Rule_Frequency}, 0, GETDATE())`; // Adds the frequency (e.g., 'minute', 'hour') to the current time
//     } else {
//         nextActionTime = null;  // If no frequency is provided, leave it as null
//     }

//     const rule = [
//         req.body.Rule_Name,
//         req.body.Rule_Object,
//         req.body.Rule_Condition,
//         req.body.Rule_Value,
//         req.body.Rule_Parameter,
//         req.body.Rule_Frequency,
//         req.body.Rule_Action,
//         nextActionTime,  // Rule_Action_Time is dynamically set based on Rule_Frequency
//         req.body.Rule_Priority,
//         new Date(),
//         new Date()
//     ];

//     try {
//         const pool = await poolPromise;
//         const result = await pool.request()
//             .input('Rule_Name', rule[0])
//             .input('Rule_Object', rule[1])
//             .input('Rule_Condition', rule[2])
//             .input('Rule_Value', rule[3])
//             .input('Rule_Parameter', rule[4])
//             .input('Rule_Frequency', rule[5])
//             .input('Rule_Action', rule[6])
//             .input('Rule_Action_Time', rule[7])
//             .input('Rule_Priority', rule[8])
//             .input('Rule_Creation_Date', rule[9])
//             .input('Rule_Modify_Date', rule[10])
//             .query(`
//                 INSERT INTO Rules 
//                 (Rule_Name, Rule_Object, Rule_Condition, Rule_Value, Rule_Parameter, Rule_Frequency, Rule_Action, Rule_Action_Time, Rule_Priority, Rule_Creation_Date, Rule_Modify_Date)
//                 VALUES (@Rule_Name, @Rule_Object, @Rule_Condition, @Rule_Value, @Rule_Parameter, @Rule_Frequency, @Rule_Action, @Rule_Action_Time, @Rule_Priority, @Rule_Creation_Date, @Rule_Modify_Date)
//             `);
        
//         res.status(201).json({ id: result.recordset.insertId });
//     } catch (err) {
//         console.error("Error in the database:", err);
//         res.status(500).json({ error: "Database error" });
//     }
// };

exports.deleteRule = async (req, res) => {
    const ruleId = req.params.id;

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('RuleId', ruleId) // Input parameter
            .query('DELETE FROM Rules WHERE RuleId = @RuleId');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Rule not found" });
        }

        res.status(204).send();
    } catch (err) {
        console.error("Error deleting the rule:", err);
        res.status(500).json({ error: "Database error" });
    }
};;

// const cron = require('node-cron');

// exports.executeRules = (req, res) => {
//     pool.query("SELECT * FROM Rules", (error, results) => {
//         if (error) {
//             console.error("No data found in database", error);
//             return res.status(500).json({ error: "Error in database" });
//         }

//         const rulesArray = results;
//         console.log(rulesArray);
//         const specificValues = [];
//         let execQueries = [];

//         rulesArray.forEach(rule => {
//             const valuesString = `${rule.RuleId}, ${rule.Rule_Name}, ${rule.Rule_Action}`; 
//             specificValues.push(valuesString);
//             execQueries.push(`SELECT * FROM ${rule.Rule_Object} WHERE ${rule.Rule_Parameter} ${rule.Rule_Condition} ${rule.Rule_Value}`);
//         });

//         const job = cron.schedule('*/10 * * * *', () => {
//             execQueries.forEach(query => {
//                 pool.query(query, (error, queryResults) => {
//                     if (error) {
//                         console.error("No data fetched for query:", query, error);
//                     } else {
//                         console.log("Query results:", queryResults);
//                         queryResults.forEach(result => {
//                             const insertQuery = `
//                                 INSERT INTO ExecTable (ActionName, ActionMedia, Object, ObjId, RuleId)
//                                 VALUES (?, ?, ?, ?, ?)
//                             `;

//                             const values = [
//                                 result.ActionName,
//                                 result.ActionMedia, 
//                                 result.Object,      
//                                 result.ObjId,     
//                                 result.RuleId   
//                             ];

//                             pool.query(insertQuery, values, (error) => {
//                                 if (error) {
//                                     console.error("Error inserting into ExecTable:", error);
//                                 } else {
//                                     console.log("Inserted into ExecTable successfully.");
//                                 }
//                             });
//                         });
//                     }
//                 });
//             });
//         });

//         job.start();
//         res.json({ specificValues, message: 'Scheduled queries execution started.' });
//     });
// };




