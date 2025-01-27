const express = require('express');
const router = express.Router();
const studentController = require('../controller/studentController'); 
console.log('Student fetched');
router.get("/", studentController.fetchstudents);
module.exports = router;
