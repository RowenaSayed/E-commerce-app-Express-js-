const express = require('express');
const router = express.Router();
const { createOrder, getOrders, getOrderById, updateOrderStatus, cancelOrder,requestReturn,deleteOrder } = require('../controllers/orders');
const { auth ,authorize} = require('../middleware/auth');

router.post('/', auth, createOrder);
router.get('/', auth, getOrders);
router.get('/:id', auth, getOrderById);

// Cancel Order (User)
router.put('/:id/cancel', auth, async (req, res) => {
    req.body.status = 'Cancelled';
    updateOrderStatus(req, res);
});
router.post('/:id/return', auth, requestReturn);
//for admin
router.put('/:id', auth,authorize('admin','support'), updateOrderStatus);
router.delete('/:id/delete', auth, deleteOrder);

module.exports = router;
