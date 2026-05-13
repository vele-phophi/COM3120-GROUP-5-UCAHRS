const isClinicOpen = require('../scheduling/timeValidator');

const validateAppointment = (req, res, next) => {
    const { patientName, userType, idNumber, date, time, reason } = req.body; // added 'time'

    // Name validation
    if (!patientName || patientName.trim().length < 3) {
        return res.status(400).json({ 
            error: "Invalid Name", 
            message: "Patient name must be at least 3 characters long." 
        });
    }

    // User type validation
    const validTypes = ['Student', 'Staff'];
    if (!userType || !validTypes.includes(userType)) {
        return res.status(400).json({ 
            error: "Invalid User Type", 
            message: "Please specify if you are a Student or Staff member." 
        });
    }

    // ID validation
    if (!idNumber) {
        return res.status(400).json({ 
            error: "Missing ID", 
            message: "Please provide your Student Number or Staff ID." 
        });
    }

    // Date validation
    if (!date) {
        return res.status(400).json({ error: "Missing Date", message: "Please provide an appointment date." });
    }

    // Time validation
    if (!time) {
        return res.status(400).json({ error: "Missing Time", message: "Please select a time for your appointment." });
    }

    // Reason validation
    if (!reason) {
        return res.status(400).json({ error: "Missing Reason", message: "Please state the reason for the visit." });
    }

    // Clinic hours check (optional – your controller already checks ALL_SLOTS)
    if (!isClinicOpen(time)) {
        return res.status(400).json({ 
            error: "Clinic Closed", 
            message: "The UNIVEN Clinic is open from 08:00 to 16:30. Please choose a time within these hours." 
        });
    }
    
    next();
};

module.exports = validateAppointment;