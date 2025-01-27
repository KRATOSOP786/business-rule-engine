const express = require('express');
const router = express.Router();
const executionController = require('../controller/executionController');

router.get("/", executionController.executeRules);

module.exports = router;
