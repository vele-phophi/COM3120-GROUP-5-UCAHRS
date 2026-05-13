const NOTIFICATION_MODE = process.env.NOTIFICATION_MODE || 'log';

// Only load nodemailer if we actually need to send emails
let transporter = null;
if (NOTIFICATION_MODE === 'email') {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

/**
 * Send a notification (email or log)
 * @param {string} identifier - University ID or email
 * @param {string} type - One of: 'BOOKING_CONFIRMED', 'RECORD_UPDATED', 'APPOINTMENT_CANCELLED'
 * @param {object} data - Additional data
 */
const sendNotification = async (identifier, type, data) => {
    const recipientEmail = identifier.includes('@')
        ? identifier
        : `${identifier}@mvula.univen.ac.za`;

    let subject = '';
    let messageBody = '';

    switch (type) {
        case 'BOOKING_CONFIRMED':
            subject = 'Appointment Confirmed – UNIVEN Clinic';
            messageBody = `Dear ${data.patientName},\n\nYour appointment on ${data.date} at ${data.time} is confirmed. Venue: UNIVEN Main Clinic.\n\nThank you.`;
            break;
        case 'RECORD_UPDATED':
            subject = 'Health Record Updated – UNIVEN Clinic';
            messageBody = `Your clinical record from ${data.date} has been finalised.\n\nLog in to the portal to view details.`;
            break;
        case 'APPOINTMENT_CANCELLED':
            subject = 'Appointment Cancelled – UNIVEN Clinic';
            messageBody = `Your appointment for ${data.date} has been cancelled.`;
            break;
        default:
            subject = 'UNIVEN Clinic Notification';
            messageBody = 'You have a new notification. Log in to view details.';
    }

    if (NOTIFICATION_MODE === 'log') {
        console.log(`\n📧 [DEV MODE] Would send email to: ${recipientEmail}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   Body: ${messageBody}\n`);
        return { success: true, mode: 'log' };
    }

    // Real email mode
    if (!transporter) {
        console.error('❌ Email mode selected but transporter not initialized. Check SMTP credentials.');
        return { success: false, error: 'SMTP not configured' };
    }

    try {
        const info = await transporter.sendMail({
            from: `"UNIVEN Clinic" <${process.env.SMTP_FROM || 'clinic@univen.ac.za'}>`,
            to: recipientEmail,
            subject,
            text: messageBody
        });
        console.log(`✅ Email sent to ${recipientEmail}`);
        return { success: true };
    } catch (err) {
        console.error('❌ Email send failed:', err.message);
        return { success: false, error: err.message };
    }
};

module.exports = sendNotification;