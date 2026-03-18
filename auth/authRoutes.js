const express = require('express');
const router = express.Router();
const authController = require('./authController');

// Define the paths
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;