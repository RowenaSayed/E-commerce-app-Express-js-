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
router.get('/verify/:token', verifyEmail); 

router.get('/', auth, authorize('admin'), listUsers); 
router.put('/profile',upload.single('profilePicture'), auth, updateUser); 
router.post('/address', auth, addNewAddress);
router.get('/addresses', auth, getSavedAddresses);
router.get('/seller',auth,authorize('admin'),getUsers)
router.get('/:id', auth, getUserById); 
router.put('/user/:id', auth, upload.single('profilePicture'), updateUserById);  
router.put('/:id/toggle-ban', auth, authorize('admin'), toggleBanUser); 
router.put('/:id/status',auth,authorize('admin'),updateSellerStatus)
router.delete('/:id', auth, authorize('admin'), deleteUserById); 
router.put('/:id/review', auth, authorize('admin'), reviewUserStatus);

router.put('/address/:addressId', auth, updateAddress);
router.delete('/address/:addressId', auth, deleteAddress);

router.get('/address/governorates', async (req, res) => {
  const governates = await Governate.find().select('_id name');
  res.json(governates);
});
module.exports = router;