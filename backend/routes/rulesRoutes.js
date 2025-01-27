const express = require('express');
const router = express.Router();
const ruleController = require('../controller/ruleController');

router.get("/", ruleController.fetchrules);
// router.get("/execute", ruleController.executeRules);
router.post("/create", ruleController.addRules);
router.delete("/delete/:id", ruleController.deleteRule);

module.exports = router;
