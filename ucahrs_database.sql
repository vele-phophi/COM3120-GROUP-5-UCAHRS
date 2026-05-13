-- ============================================================
--  UCAHRS – Corrected Database Schema
--  Compatible with backend controllers (students, staff, appointments, queue, prescriptions, health_records, notifications)
-- ============================================================

-- Drop existing tables (if you want a fresh start – comment out if not needed)
-- SET FOREIGN_KEY_CHECKS = 0;
-- DROP TABLE IF EXISTS notifications, health_records, prescriptions, queue, appointments, medical_records, staff, students;
-- SET FOREIGN_KEY_CHECKS = 1;

-- ==================== STUDENTS ====================
CREATE TABLE IF NOT EXISTS students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(100) NOT NULL,
    student_email VARCHAR(100) UNIQUE NOT NULL,
    student_number VARCHAR(20) UNIQUE NOT NULL,   -- universityID
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== STAFF ====================
CREATE TABLE IF NOT EXISTS staff (
    id INT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(100) NOT NULL,
    staff_email VARCHAR(100) UNIQUE NOT NULL,
    staff_id VARCHAR(20) UNIQUE NOT NULL,         -- universityID for staff
    role ENUM('doctor', 'nurse', 'admin') NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== APPOINTMENTS ====================
CREATE TABLE IF NOT EXISTS appointments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    doctor_id INT NOT NULL,
    date DATE NOT NULL,                           
    time TIME NOT NULL,                           
    reason TEXT,
    status VARCHAR(20) DEFAULT 'Pending',        
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- ==================== QUEUE ====================
CREATE TABLE IF NOT EXISTS queue (
    id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    student_id INT NOT NULL,
    status ENUM('waiting', 'in_progress', 'done') DEFAULT 'waiting',
    check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ==================== PRESCRIPTIONS ====================
CREATE TABLE IF NOT EXISTS prescriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    doctor_id INT NOT NULL,
    student_id INT NOT NULL,
    medication TEXT NOT NULL,
    instructions TEXT,
    issued_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ==================== HEALTH RECORDS (per appointment) ====================
CREATE TABLE IF NOT EXISTS health_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    temperature DECIMAL(4,1),
    blood_pressure VARCHAR(10),
    weight DECIMAL(5,2),
    diagnosis TEXT,
    prescription TEXT,
    medical_certificate_issued BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
);

-- ==================== MEDICAL RECORDS (student‑level static info) ====================
CREATE TABLE IF NOT EXISTS medical_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    blood_type VARCHAR(5),
    allergies TEXT,
    chronic_conditions TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ==================== NOTIFICATIONS ====================
CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    recipient_email VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);