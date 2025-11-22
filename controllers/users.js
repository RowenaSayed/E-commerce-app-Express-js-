const User = require('../models/users');
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET;

const createUser = async (req, res) => {
    try {
        const { name, email, phone, password, role } = req.body;
        if (!name || !email || !phone || !password || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already exists' });
        if (await User.findOne({ phone })) return res.status(400).json({ message: 'Phone already exists' });

        const newUser = new User(req.body);
        await newUser.save();

        res.status(201).json({ message: 'User created successfully', user: newUser });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.comparePassword(password, (err, isMatch) => {
            if (err) return res.status(500).json({ message: 'Server Error', err });
            if (!isMatch) return res.status(400).json({ message: 'Invalid password' });

            const token = jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '1d' });
            res.status(200).json({ message: 'Login successful', token, user });
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

const updateUserById = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ message: 'User updated successfully', user });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

const deleteUserById = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

const listUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json({ users });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

module.exports = {
    createUser,
    login,
    getUserById,
    updateUserById,
    deleteUserById,
    listUsers
};
