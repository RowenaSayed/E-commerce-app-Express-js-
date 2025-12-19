const express = require('express');
const router = express.Router();
const Governate = require('../models/governates');

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
    verifyEmail,
    toggleBanUser,
    updateUser,
    reviewUserStatus,
    addNewAddress,
    updateAddress,
    deleteAddress,
    getSavedAddresses,
    updateSellerStatus,getUsers
} = require('../controllers/users');

const { auth, authorize } = require('../middleware/auth');
const upload = require('../utilities/fileUpload');

// --- 1. 🛑 المسارات الثابتة (يجب أن تأتي أولاً) 🛑
router.post('/login', login);  
router.post('/register', createUser); 
router.post('/social-login', socialLogin); 
router.post('/verify-2fa', verify2FA);
router.post('/forgot-password',forgotPassword);
router.put('/reset-password/:token',resetPassword);
router.get('/verify/:token', verifyEmail); // ✅ تم نقل المسار الثابت هنا

// --- 2. 🛡️ المسارات المحمية العامة والخاصة ---
router.get('/', auth, authorize('admin'), listUsers); // الأدمن فقط يشوف كل اليوزرز (ثابت)
router.put('/profile',upload.single('profilePicture'), auth, updateUser); // المستخدم يحدث بياناته (بدون صورة بروفايل)
router.post('/address', auth, addNewAddress);
router.get('/addresses', auth, getSavedAddresses);
router.get('/seller',auth,authorize('admin'),getUsers)
// --- 3. 🚀 المسارات الديناميكية (يجب أن تأتي أخيراً) 🚀
router.get('/:id', auth, getUserById); // المستخدم يشوف بياناته
//for Admin to update any user and for user to update his own data
router.put('/user/:id', auth, upload.single('profilePicture'), updateUserById);  
// المستخدم يحدث بياناته + صورة بروفايل
router.put('/:id/toggle-ban', auth, authorize('admin'), toggleBanUser); // الأدمن يوقف/يفعل يوزر
router.put('/:id/status',auth,authorize('admin'),updateSellerStatus)
router.delete('/:id', auth, authorize('admin'), deleteUserById); // الأدمن يحذف
// في routes/users.js
router.put('/:id/review', auth, authorize('admin'), reviewUserStatus);

router.put('/address/:addressId', auth, updateAddress);
router.delete('/address/:addressId', auth, deleteAddress);

router.get('/address/governorates', async (req, res) => {
  const governates = await Governate.find().select('_id name');
  res.json(governates);
});
module.exports = router;