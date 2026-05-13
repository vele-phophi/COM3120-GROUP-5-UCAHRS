const express = require('express');
const { verifyToken, allowRoles } = require('../middleware/auth');
const queueController = require('../queue/queueController');
const router = express.Router();

// Add a student to the queue (after check-in) – nurse or admin
router.post('/add', verifyToken, allowRoles('nurse', 'admin'), queueController.addToQueue);

// Get current queue – nurse, doctor, admin
router.get('/current', verifyToken, allowRoles('nurse', 'doctor', 'admin'), queueController.getCurrentQueue);

// Update queue status – nurse or admin
router.put('/:id/status', verifyToken, allowRoles('nurse', 'admin'), queueController.updateQueueStatus);

module.exports = router;