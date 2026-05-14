const db = require('../db');
const sendNotification = require('../utils/notificationEngine');

const ALL_SLOTS = [
    "08:00","08:30","09:00","09:30","10:00","10:30",
    "11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30"
];

function isValidDate(date) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(date)); }
function isValidTime(time) { return ALL_SLOTS.includes(time); }
function isValidUniversityId(id) { return /^[A-Z0-9]{6,12}$/i.test(id); }

// Helper to get a default doctor ID (first doctor in staff table)
async function getDefaultDoctorId() {
    const [rows] = await db.query(`SELECT id FROM staff WHERE role = 'doctor' ORDER BY id LIMIT 1`);
    if (rows.length === 0) throw new Error("No doctor available");
    return rows[0].id;
}

// ==================== AVAILABLE SLOTS ====================
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
    
    // Validate inputs
    if (!patientName || !userType || !idNumber || !date || !time || !reason) {
        return res.status(400).json({ message: "All fields required" });
    }
    if (!isValidDate(date)) return res.status(400).json({ message: "Invalid date" });
    if (!isValidTime(time)) return res.status(400).json({ message: "Invalid time slot" });
    if (!isValidUniversityId(idNumber)) return res.status(400).json({ message: "Invalid ID format" });
    if (date < new Date().toISOString().split('T')[0]) {
        return res.status(400).json({ message: "Cannot book appointments in the past" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Check slot availability
        const [existing] = await connection.query(
            `SELECT id FROM appointments WHERE date = ? AND time = ? AND status != 'Cancelled'`,
            [date, time]
        );
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: `Slot at ${time} on ${date} is already booked.` });
        }

        // 2. Find or create student (patient)
        let studentId;
        if (userType === 'Student') {
            let [rows] = await connection.query(
                `SELECT id FROM students WHERE student_number = ?`,
                [idNumber]
            );
            if (rows.length > 0) {
                studentId = rows[0].id;
                // Optionally update name if changed
                await connection.query(
                    `UPDATE students SET full_name = ? WHERE id = ?`,
                    [patientName, studentId]
                );
            } else {
                const [result] = await connection.query(
                    `INSERT INTO students (full_name, student_number, student_email, password) VALUES (?, ?, ?, ?)`,
                    [patientName, idNumber, `${idNumber}@univen.ac.za`, ''] // empty password; they must register separately
                );
                studentId = result.insertId;
            }
        } else { // Staff as patient – store in staff table with role 'patient'
            let [rows] = await connection.query(
                `SELECT id FROM staff WHERE staff_id = ?`,
                [idNumber]
            );
            if (rows.length > 0) {
                studentId = rows[0].id;
                await connection.query(
                    `UPDATE staff SET full_name = ? WHERE id = ?`,
                    [patientName, studentId]
                );
            } else {
                const [result] = await connection.query(
                    `INSERT INTO staff (full_name, staff_id, role, staff_email, password) VALUES (?, ?, ?, ?, ?)`,
                    [patientName, idNumber, 'patient', `${idNumber}@univen.ac.za`, '']
                );
                studentId = result.insertId;
            }
        }

        // 3. Determine doctor ID – use provided one, or assign a default
        let finalDoctorId = doctor_id;
        if (!finalDoctorId) {
            finalDoctorId = await getDefaultDoctorId();
        }

        // 4. Create appointment
        const [result] = await connection.query(
            `INSERT INTO appointments (student_id, doctor_id, date, time, reason, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [studentId, finalDoctorId, date, time, reason, 'Pending']
        );
        const appointmentId = result.insertId;

        await connection.commit();

        // 5. Send notification (outside transaction)
        sendNotification(idNumber, 'BOOKING_CONFIRMED', { patientName, date, time });
        await db.query(
            `INSERT INTO notifications (recipient_email, type, message) VALUES (?, ?, ?)`,
            [`${idNumber}@univen.ac.za`, 'BOOKING_CONFIRMED',
             `Confirmed: ${patientName} on ${date} at ${time}. Venue: UNIVEN Main Clinic.`]
        );

        res.status(201).json({
            message: "Appointment booked successfully! Status: Pending.",
            data: {
                id: appointmentId,
                patientName,
                userType,
                universityID: idNumber,
                date,
                time,
                reason,
                status: 'Pending'
            }
        });
    } catch (err) {
        await connection.rollback();
        console.error('bookAppointment error:', err);
        res.status(500).json({ message: "Server error while booking appointment." });
    } finally {
        connection.release();
    }
};

// ==================== GET MY APPOINTMENTS (Student) ====================
exports.getMyAppointments = async (req, res) => {
    const universityID = req.user.universityID;
    if (!universityID) {
        return res.status(401).json({ message: "No university ID in token" });
    }
    try {
        const [rows] = await db.query(`
            SELECT a.*, s.full_name AS doctor_name
            FROM appointments a
            JOIN staff s ON a.doctor_id = s.id
            JOIN students stu ON a.student_id = stu.id
            WHERE stu.student_number = ?
            ORDER BY a.date DESC, a.time DESC
        `, [universityID]);
        res.json(rows);
    } catch (err) {
        console.error('getMyAppointments error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// ==================== CANCEL APPOINTMENT ====================
exports.cancelAppointment = async (req, res) => {
    const appointmentId = req.params.id;
    const universityID = req.user.universityID;
    const isAdmin = req.user.role === 'admin';

    try {
        const [appt] = await db.query(`
            SELECT a.id, a.status,
                   CASE WHEN stu.id IS NOT NULL AND stu.student_number = ? THEN 1 ELSE 0 END AS is_owner
            FROM appointments a
            JOIN students stu ON a.student_id = stu.id
            WHERE a.id = ?
        `, [universityID, appointmentId]);

        if (appt.length === 0) {
            return res.status(404).json({ message: "Appointment not found" });
        }
        if (!isAdmin && !appt[0].is_owner) {
            return res.status(403).json({ message: "Not authorised to cancel this appointment" });
        }
        if (appt[0].status === 'Completed') {
            return res.status(400).json({ message: "Cannot cancel a completed appointment" });
        }
        if (appt[0].status === 'Cancelled') {
            return res.status(400).json({ message: "Appointment already cancelled" });
        }

        await db.query(`UPDATE appointments SET status = 'Cancelled' WHERE id = ?`, [appointmentId]);
        res.json({ message: "Appointment cancelled successfully" });
    } catch (err) {
        console.error('cancelAppointment error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// ==================== GET ALL APPOINTMENTS (Admin) ====================
exports.getAllAppointments = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT a.*,
                   stu.full_name AS patientName,
                   stu.student_number AS universityID,
                   'Student' AS userType,
                   doc.full_name AS doctorName
            FROM appointments a
            JOIN students stu ON a.student_id = stu.id
            JOIN staff doc ON a.doctor_id = doc.id
            ORDER BY a.date DESC, a.time DESC
        `);
        // Format dates
        const formatted = rows.map(row => ({
            ...row,
            date: row.date ? row.date.toISOString().split('T')[0] : null,
            time: row.time ? row.time.substring(0,5) : null
        }));
        res.json(formatted);
    } catch (err) {
        console.error('getAllAppointments error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// ==================== UPDATE HEALTH RECORD (Doctor) ====================
exports.updateHealthRecord = async (req, res) => {
    const appointmentId = req.params.id;
    const { temperature, bloodPressure, weight, diagnosis, prescription, medicalCertificate } = req.body;

    if (!diagnosis) return res.status(400).json({ message: "Diagnosis required" });

    try {
        const [appt] = await db.query(`SELECT id FROM appointments WHERE id = ?`, [appointmentId]);
        if (appt.length === 0) return res.status(404).json({ message: "Appointment not found" });

        const [existing] = await db.query(`SELECT id FROM health_records WHERE appointment_id = ?`, [appointmentId]);
        if (existing.length > 0) {
            await db.query(`
                UPDATE health_records SET
                    temperature = ?, blood_pressure = ?, weight = ?,
                    diagnosis = ?, prescription = ?, medical_certificate_issued = ?
                WHERE appointment_id = ?
            `, [temperature || null, bloodPressure || null, weight || null,
               diagnosis, prescription || null, medicalCertificate ? 1 : 0, appointmentId]);
        } else {
            await db.query(`
                INSERT INTO health_records
                (appointment_id, temperature, blood_pressure, weight, diagnosis, prescription, medical_certificate_issued)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [appointmentId, temperature || null, bloodPressure || null,
               weight || null, diagnosis, prescription || null, medicalCertificate ? 1 : 0]);
        }

        // Mark appointment as Completed
        await db.query(`UPDATE appointments SET status = 'Completed' WHERE id = ?`, [appointmentId]);

        // Notify patient
        const [patientInfo] = await db.query(`
            SELECT stu.student_number AS uni_id
            FROM appointments a
            JOIN students stu ON a.student_id = stu.id
            WHERE a.id = ?
        `, [appointmentId]);
        if (patientInfo.length > 0 && patientInfo[0].uni_id) {
            sendNotification(patientInfo[0].uni_id, 'RECORD_UPDATED', { date: new Date().toLocaleDateString() });
        }

        res.json({ message: "Health record saved. Appointment marked as Completed." });
    } catch (err) {
        console.error('updateHealthRecord error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// ==================== GET TODAY'S APPOINTMENTS (Nurse) ====================
exports.getTodaysAppointments = async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        const [rows] = await db.query(`
            SELECT a.*, stu.full_name AS patient_name, 'Student' AS patient_type
            FROM appointments a
            JOIN students stu ON a.student_id = stu.id
            WHERE a.date = ? AND a.status NOT IN ('Cancelled','Completed')
            ORDER BY a.time
        `, [today]);
        res.json(rows);
    } catch (err) {
        console.error('getTodaysAppointments error:', err);
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