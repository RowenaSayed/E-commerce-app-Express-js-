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
    getUserReturnRequests
} = require('../controllers/orders');
const { auth, authorize } = require('../middleware/auth');

// 1. Create Order
router.post('/', auth,createOrder);
router.post('/admin', auth, authorize('admin', 'support'),adminCreateOrder); // تأكد أن لديك middleware لفحص الصلاحيات);
// 2. View Orders (History)
router.get('/', auth, getOrders);

router.get('/return', auth, getUserReturnRequests);
// 3. View Specific Order
router.get('/:id', auth, getOrderById);

// 4. Cancel Order (User)
router.put('/:id/cancel', auth, cancelOrder);

// 5. Request Return (User)
router.post('/:id/return', auth, requestReturn);

// 6. Update Status (Admin/Support)
router.put('/:id', auth, authorize('admin', 'support'), updateOrderStatus);

// 7. Delete Order (Admin)
router.delete('/:id/delete', auth, authorize('admin'), deleteOrder);


module.exports = router;