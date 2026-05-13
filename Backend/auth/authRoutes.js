const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Student registration
router.post('/register/student', async (req, res) => {
    const { full_name, student_email, password, student_number } = req.body;
    if (!full_name || !student_email || !password || !student_number) {
        return res.status(400).json({ message: 'All fields required (including student_number)' });
    }
    try {
        const hashed = await bcrypt.hash(password, 10);
        const [result] = await db.execute(
            'INSERT INTO students (full_name, student_email, password, student_number) VALUES (?, ?, ?, ?)',
            [full_name, student_email, hashed, student_number]
        );
        res.status(201).json({ message: 'Student registered successfully' });
    } catch (err) {
        console.error('Registration error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ message: 'Email or student number already exists' });
        } else {
            res.status(500).json({ message: 'Server error' });
        }
    }
});

// Staff registration (admin only, but for simplicity we allow)
router.post('/register/staff', async (req, res) => {
    const { full_name, staff_email, role, password, staff_id } = req.body;
    if (!full_name || !staff_email || !role || !password || !staff_id) {
        return res.status(400).json({ message: 'All fields required (including staff_id)' });
    }
    try {
        const hashed = await bcrypt.hash(password, 10);
        const [result] = await db.execute(
            'INSERT INTO staff (full_name, staff_email, role, password, staff_id) VALUES (?, ?, ?, ?, ?)',
            [full_name, staff_email, role, hashed, staff_id]
        );
        res.status(201).json({ message: 'Staff registered successfully' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ message: 'Email or staff ID already exists' });
        } else {
            res.status(500).json({ message: 'Server error' });
        }
    }
});

// GET all staff users (admin only – but for simplicity we allow if admin)
router.get('/users', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, full_name, staff_email AS email, role FROM staff ORDER BY id DESC'
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE a staff user by ID
router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'ID required' });
    try {
        const [result] = await db.execute('DELETE FROM staff WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'Staff member deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login (supports both student and staff)
router.post('/login', async (req, res) => {
    const { email, password, userType } = req.body; 
    if (!email || !password || !userType) {
        return res.status(400).json({ message: 'Email, password, and userType required' });
    }

    try {
        let user = null;
        let universityID = null;
        if (userType === 'student') {
            const [rows] = await db.execute('SELECT * FROM students WHERE student_email = ?', [email]);
            if (rows.length) {
                user = rows[0];
                universityID = user.student_number;
            }
        } else if (userType === 'staff') {
            const [rows] = await db.execute('SELECT * FROM staff WHERE staff_email = ?', [email]);
            if (rows.length) {
                user = rows[0];
                universityID = user.staff_id;
            }
        } else {
            return res.status(400).json({ message: 'Invalid userType' });
        }

        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

        // Prepare token payload including universityID
        let payload = {
            id: user.id,
            email: userType === 'student' ? user.student_email : user.staff_email,
            type: userType,
            role: userType === 'student' ? 'student' : user.role,
            universityID: universityID   
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

        res.json({
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: userType === 'student' ? user.student_email : user.staff_email,
                type: userType,
                role: payload.role,
                universityID: universityID   
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;