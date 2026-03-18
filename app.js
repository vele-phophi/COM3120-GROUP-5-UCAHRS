const express = require('express');
const app = express();
const authRoutes = require('./auth/authRoutes'); 
const appointmentRoutes = require('./appointments/appointmentRoutes');

app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/appointments', appointmentRoutes);

app.listen(3000, () => {
    console.log("Server running. Auth system ready!");
});