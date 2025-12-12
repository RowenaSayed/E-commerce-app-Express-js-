const jwt = require('jsonwebtoken');
const User = require('../models/users');
const secret = process.env.JWT_SECRET ;

const auth = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
        try {
            const decoded = jwt.verify(token, secret);
            const user = await User.findById(decoded.id);
            if (!user) return res.status(401).json({ message: 'User not found' });

            req.user = { id: user._id.toString(), role: user.role };
        } catch (err) {
            return res.status(401).json({ message: 'Token is not valid' });
        }
    } else if (req.session && req.session.userId) {
        req.user = { id: req.session.userId, role: req.session.role || 'user' };
    } else {
        return res.status(401).json({ message: 'No token or session, authorization denied' });
    }

    next();
};


const authorize = (roles = []) => {
    if (typeof roles === 'string') roles = [roles];
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Access denied' });
        next();
    };
};

module.exports = { auth, authorize };
