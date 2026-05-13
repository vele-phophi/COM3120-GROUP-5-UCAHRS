const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

// Secret key for JWT - keep this private!
const JWT_SECRET = process.env.JWT_SECRET;


exports.register = async (req, res) => {
    const { email, password, role, full_name, university_id } = req.body; 

    // Validate required fields
    if (!email || !password || !role) {
        return res.status(400).json({ message: "Email, password and role are required." });
    }

    // Validate role
    const validRoles = ['doctor', 'nurse', 'admin'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Role must be doctor, nurse, or admin." });
    }

    try {
        // Check if user already exists
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "User with this email already exists!" });
        }

        // Hash the password before saving (10 salt rounds)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save new user to database (including university_id)
        const [result] = await db.query(
            'INSERT INTO users (email, password, role, full_name, university_id) VALUES (?, ?, ?, ?, ?)',
            [email, hashedPassword, role, full_name || null, university_id || null]
        );

        res.status(201).json({
            message: "User registered successfully!",
            user: { id: result.insertId, email, role }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: "Server error during registration." });
    }
};


exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    try {
    
        const [users] = await db.query(
            'SELECT id, email, role, full_name, university_id FROM users WHERE email = ?',
            [email]
        );
        if (users.length === 0) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        const user = users[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        // Generate JWT token with universityID
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role,
                universityID: user.university_id   
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.status(200).json({
            message: `Welcome back, ${user.full_name || user.role}!`,
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                full_name: user.full_name,
                universityID: user.university_id   
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: "Server error during login." });
    }
};

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Access denied. Please log in." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ message: "Invalid or expired token. Please log in again." });
    }
};

exports.requireRole = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: `Access denied. Only ${roles.join(' or ')} can access this.` 
            });
        }
        next();
    };
};