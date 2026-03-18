const isClinicOpen = require('../scheduling/timeValidator');

const validateAppointment = (req, res, next) => {
    const { patientName, userType, idNumber, date, reason } = req.body;

    // Check if name is missing 
    if (!patientName || patientName.length < 3) {
        return res.status(400).json({ 
            error: "Invalid Name", 
            message: "Patient name must be at least 3 characters long." 
        });
    }

    // Check if User Type is valid 
    const validTypes = ['Student', 'Staff'];
    if (!userType || !validTypes.includes(userType)) {
        return res.status(400).json({ 
            error: "Invalid User Type", 
            message: "Please specify if you are a Student or Staff member." 
        });
    }

    //  Check if ID/Student Number is provided
    if (!idNumber) {
        return res.status(400).json({ 
            error: "Missing ID", 
            message: "Please provide your Student Number or Staff ID." 
        });
    }

    // Check if the date is provided
    if (!date) {
        return res.status(400).json({ error: "Missing Date", message: "Please provide an appointment date." });
    }

    // Check if reason is provided
    if (!reason) {
        return res.status(400).json({ error: "Missing Reason", message: "Please state the reason for the visit." });
    }

    // Check if Time is provided
    if (!time) {
        return res.status(400).json({ error: "Missing Time", message: "Please select a time for your appointment." });
    }

    // Check if the Clinic is actually open at that time
    if (!isClinicOpen(time)) {
        return res.status(400).json({ 
            error: "Clinic Closed", 
            message: "The UNIVEN Clinic is open from 08:00 to 16:30. Please choose a time within these hours." 
        });
    }
    
    next();
};

module.exports = validateAppointment;