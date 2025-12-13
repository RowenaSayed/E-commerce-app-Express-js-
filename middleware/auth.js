const jwt = require('jsonwebtoken');
const User = require('../models/users');
const secret = process.env.JWT_SECRET;

// دالة المصادقة (Auth Middleware)
async function auth(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
        try {
            const decoded = jwt.verify(token, secret);
            const user = await User.findById(decoded.id);

            if (!user) {
                return res.status(401).json({ message: 'User not found' });
            }

            req.user = { id: user._id.toString(), role: user.role };
            
            return next(); 
        } catch (err) {
            // إذا فشل التحقق من التوكن (انتهت صلاحيته أو غير صحيح).
            return res.status(401).json({ message: 'Token is not valid' });
        }
    } else if (req.session && req.session.userId) {
        // حالة التحقق من الجلسة (إذا كان موجوداً)
        req.user = { id: req.session.userId, role: req.session.role || 'user' };
        return next();
    } else {
        // إذا لم يتم إرسال توكن أو جلسة.
        return res.status(401).json({ message: 'No token or session, authorization denied' });
    }
}


// دالة التفويض (Authorize Middleware)
function authorize(roles = []) { // 🚀 دالة عادية
    if (typeof roles === 'string') roles = [roles];
    
    // 🚀 دالة داخلية عادية (Anonymous Function)
    return function (req, res, next) { 
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        return next();
    };
}

module.exports = { auth, authorize };