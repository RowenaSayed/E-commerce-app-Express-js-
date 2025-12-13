const express = require('express');
const router = express.Router();
const { 
    createUser, 
    login, 
    getUserById, 
    updateUserById, 
    deleteUserById, 
    listUsers,
    socialLogin,
    verify2FA ,
    forgotPassword,
    resetPassword,
    verifyEmail
} = require('../controllers/users');

const { auth, authorize } = require('../middleware/auth');

// --- 1. 🛑 المسارات الثابتة (يجب أن تأتي أولاً) 🛑
router.post('/login', login);  
router.post('/register', createUser); 
router.post('/social-login', socialLogin); 
router.post('/verify-2fa', verify2FA);
router.post('/forgot-password',forgotPassword);
router.post('/reset-password/:token',resetPassword);
router.get('/verify/:token', verifyEmail); // ✅ تم نقل المسار الثابت هنا

// --- 2. 🛡️ المسارات المحمية العامة والخاصة ---
router.get('/', auth, authorize('admin'), listUsers); // الأدمن فقط يشوف كل اليوزرز (ثابت)

// --- 3. 🚀 المسارات الديناميكية (يجب أن تأتي أخيراً) 🚀
router.get('/:id', auth, getUserById); // المستخدم يشوف بياناته
router.put('/:id', auth, updateUserById);  // المستخدم يعدل بياناته
router.delete('/:id', auth, authorize('admin'), deleteUserById); // الأدمن يحذف


module.exports = router;