const path = require('path');
process.env.DOTENV_CONFIG_PATH = './Backend/.env';
require('dotenv').config({ 
    path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

const authRoutes = require('./auth/authRoutes');
const appointmentRoutes = require('./appointments/appointmentRoutes');
const queueRoutes = require('./queue/queueRoutes');
const prescriptionRoutes = require('./prescriptions/prescriptionRoutes');

const app = express();

// CORS configuration – allow only your frontend origin in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // for form data support

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../Frontend')));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../Frontend/index.html"));
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/prescriptions', prescriptionRoutes);

// Health check endpoint (useful for monitoring)
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Catch-all for undefined API routes (404)
app.use('/api/*', (req, res) => {
    res.status(404).json({ message: 'API endpoint not found' });
});

// Global error handler (optional but recommended)
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});