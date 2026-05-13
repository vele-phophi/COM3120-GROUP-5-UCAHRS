const db = require('../db');
const sendNotification = require('../utils/notificationEngine');

const ALL_SLOTS = [
    "08:00","08:30","09:00","09:30","10:00","10:30",
    "11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30"
];

function isValidDate(date) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(date));
}
function isValidTime(time) {
    return ALL_SLOTS.includes(time);
}
function isValidUniversityId(id) {
    return /^[A-Z0-9]{6,12}$/i.test(id);
}


// ==================== GET AVAILABLE SLOTS ====================
exports.getAvailableSlots = async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "Date required" });
    if (!isValidDate(date)) return res.status(400).json({ message: "Invalid date format" });

    try {
        const [booked] = await db.query(
            `SELECT time FROM appointments WHERE date = ? AND status != 'Cancelled'`,
            [date]
        );
        const bookedTimes = booked.map(b => b.time.substring(0,5));
        const slots = ALL_SLOTS.map(slot => ({
            time: slot,
            status: bookedTimes.includes(slot) ? 'Busy' : 'Available'
        }));
        res.json({ date, clinic: "UNIVEN Main Campus", slots });
    } catch (err) {
        console.error('getAvailableSlots error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// ==================== BOOK APPOINTMENT ====================
exports.bookAppointment = async (req, res) => {
    const { patientName, userType, idNumber, date, time, reason, doctor_id } = req.body;

    if (!patientName || !userType || !idNumber || !date || !time || !reason) {
        return res.status(400).json({ message: "All fields required" });
    }
    if (!isValidDate(date)) return res.status(400).json({ message: "Invalid date" });
    if (!isValidTime(time)) return res.status(400).json({ message: "Invalid time slot" });
    if (!isValidUniversityId(idNumber)) return res.status(400).json({ message: "Invalid university ID format" });
    if (date < new Date().toISOString().split('T')[0]) {
        return res.status(400).json({ message: "Cannot book appointments in the past" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Check if slot is already booked
        const [existingSlot] = await connection.query(
            `SELECT id FROM appointments WHERE date = ? AND time = ? AND status != 'Cancelled'`,
            [date, time]
        );
        if (existingSlot.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: `Slot at ${time} is already booked.` });
        }

        // 2. Find or create patient
        let patientId;
        const [existing] = await connection.query(
            `SELECT id FROM patients WHERE university_id = ?`, [idNumber]
        );
        if (existing.length > 0) {
            patientId = existing[0].id;
            await connection.query(
                `UPDATE patients SET full_name = ?, user_type = ? WHERE id = ?`,
                [patientName, userType, patientId]
            );
        } else {
            const [result] = await connection.query(
                `INSERT INTO patients (full_name, university_id, user_type, email) VALUES (?, ?, ?, ?)`,
                [patientName, idNumber, userType, `${idNumber}@mvula.univen.ac.za`]
            );
            patientId = result.insertId;
        }

        // 3. Insert appointment
        const [result] = await connection.query(
            `INSERT INTO appointments (patient_id, doctor_id, date, time, reason, status) VALUES (?, ?, ?, ?, ?, 'Pending')`,
            [patientId, doctor_id || null, date, time, reason]
        );
        const appointmentId = result.insertId;

        await connection.commit();

        // 4. Send notification
        try {
            sendNotification(idNumber, 'BOOKING_CONFIRMED', { patientName, date, time });
            await db.query(
                `INSERT INTO notifications (recipient_email, type, message) VALUES (?, ?, ?)`,
                [`${idNumber}@mvula.univen.ac.za`, 'BOOKING_CONFIRMED',
                 `Confirmed: ${patientName} on ${date} at ${time}. Venue: UNIVEN Main Clinic.`]
            );
        } catch (notifErr) {
            console.warn('Notification failed (non-critical):', notifErr.message);
        }

        res.status(201).json({
            message: "Appointment booked successfully! Status: Pending.",
            data: { id: appointmentId, patientName, userType, universityID: idNumber, date, time, reason, status: 'Pending' }
        });
    } catch (err) {
        await connection.rollback();
        console.error('bookAppointment error:', err);
        res.status(500).json({ message: "Server error while booking appointment." });
    } finally {
        connection.release();
    }
};
// ==================== UPDATE HEALTH RECORD ====================
exports.updateHealthRecord = async (req, res) => {
    const appointmentId = req.params.id;
    const { temperature, bloodPressure, weight, diagnosis, prescription, medicalCertificate } = req.body;
    const doctor_id = req.user.id;

    if (!diagnosis) return res.status(400).json({ message: "Diagnosis required" });

    try {
        // 1. Get appointment with patient_id
        const [appt] = await db.query(
            `SELECT a.id, a.patient_id, p.university_id 
             FROM appointments a
             JOIN patients p ON a.patient_id = p.id
             WHERE a.id = ?`,
            [appointmentId]
        );
        if (appt.length === 0) return res.status(404).json({ message: "Appointment not found" });

        const patientId = appt[0].patient_id;

        // 2. Save/update health record
        const [existing] = await db.query(
            `SELECT id FROM health_records WHERE appointment_id = ?`, [appointmentId]
        );
        if (existing.length > 0) {
            await db.query(`
                UPDATE health_records SET temperature = ?, blood_pressure = ?, weight = ?,
                    diagnosis = ?, prescription = ?, medical_certificate_issued = ?
                WHERE appointment_id = ?
            `, [temperature||null, bloodPressure||null, weight||null, diagnosis, prescription||null, medicalCertificate?1:0, appointmentId]);
        } else {
            await db.query(`
                INSERT INTO health_records (appointment_id, temperature, blood_pressure, weight, diagnosis, prescription, medical_certificate_issued)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [appointmentId, temperature||null, bloodPressure||null, weight||null, diagnosis, prescription||null, medicalCertificate?1:0]);
        }

        // 3. Save prescription using patient_id directly
        if (prescription) {
            await db.query(
                `INSERT INTO prescriptions (appointment_id, doctor_id, student_id, medication, instructions)
                 VALUES (?, ?, ?, ?, ?)`,
                [appointmentId, doctor_id, patientId, prescription, diagnosis]
            );
        }

        // 4. Mark appointment as completed
        await db.query(`UPDATE appointments SET status = 'Completed' WHERE id = ?`, [appointmentId]);
        res.json({ message: "Health record saved. Appointment marked as Completed." });
    } catch (err) {
        console.error('updateHealthRecord error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// ==================== GET MY APPOINTMENTS ====================
exports.getMyAppointments = async (req, res) => {
    const universityID = req.user.universityID;
    if (!universityID) return res.status(401).json({ message: "User ID not found in token" });
    try {
        const query = `
            SELECT a.*, s.full_name AS doctor_name
            FROM appointments a
            LEFT JOIN staff s ON a.doctor_id = s.id
            JOIN patients p ON a.patient_id = p.id
            WHERE p.university_id = ?
            ORDER BY a.date DESC, a.time DESC
        `;
        const [rows] = await db.query(query, [universityID]);
        res.json(rows);
    } catch (err) {
        console.error('getMyAppointments error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// ==================== CANCEL APPOINTMENT ====================
exports.cancelAppointment = async (req, res) => {
    const appointmentId = req.params.id;
    const isAdmin = req.user.role === 'admin';
    const universityID = req.user.universityID;

    try {
        const [appt] = await db.query(
            `SELECT id, status, patient_id FROM appointments WHERE id = ?`,
            [appointmentId]
        );
        if (appt.length === 0) return res.status(404).json({ message: "Appointment not found" });

        let isOwner = false;
        const [pat] = await db.query(
            `SELECT id FROM patients WHERE university_id = ? AND id = ?`,
            [universityID, appt[0].patient_id]
        );
        isOwner = pat.length > 0;

        if (!isAdmin && !isOwner) return res.status(403).json({ message: "Not authorised to cancel this appointment" });
        if (appt[0].status === 'Cancelled') return res.status(400).json({ message: "Appointment already cancelled" });
        if (appt[0].status === 'Completed') return res.status(400).json({ message: "Cannot cancel a completed appointment" });

        await db.query(`UPDATE appointments SET status = 'Cancelled' WHERE id = ?`, [appointmentId]);
        res.json({ message: "Appointment cancelled successfully" });
    } catch (err) {
        console.error('cancelAppointment error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// ==================== GET DOCTOR APPOINTMENTS ====================
exports.getDoctorAppointments = async (req, res) => {
    const doctorId = req.user.id;
    try {
        const [rows] = await db.query(`
            SELECT a.*, COALESCE(p.full_name, 'Staff Patient') AS patientName,
                   CASE WHEN p.id IS NOT NULL THEN 'Student' ELSE 'Staff' END AS userType
            FROM appointments a
            LEFT JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id = ? AND a.status != 'Cancelled'
            ORDER BY a.date, a.time
        `, [doctorId]);
        res.json(rows);
    } catch (err) {
        console.error('getDoctorAppointments error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// ==================== GET TODAY'S APPOINTMENTS (Nurse) ====================
exports.getTodaysAppointments = async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        const [rows] = await db.query(`
            SELECT a.*, COALESCE(p.full_name, 'Staff Patient') AS patient_name,
                   CASE WHEN p.id IS NOT NULL THEN 'Student' ELSE 'Staff' END AS patient_type
            FROM appointments a
            LEFT JOIN patients p ON a.patient_id = p.id
            WHERE a.date = ? AND a.status NOT IN ('Cancelled','Completed')
            ORDER BY a.time
        `, [today]);
        res.json(rows);
    } catch (err) {
        console.error('getTodaysAppointments error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// ==================== GET ALL APPOINTMENTS (Admin) ====================
exports.getAllAppointments = async (req, res) => {
    const { date, doctor_id, status } = req.query;
    let query = `
        SELECT a.*, COALESCE(p.full_name, 'Staff Patient') AS patientName,
               doc.full_name AS doctor_name
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN staff doc ON a.doctor_id = doc.id
        WHERE 1=1
    `;
    const params = [];
    if (date) { query += ' AND a.date = ?'; params.push(date); }
    if (doctor_id) { query += ' AND a.doctor_id = ?'; params.push(doctor_id); }
    if (status) { query += ' AND a.status = ?'; params.push(status); }
    query += ' ORDER BY a.date DESC, a.time DESC';

    try {
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('getAllAppointments error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// ==================== UPDATE APPOINTMENT STATUS ====================
exports.updateAppointmentStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const validStatus = ['Pending','Confirmed','Checked In','In Progress','Completed','Cancelled'];
    if (!validStatus.includes(status)) return res.status(400).json({ message: "Invalid status" });
    try {
        await db.query(`UPDATE appointments SET status = ? WHERE id = ?`, [status, id]);
        res.json({ message: "Status updated" });
    } catch (err) {
        console.error('updateAppointmentStatus error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// ==================== GET LIST OF DOCTORS ====================
exports.getDoctors = async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT id, full_name FROM staff WHERE role = 'doctor' ORDER BY full_name`);
        res.json(rows);
    } catch (err) {
        console.error('getDoctors error:', err);
        res.status(500).json({ message: "Server error" });
    }
};