const express = require('express');
const router = express.Router();
const appointmentController = require('./appointmentController');
const validateAppointment = require('../validation/appointmentValidator');


router.post('/book', appointmentController.bookAppointment);
router.get('/list', appointmentController.getAppointments);
router.delete('/cancel/:id', appointmentController.cancelAppointment);
router.post('/book', validateAppointment, appointmentController.bookAppointment);
router.patch('/update-record/:id', appointmentController.updateHealthRecord);
router.get('/availability', appointmentController.getAvailableSlots);

module.exports = router;