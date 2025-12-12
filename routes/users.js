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
    resetPassword
} = require('../controllers/users'); // تأكدي إن اسم ملف الكونترولر users.js

const { auth, authorize } = require('../middleware/auth'); // الميدل وير بتاعنا

// --- Public Routes (متاحة للجميع) ---
router.post('/register', createUser);      // إنشاء حساب
router.post('/login', login);              // تسجيل دخول
router.post('/social-login', socialLogin); // تسجيل دخول سوشيال
router.post('/verify-2fa', verify2FA);     // التحقق من كود OTP
router.post('/forgot-password',forgotPassword);
router.post('/reset-password/:token',resetPassword);
router.get('/', auth, authorize('admin'), listUsers); // الأدمن فقط يشوف كل اليوزرز
router.get('/:id', auth, getUserById);                // المستخدم يشوف بياناته
router.put('/:id', auth, updateUserById);             // المستخدم يعدل بياناته
router.delete('/:id', auth, authorize('admin'), deleteUserById); // الأدمن يحذف

module.exports = router;