

const sendNotification = (identifier, type, data) => {
    
    const timestamp = new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
    
    
    const recipientEmail = identifier.includes('@') ? identifier : `${identifier}@mvula.univen.ac.za`;

    let messageBody = "";

    //  What the message actually says
    switch (type) {
        case 'BOOKING_CONFIRMED':
            messageBody = `CONFIRMED: Appointment for ${data.patientName} on ${data.date} at ${data.time}. Venue: UNIVEN Main Clinic.`;
            break;
        case 'RECORD_UPDATED':
            messageBody = `HEALTH UPDATE: Your clinical record from ${data.date} has been finalized. Log in to the student portal to view.`;
            break;
        case 'APPOINTMENT_CANCELLED':
            messageBody = `CANCELLED: Your appointment for ${data.date} has been removed.`;
            break;
        default:
            messageBody = `UNIVEN Health Alert: You have a new notification.`;
    }

    //  For now, we "send" it to the console (Terminal)
    console.log(`\n--------------------------------------------------`);
    console.log(`[UNIVEN NOTIFICATION SYSTEM]`);
    console.log(`TO: ${recipientEmail}`);
    console.log(`MESSAGE: ${messageBody}`);
    console.log(`TIMESTAMP: ${timestamp}`);
    console.log(`--------------------------------------------------\n`);

    return { success: true, sentTo: recipientEmail };
};

module.exports = sendNotification;