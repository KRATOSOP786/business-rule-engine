const  { poolPromise } = require('../dbconfig/dbconfig'); 
const { sendEmail } = require('../jobs/emailJob'); 
const { sendWhatsAppMessage } = require('../jobs/whatsappJob'); 

const insertIntoExecTable = async (rule, result, formattedRuleTime) => {
    try {
        const pool = await poolPromise;
        const insertQuery = `
            INSERT INTO ExecTable (ActionName, ActionMedia, Object, RuleId, RuleTime, Object_Comm, Object_Name, Object_Phone)
            VALUES (@ActionName, @ActionMedia, @Object, @RuleId, @RuleTime, @Object_Comm, @Object_Name, @Object_Phone)
        `;

        await pool.request()
            .input('ActionName', rule.Rule_Name)
            .input('ActionMedia', rule.Rule_Action)
            .input('Object', rule.Rule_Object)
            .input('RuleId', rule.RuleId)
            .input('RuleTime', formattedRuleTime)
            .input('Object_Comm', result.Email)  // Updated to Email
            .input('Object_Name', result.Sname)  // Updated to Sname
            .input('Object_Phone', result.Phone)   // Updated to Pobile
            .query(insertQuery);

        console.log("Inserted into ExecTable successfully.");
    } catch (error) {
        console.error("Error inserting into ExecTable:", error);
    }
};

const handleAction = async (rule, result) => {
        try {
            if (rule.Rule_Action === 'Email') {
                let subject, body;
    
                // Set different email subjects and bodies based on the rule
                if (rule.Rule_Name === 'Notify Resume Missing') {
                    subject = "Reminder: Please Upload Your Resume";
                    body = `Dear ${result.Sname},\n\nOur records show that your resume is missing from your profile. Please update your resume at your earliest convenience.\n\nThank you,\nTeam`;
                } else if (rule.Rule_Name === 'Notify To update') {
                    subject = "Reminder: Please Update your resume";
                    body = `Dear ${result.Sname},\n\nThis is a reminder to Update your Resume. Please log in to your account and finish the assigned lessons.\n\nBest regards,\nTeam`;
                } else {
                    subject = "General Reminder";
                    body = `Dear ${result.Sname},\n\nThis is a general reminder for an action based on the latest rules.\n\nRegards,\nTeam`;
                }
    
                // Send email with dynamic content
                await sendEmail(result.Email, subject, body);
                console.log(`Email sent to ${result.Email} with subject: ${subject}`);
                
        } else if (rule.Rule_Action === 'WhatsApp') {
            sendWhatsAppMessage(result.phone, 'Please update your resume. An action has been executed based on your rules.');
        }
    } catch (error) {
        console.error("Error handling action:", error);
    }
};

