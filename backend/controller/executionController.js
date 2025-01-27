const pool = require('../dbconfig/dbconfig');
exports.executeRules = (req, res) => {
    pool.query("SELECT * FROM Rules", (error, results)=>{
        if(error){
            console.error("No data found in database",error);
            return res.status(500).json({error:"Error in database"});
        }
        res.json(results);
    });
};

