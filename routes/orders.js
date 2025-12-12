const express = require('express');
const router = express.Router();
const { createOrder, getOrders, getOrderById, updateOrder, deleteOrder } = require('../controllers/orders');
const { auth } = require('../middleware/auth');

router.post('/', auth, createOrder);
router.get('/', auth, getOrders);
router.get('/:id', auth, getOrderById);

// Cancel Order (User)
router.put('/:id/cancel', auth, async (req, res) => {
    req.body.status = 'Cancelled';
    updateOrder(req, res);
});

//for admin
router.put('/:id', auth, updateOrder);
router.delete('/:id', auth, deleteOrder);

module.exports = router;
