// ============================================================
//  UCAHRS - Queue Controller
// ============================================================
const db = require('../db');

// Helper: Get student's database ID from universityID (student_number)
async function getStudentIdByUniversityId(universityID) {
    const [rows] = await db.query(
        'SELECT id FROM students WHERE student_number = ?',
        [universityID]
    );
    return rows.length ? rows[0].id : null;
}

// Add a student to the queue (after check-in) – nurse or admin
exports.addToQueue = async (req, res) => {
    const { appointment_id, universityID } = req.body;
    if (!appointment_id || !universityID) {
        return res.status(400).json({ message: 'Appointment ID and university ID required' });
    }

    try {
        const studentId = await getStudentIdByUniversityId(universityID);
        if (!studentId) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check if already in queue
        const [existing] = await db.query(
            'SELECT id FROM queue WHERE student_id = ? AND status IN ("waiting", "in_progress")',
            [studentId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Student already in queue' });
        }

        await db.execute(
            'INSERT INTO queue (appointment_id, student_id, status) VALUES (?, ?, "waiting")',
            [appointment_id, studentId]
        );
        res.status(201).json({ message: 'Added to queue' });
    } catch (err) {
        console.error('addToQueue error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get current queue (nurse/doctor/admin view)
exports.getCurrentQueue = async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT q.*, stu.full_name, stu.student_number
             FROM queue q
             JOIN students stu ON q.student_id = stu.id
             WHERE q.status IN ('waiting', 'in_progress')
             ORDER BY q.check_in_time ASC`
        );
        res.json(rows);
    } catch (err) {
        console.error('getCurrentQueue error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update queue status (nurse calls next patient)
exports.updateQueueStatus = async (req, res) => {
    const { status } = req.body;
    const queueId = req.params.id;
    if (!['waiting', 'in_progress', 'done'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }
    try {
        await db.execute('UPDATE queue SET status = ? WHERE id = ?', [status, queueId]);
        res.json({ message: 'Queue status updated' });
    } catch (err) {
        console.error('updateQueueStatus error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};