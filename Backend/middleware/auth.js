const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware to verify JWT token from Authorization header
 * Attaches decoded user data to req.user
 */
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; 
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired. Please login again.' });
        }
        res.status(403).json({ message: 'Invalid token.' });
    }
}

/**
 * Role-based access control middleware
 * @param {...string} allowedRoles 
 */
function allowRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized - no user context' });
        }
        const userRole = req.user.role;
        if (!userRole) {
            return res.status(403).json({ message: 'Forbidden - role not defined in token' });
        }
        if (allowedRoles.includes(userRole)) {
            next();
        } else {
            res.status(403).json({ 
                message: `Forbidden: '${userRole}' does not have access. Required: ${allowedRoles.join(', ')}`
            });
        }
    };
}

module.exports = { verifyToken, allowRoles };