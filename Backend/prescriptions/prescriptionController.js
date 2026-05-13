// ============================================================
//  UCAHRS - Prescription Controller
// ============================================================
const db = require('../db');

// Helper to get student's database ID from universityID (student_number)
async function getStudentIdByUniversityId(universityID) {
    const [rows] = await db.query(
        'SELECT id FROM students WHERE student_number = ?',
        [universityID]
    );
    return rows.length ? rows[0].id : null;
}

// Doctor issues a prescription
exports.createPrescription = async (req, res) => {
    const { appointment_id, universityID, medication, instructions } = req.body;
    const doctor_id = req.user.id; // from JWT (staff.id)

    if (!appointment_id || !universityID || !medication) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        // Get student's internal ID from their universityID
        const studentId = await getStudentIdByUniversityId(universityID);
        if (!studentId) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const [result] = await db.execute(
            `INSERT INTO prescriptions (appointment_id, doctor_id, student_id, medication, instructions)
             VALUES (?, ?, ?, ?, ?)`,
            [appointment_id, doctor_id, studentId, medication, instructions || null]
        );
        res.status(201).json({ 
            message: 'Prescription saved', 
            prescriptionId: result.insertId 
        });
    } catch (err) {
        console.error('createPrescription error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get prescriptions for the logged‑in student
exports.getMyPrescriptions = async (req, res) => {
    const universityID = req.user.universityID;
    try {
        const [rows] = await db.execute(
            `SELECT p.*, s.full_name as doctor_name 
             FROM prescriptions p
             JOIN staff s ON p.doctor_id = s.id
             JOIN patients pat ON p.student_id = pat.id
             WHERE pat.university_id = ?
             ORDER BY p.issued_date DESC`,
            [universityID]
        );
        res.json(rows);
    } catch (err) {
        console.error('getMyPrescriptions error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get prescriptions for a specific student (doctor or admin access)
exports.getPrescriptionsByStudent = async (req, res) => {
    const { studentId } = req.params; // database id, not universityID
    // Only role 'doctor' or 'admin' can use this endpoint
    if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
    }

    try {
        const [rows] = await db.execute(
            `SELECT p.*, s.full_name as doctor_name 
             FROM prescriptions p
             JOIN staff s ON p.doctor_id = s.id
             WHERE p.student_id = ?
             ORDER BY p.issued_date DESC`,
            [studentId]
        );
        res.json(rows);
    } catch (err) {
        console.error('getPrescriptionsByStudent error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getMyHealthRecord = async (req, res) => {
    const universityID = req.user.universityID;
    try {
        const studentId = await getStudentIdByUniversityId(universityID);
        if (!studentId) return res.status(404).json({ message: 'Student not found' });

        const [rows] = await db.query(`
            SELECT hr.*, a.date, a.reason, s.full_name AS doctor_name
            FROM health_records hr
            JOIN appointments a ON hr.appointment_id = a.id
            JOIN patients p ON a.patient_id = p.id
            JOIN students stu ON stu.student_number = p.university_id
            LEFT JOIN staff s ON a.doctor_id = s.id
            WHERE stu.id = ?
            ORDER BY a.date DESC
            LIMIT 1
        `, [studentId]);

        if (!rows.length) return res.status(404).json({ message: 'No health record found' });
        res.json(rows[0]);
    } catch (err) {
        console.error('getMyHealthRecord error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};