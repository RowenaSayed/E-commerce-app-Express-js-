//cart routes
const express = require('express');
const router = express.Router();
const { getCart, addToCart, updateCartItem, clearCart, removeCartItem, addNewAddress,
    applyPromotionCode,
    deleteAddress,
    getCartSummary,
    getSavedAddresses,
    getShippingOptions,
    removePromotionCode,
    updateAddress,
    initiatePayment

} = require('../controllers/carts');
const sessionMiddleware = require('../middleware/session');
const { auth, authorize } = require('../middleware/auth');
router.use(sessionMiddleware);
router.get('/', auth, getCart);
router.post('/add', auth, addToCart);
router.put('/update/:item_id', auth, updateCartItem);//usually used for quantity update
router.delete('/remove/:item_id', auth, removeCartItem);
router.delete('/clear', auth, clearCart);
router.post('/address', auth, addNewAddress);
router.put('/address/:addressId', auth, updateAddress);
router.delete('/address/:addressId', auth, deleteAddress);
router.get('/addresses', auth, getSavedAddresses);
router.get('/shipping-options', auth, getShippingOptions);
router.post('/apply-promo', auth, applyPromotionCode);
router.delete('/remove-promo', auth, removePromotionCode);
router.get('/summary', auth, getCartSummary);
router.post('/checkout', auth,  initiatePayment);
//router.post('/checkout', auth, initiatePayment);

module.exports = router;