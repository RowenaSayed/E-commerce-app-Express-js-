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
router.get('/',auth,authorize('buyer'), getCart);
router.post('/add',auth,authorize('buyer'), addToCart);
router.put('/update/:item_id', auth,authorize('buyer'), updateCartItem);
router.delete('/remove/:itemId', auth, removeCartItem);
router.delete('/clear', auth,authorize('buyer'), clearCart);   
router.post('/address', auth,authorize('buyer'), addNewAddress);
router.put('/address/:addressId', auth, updateAddress);
router.delete('/address/:addressId', auth, deleteAddress);  
router.get('/addresses', auth, getSavedAddresses);
router.get('/shipping-options', auth,authorize('buyer'), getShippingOptions);
router.post('/apply-promo', auth, applyPromotionCode);      
router.delete('/remove-promo', auth, removePromotionCode);
router.get('/summary', auth,authorize('buyer'), getCartSummary);
router.post('/checkout', auth,authorize('buyer'), initiatePayment);
//router.post('/checkout', auth, initiatePayment);
module.exports = router;