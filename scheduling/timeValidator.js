
const isClinicOpen = (requestedTime) => {
    
    const [hours, minutes] = requestedTime.split(':').map(Number);
    
    const openingTime = 8; 
    const closingTime = 16.5; 

    const decimalTime = hours + (minutes / 60);

    return decimalTime >= openingTime && decimalTime <= closingTime;
};

module.exports = isClinicOpen;