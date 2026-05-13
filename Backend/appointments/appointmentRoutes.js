const express = require('express');
const { verifyToken, allowRoles } = require('../middleware/auth');
const appointmentController = require('../appointments/appointmentController');

const router = express.Router();

// Public / student endpoints
router.get('/availability', appointmentController.getAvailableSlots);
router.post('/book', verifyToken, allowRoles('student', 'staff'), appointmentController.bookAppointment);
router.get('/my', verifyToken, appointmentController.getMyAppointments);
router.delete('/cancel/:id', verifyToken, appointmentController.cancelAppointment);

// Doctor endpoints
router.get('/doctor', verifyToken, allowRoles('doctor'), appointmentController.getDoctorAppointments);
router.patch('/update-record/:id', verifyToken, allowRoles('doctor'), appointmentController.updateHealthRecord);

// Nurse endpoints
router.get('/today', verifyToken, allowRoles('nurse'), appointmentController.getTodaysAppointments);

// Admin endpoints (and shared)
router.get('/all', verifyToken, allowRoles('admin'), appointmentController.getAllAppointments);
router.patch('/:id/status', verifyToken, allowRoles('admin', 'doctor'), appointmentController.updateAppointmentStatus);
router.get('/doctors', verifyToken, appointmentController.getDoctors);

module.exports = router;