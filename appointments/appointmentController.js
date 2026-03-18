const sendNotification = require('../utils/notificationEngine');

let appointments = [];

// Book a new appointment 
exports.bookAppointment = (req, res) => {
    
    const { patientName, userType, idNumber, date, time, reason } = req.body;

    const isSlotTaken = appointments.some(app => app.date === date && app.time === time);

    if (isSlotTaken) {
        return res.status(409).json({ 
            error: "Schedule Conflict", 
            message: `The slot at ${time} on ${date} is already booked. Please choose another time.` 
        });
    }

    const newAppointment = {
        id: appointments.length + 1,
        patientName,
        userType,      
        universityID: idNumber, 
        date,
        time,
        reason,
        healthRecord: {
            vitals: { temp: null, bp: null, weight: null },
            diagnosis: "",
            prescription: "",
            medicalCertificateIssued: false
        },
        status: "Checked In"
    };
        

    appointments.push(newAppointment);
    sendNotification(idNumber, 'BOOKING_CONFIRMED', newAppointment);

    res.status(201).json({ 
        message: `UNIVEN Clinic: Appointment booked for ${userType} successfully!`, 
        data: newAppointment 
    });
};

// View all appointments
exports.getAppointments = (req, res) => {
    res.status(200).json(appointments);
};

//  Cancel an appointment
exports.cancelAppointment = (req, res) => {
    const appointmentId = parseInt(req.params.id);
    const index = appointments.findIndex(a => a.id === appointmentId);

    if (index !== -1) {
        const cancelled = appointments.splice(index, 1);
        return res.status(200).json({ 
            message: "UNIVEN Clinic: Appointment successfully removed from schedule.", 
            data: cancelled[0] 
        });
    } else {
        return res.status(404).json({ message: "Error: Appointment record not found." });
    }
};

//  Record Vitals & Health Data
exports.updateHealthRecord = (req, res) => {
    const appointmentId = parseInt(req.params.id);
    const { temperature, bloodPressure, weight, diagnosis, medicalCertificate } = req.body;

    const appointment = appointments.find(a => a.id === appointmentId);

    if (appointment) {
        
        appointment.healthRecord = {
            vitals: { 
                temp: temperature || appointment.healthRecord.vitals.temp, 
                bp: bloodPressure || appointment.healthRecord.vitals.bp, 
                weight: weight || appointment.healthRecord.vitals.weight 
            },
            diagnosis: diagnosis || appointment.healthRecord.diagnosis,
            medicalCertificateIssued: medicalCertificate || false
        };
        
        appointment.status = "Completed"; 

        return res.status(200).json({ 
            message: "Health Record Updated for UNIVEN Student/Staff", 
            data: appointment 
        });
    } else {
        return res.status(404).json({ message: "Record not found." });
    }
};

//Get all slots for a specific date
exports.getAvailableSlots = (req, res) => {
    const { date } = req.query; 

    if (!date) {
        return res.status(400).json({ error: "Date required", message: "Please provide a date to check availability." });
    }


    const allSlots = [
        "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", 
        "11:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30"
    ];

    
    const bookedSlots = appointments
        .filter(app => app.date === date)
        .map(app => app.time);

    
    const availability = allSlots.map(slot => ({
        time: slot,
        status: bookedSlots.includes(slot) ? "Busy" : "Available"
    }));

    res.status(200).json({
        date,
        clinic: "UNIVEN Main Campus",
        slots: availability
    });
};