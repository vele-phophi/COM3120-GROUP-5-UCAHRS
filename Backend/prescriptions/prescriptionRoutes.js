const express = require('express');
const { verifyToken, allowRoles } = require('../middleware/auth');
const prescriptionController = require('../prescriptions/prescriptionController');
const router = express.Router();

// Doctor issues a prescription (requires doctor role)
router.post('/', verifyToken, allowRoles('doctor'), prescriptionController.createPrescription);

// Student views their own prescriptions
router.get('/my', verifyToken, allowRoles('student'), prescriptionController.getMyPrescriptions);

// Doctor or admin views prescriptions for a specific student (by student's database id)
router.get('/student/:studentId', verifyToken, allowRoles('doctor', 'admin'), prescriptionController.getPrescriptionsByStudent);

router.get('/health-record', verifyToken, allowRoles('student'), prescriptionController.getMyHealthRecord);

module.exports = router;