const express = require('express');
const router = express.Router();
const { getWishlist, addToWishlist, removeFromWishlist, clearWishlist } = require('../controllers/wishlist');
const { auth } = require('../middleware/auth');

router.get('/', auth, getWishlist);
router.post('/', auth, addToWishlist);
router.delete('/', auth, clearWishlist);
router.delete('/:product_id', auth, removeFromWishlist);

module.exports = router;
