const express = require('express');
const router = express.Router();
const { 
    createOrder, 
    getOrders, 
    getOrderById, 
    updateOrderStatus, 
    cancelOrder, 
    requestReturn, 
    deleteOrder ,
    adminCreateOrder,
    getUserReturnRequests,
    getOrdersByUserId
} = require('../controllers/orders');
const { auth, authorize } = require('../middleware/auth');
const upload=require('../utilities/fileUpload')

router.post('/', auth,createOrder);
router.post('/admin', auth, authorize('admin', 'support'),adminCreateOrder); // تأكد أن لديك middleware لفحص الصلاحيات);
router.get('/', auth, getOrders);

router.get('/return', auth, getUserReturnRequests);
router.get('/user/:userId', getOrdersByUserId);

router.get('/:id', auth, getOrderById);

router.put('/:id/cancel', auth, cancelOrder);

router.post('/:id/return', auth, upload.array('proofImages', 5), requestReturn);

router.put('/:id', auth, authorize('admin', 'support'), updateOrderStatus);

router.delete('/:id/delete', auth, authorize('admin'), deleteOrder);


module.exports = router;