const executeRules = async () => {
    try {
        const pool = await poolPromise;
        const rulesQuery = "SELECT * FROM Rules";
        const rulesResult = await pool.request().query(rulesQuery);
        const rulesArray = rulesResult.recordset;

        console.log("Fetched rules:", rulesArray);

        const currentTime = new Date();  // Get the current time

        for (const rule of rulesArray) {
            let query;

            // Query the Students table based on rule criteria
            if (rule.Rule_Value === 'null' || rule.Rule_Value == null) {
                query = `SELECT * FROM ${rule.Rule_Object} WHERE ${rule.Rule_Parameter} IS NULL`;
            } else if (rule.Rule_Value === '') {
                query = `SELECT * FROM ${rule.Rule_Object} WHERE ${rule.Rule_Parameter} = ''`;
            } 
            else if (rule.Rule_Frequency) {
                // Split the frequency value (e.g., '1_minute' becomes '1' and 'minute')
                const [frequencyValue, frequencyUnit] = rule.Rule_Frequency.split('_');
                const datePart = frequencyUnit.toUpperCase();  // Convert to SQL-compatible format (MINUTE, HOUR, etc.)

                // Construct SQL query dynamically to filter based on the frequency
                query = `
                    SELECT * FROM ${rule.Rule_Object}
                    WHERE ${rule.Rule_Parameter} < DATEADD(${datePart}, -${frequencyValue}, GETDATE())`;
            } 
            else {
                query = `SELECT * FROM ${rule.Rule_Object} WHERE ${rule.Rule_Parameter} ${rule.Rule_Condition} @RuleValue`;
            }

            console.log("Constructed query:", query);

            // Fetch data from the Students table based on the constructed query
            const dataResult = await pool.request()
                .input('RuleValue', rule.Rule_Value)
                .query(query);

            const queryResults = dataResult.recordset;
            if (queryResults.length === 0) {
                console.log("No results found for query:", query);
                continue;
            }

            // For each student result, check ExecTable to see if the rule was executed recently
            for (const result of queryResults) {
                console.log("Preparing to check ExecTable for:", result);

                const checkQuery = `
                    SELECT TOP 1 RuleTime FROM ExecTable 
                    WHERE RuleId = @RuleId 
                    AND Object_Comm = @Object_Comm
                    ORDER BY RuleTime DESC`;

                const checkResult = await pool.request()
                    .input('RuleId', rule.RuleId)
                    .input('Object_Comm', result.Email)  
                    .query(checkQuery);

                const currentTimeString = currentTime.toISOString().slice(0, 19).replace('T', ' ');

                let isRuleExecuted = false;

                // Check if there's an existing execution record
                if (checkResult.recordset.length > 0) {
                    const lastExecutionTime = new Date(checkResult.recordset[0].RuleTime);

                    // Split the frequency value (e.g., '1_minute' becomes '1' and 'minute')
                    const [frequencyValue, frequencyUnit] = rule.Rule_Frequency.split('_');
                    const datePart = frequencyUnit.toUpperCase(); 

                    // Calculate the next execution time
                    const nextExecutionTimeQuery = `
                        SELECT DATEADD(${datePart}, ${frequencyValue}, @LastExecutionTime) AS NextExecutionTime`;

                    const nextExecutionResult = await pool.request()
                        .input('LastExecutionTime', lastExecutionTime)
                        .query(nextExecutionTimeQuery);

                    const nextExecutionTime = new Date(nextExecutionResult.recordset[0].NextExecutionTime);
                    console.log('this is next ecectime',nextExecutionTime);
                    console.log('this is next current_time',currentTime)

                    // Only execute the rule if it's due
                    if (currentTime >= nextExecutionTime) {
                        isRuleExecuted = true;
                        console.log("Rule is due for execution for:", result.Email);
                    } else {
                        console.log("Rule executed recently. Skipping execution for:", result.Email);
                        isRuleExecuted = false;
                    }
                } else {
                    // No previous execution found, so execute the rule
                    isRuleExecuted = true;
                    console.log("No previous execution found. Executing rule for:", result.Email);
                }

                if (isRuleExecuted) {
                    // Update if the record already exists, otherwise insert new record
                    if (checkResult.recordset.length > 0) {
                        // Update the existing entry in ExecTable
                        const updateExecTableQuery = `
                            UPDATE ExecTable
                            SET RuleTime = @RuleTime
                            WHERE RuleId = @RuleId
                            AND Object_Comm = @Object_Comm`;

                        await pool.request()
                            .input('RuleTime', currentTimeString)
                            .input('RuleId', rule.RuleId)
                            .input('Object_Comm', result.Email) 
                            .query(updateExecTableQuery);

                        console.log("Updated existing record in ExecTable for:", result.Email);

                    } else {
                        // Insert a new entry in ExecTable
                        await insertIntoExecTable(rule, result, currentTimeString);

                        console.log("Inserted new record into ExecTable for:", result.Email);
                    }

                    // Perform the action (e.g., sending an email)
                    await handleAction(rule, result);

                    // Update Rule_Action_Time in the Rules table to the current time
                    const updateRuleTimeQuery = `
                        UPDATE Rules
                        SET Rule_Action_Time = @RuleTime
                        WHERE RuleId = @RuleId`;

                    await pool.request()
                        .input('RuleTime', currentTimeString)
                        .input('RuleId', rule.RuleId)
                        .query(updateRuleTimeQuery);
                }
            }
        }
    } catch (error) {
        console.error("Error executing rules:", error);
    }
};


//------------------------------------------------------------------------------------------------------------
// const executeRules = async () => {
//     try {
//         const pool = await poolPromise;
//         const rulesQuery = "SELECT * FROM Rules";
//         const rulesResult = await pool.request().query(rulesQuery);
//         const rulesArray = rulesResult.recordset;

//         console.log("Fetched rules:", rulesArray);

//         const currentTime = new Date();  // Get the current time

//         for (const rule of rulesArray) {
//             let query;

