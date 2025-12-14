const jwt = require('jsonwebtoken');
const User = require('../models/users');
const secret = process.env.JWT_SECRET;

async function auth(req, res, next) {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (token) {
            const decoded = jwt.verify(token, secret);
            const user = await User.findById(decoded.id);
            if (!user) return res.status(401).json({ message: 'User not found' });
            req.user = { id: user._id.toString(), role: user.role };
            return next();
        }

        if (req.session) {
            return next();
        }

        return res.status(401).json({ message: 'No token or session, authorization denied' });

    } catch (err) {
        return res.status(401).json({ message: 'Token is not valid or session error' });
    }
}

function authorize(roles = []) {
    if (typeof roles === 'string') roles = [roles];

    return (req, res, next) => {
        if (!roles.length) return next();
        if (!req.user) return res.status(401).json({ message: 'No user info found for authorization' });
        if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Access denied' });
        next();
    };
}

module.exports = { auth, authorize };
