// A simple list to act as our "User Database" for now
let users = [];

// REGISTER: Create a new account
exports.register = (req, res) => {
    const { email, password, role } = req.body; // role could be 'doctor' or 'admin'

    // Check if user already exists
    const userExists = users.find(u => u.email === email);
    if (userExists) {
        return res.status(400).json({ message: "User already exists!" });
    }

    const newUser = { id: users.length + 1, email, password, role };
    users.push(newUser);

    res.status(201).json({ 
        message: "User registered successfully!", 
        user: { email: newUser.email, role: newUser.role } 
    });
};

// LOGIN: Check credentials
exports.login = (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
    }

    res.status(200).json({ message: `Welcome back, ${user.role}!` });
};