//             //  Query the Students table based on rule criteria
//             if (rule.Rule_Value === 'null' || rule.Rule_Value == null) {
//                 query = `SELECT * FROM ${rule.Rule_Object} WHERE ${rule.Rule_Parameter} IS NULL`;
//             } else if (rule.Rule_Value === '') {
//                 query = `SELECT * FROM ${rule.Rule_Object} WHERE ${rule.Rule_Parameter} = ''`;
//             } 
//             else if (rule.Rule_Frequency) {
//                 // Split the frequency value (e.g., '1_minute' becomes '1' and 'minute')
//                 const [frequencyValue, frequencyUnit] = rule.Rule_Frequency.split('_');
//                 const datePart = frequencyUnit.toUpperCase();  // Convert to SQL-compatible format (MINUTE, HOUR, etc.)

//                 // Construct SQL query dynamically to filter based on the frequency
//                 query = `
//                     SELECT * FROM ${rule.Rule_Object}
//                     WHERE ${rule.Rule_Parameter} < DATEADD(${datePart}, -${frequencyValue}, GETDATE())`;
//             } 
//             else {
//                 query = `SELECT * FROM ${rule.Rule_Object} WHERE ${rule.Rule_Parameter} ${rule.Rule_Condition} @RuleValue`;
//             }

//             console.log("Constructed query:", query);

//             // Fetch data from the Students table based on the constructed query
//             const dataResult = await pool.request()
//                 .input('RuleValue', rule.Rule_Value)
//                 .query(query);

//             const queryResults = dataResult.recordset;
//             if (queryResults.length === 0) {
//                 console.log("No results found for query:", query);
//                 continue;
//             }

//             //  For each student result, check ExecTable to see if the rule was executed recently
//             for (const result of queryResults) {
//                 console.log("Preparing to check ExecTable for:", result);

//                 // Check if the rule was executed recently using SQL's DATEADD based on the rule's frequency
//                 const checkQuery = `
//                     SELECT TOP 1 RuleTime FROM ExecTable 
//                     WHERE RuleId = @RuleId 
//                     AND Object_Comm = @Object_Comm`;

//                 const checkResult = await pool.request()
//                     .input('RuleId', rule.RuleId)
//                     .input('Object_Comm', result.Email)  
//                     .query(checkQuery);

//                 const currentTimeString = currentTime.toISOString().slice(0, 19).replace('T', ' ');

//                 //  Check if there's an existing execution record
//                 if (checkResult.recordset.length > 0) {
//                     const lastExecutionTime = new Date(checkResult.recordset[0].RuleTime);

//                     console.log("Rule already executed. Updating ExecTable for:", result.Email);

//                     // Update the existing entry in ExecTable
//                     const updateExecTableQuery = `
//                         UPDATE ExecTable
//                         SET RuleTime = @RuleTime
//                         WHERE RuleId = @RuleId
//                         AND Object_Comm = @Object_Comm
//                     `;

//                     await pool.request()
//                         .input('RuleTime', currentTimeString)
//                         .input('RuleId', rule.RuleId)
//                         .input('Object_Comm', result.Email) 
//                         .query(updateExecTableQuery);

                    
//                     await handleAction(rule, result);
//                 } else {
//                     console.log("No previous execution found. Inserting into ExecTable for:", result.Email);

//                     // Insert a new entry in ExecTable
//                     await insertIntoExecTable(rule, result, currentTimeString);

                    
//                     await handleAction(rule, result);
//                 }

//                 //  Update Rule_Action_Time in the Rules table to the current time
//                 const updateRuleTimeQuery = `
//                     UPDATE Rules
//                     SET Rule_Action_Time = @RuleTime
//                     WHERE RuleId = @RuleId
//                 `;

//                 await pool.request()
//                     .input('RuleTime', currentTimeString)
//                     .input('RuleId', rule.RuleId)
//                     .query(updateRuleTimeQuery);
//             }
//         }
//     } catch (error) {
//         console.error("Error executing rules:", error);
//     }
// };

//----------------------------------------------------------------------------------------------------------------
const takeAction = async () => {
    try {
        const pool = await poolPromise;
        const resultDataQuery = 'SELECT * FROM ExecTable';
        const resultData = await pool.request().query(resultDataQuery);

        if (!resultData.recordset.length) {
            console.log("The resultset is empty. Please execute the fetch job.");
        } else {
            console.log("The result fetched:", resultData.recordset);
        }
    } catch (error) {
        console.error("Error occurred in takeAction:", error);
    }
};

