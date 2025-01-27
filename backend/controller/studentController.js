const pool = require('../dbconfig/dbconfig');

exports.fetchstudents = (req, res) => {
    pool.query("SELECT * FROM Students", (error, result) => {
        if (error){
            console.error('No data found:', error);
            return res.status(500).json({error:'Database Error'});
        }
        res.json(result);
    });
};