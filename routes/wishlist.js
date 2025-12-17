const express = require('express');
const router = express.Router();
const { getWishlist, addToWishlist, removeFromWishlist, clearWishlist } = require('../controllers/wishlist');
const { auth } = require('../middleware/auth');

router.get('/', auth, getWishlist);
router.post('/:product_id', auth, addToWishlist);
router.delete('/clear', auth, clearWishlist);
router.delete('/:product_id', auth, removeFromWishlist);

module.exports = router;