module.exports = { executeRules, takeAction };

    //     const insertQuery = `
//         INSERT INTO ExecTable (ActionName, ActionMedia, Object, RuleId, RuleTime, Object_Comm, Object_Name, Object_Phone)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//     `;
//     const values = [
//         rule.Rule_Name,  
//         rule.Rule_Action,  
//         rule.Rule_Object,    
//         rule.RuleId,
//         formattedRuleTime, 
//         result.Email,
//         result.Sname,
//         result.Phone
//     ];

//     return new Promise((resolve, reject) => {
//         pool.query(insertQuery, values, (error) => { 
//             if (error) {
//                 console.error("Error inserting into ExecTable:", error);
//                 reject(error);
//             } else {
//                 console.log("Inserted into ExecTable successfully.");
//                 resolve();
//             }
//         });
//     });
// };

// const handleAction = async (rule, result) => {
//     if (rule.Rule_Action === 'Email') {
//         await sendEmail(  
//             result.Email, 
//             'Action Executed', 
//             'Please update your resume.'
//         );
//     } else if (rule.Rule_Action === 'WhatsApp') {
//         sendWhatsAppMessage(
//             result.Phone,
//             'Please update your resume. An action has been executed based on your rules.'
//         );
//     }
// };

// const executeRules = async () => {
//     pool.query("SELECT * FROM Rules", async (error, results) => {
//         if (error) {
//             console.error("Error fetching rules from database:", error);
//             return;
//         }

//         const rulesArray = results;
//         console.log("Fetched rules:", rulesArray);

//         for (const rule of rulesArray) {
//             let query;
//             const ruleTime = new Date(rule.Rule_Action_Time);
//             const formattedRuleTime = ruleTime.toISOString().slice(0, 19).replace('T', ' ');

//             // Construct the query based on rule value
//             if (rule.Rule_Value === 'null' || rule.Rule_Value == null) {
//                 query = `SELECT * FROM ${rule.Rule_Object} WHERE ${rule.Rule_Parameter} IS NULL`;
//             } else if (rule.Rule_Value === '') {
//                 query = `SELECT * FROM ${rule.Rule_Object} WHERE ${rule.Rule_Parameter} = ''`;
//             } else {
//                 query = `SELECT * FROM ${rule.Rule_Object} WHERE ${rule.Rule_Parameter} ${rule.Rule_Condition} ${pool.escape(rule.Rule_Value)}`;
//             }
//             console.log("Constructed query:", query);

//             pool.query(query, async (error, queryResults) => {
//                 if (error) {
//                     console.error("Error fetching data for query:", query, error);
//                     return; 
//                 }

//                 console.log("Query results:", queryResults);
//                 if (queryResults.length === 0) {
//                     console.log("No results found for query:", query);
//                     return;
//                 }

//                 for (const result of queryResults) {
//                     console.log("Preparing to insert into ExecTable:", result);
//                     const checkQuery = `
//                         SELECT * FROM ExecTable 
//                         WHERE RuleId = ? AND Object_Comm = ? AND RuleTime = ?
//                     `;
//                     const checkValues = [rule.RuleId, result.Email, formattedRuleTime];
                    
//                     pool.query(checkQuery, checkValues, async (error, checkResults) => {
//                         if (error) {
//                             console.error("Error checking ExecTable:", error);
//                         } else if (checkResults.length > 0) {
//                             console.log("Entry already exists in ExecTable. Skipping insert.");
//                         } else {
//                             try {
//                                 await insertIntoExecTable(rule, result, formattedRuleTime);
//                                 //await handleAction(rule, result); 
//                             } catch (error) {
//                                 console.error("Error handling action:", error);
//                             }
//                         }
//                     });
//                 }
//             });
//         }
//     });
// };

// const takeAction = async () => {
//     console.log("This is take action");
//     pool.query('SELECT * FROM ExecTable', async(error, result) => {
//         if(error){
//             console.log("An error occured",error);
//             return; 
//         }
//         const resultData = result;
//         if (resultData == "" || resultData == null){
//             console.log("The resultset in empty please execute the fetchjob");
//         }
//         console.log("The result fetched are:",result)
//     })
// }

// module.exports = {executeRules, takeAction};