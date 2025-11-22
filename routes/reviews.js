const express = require('express');
const router = express.Router();
const { createReview, getAllReviews, deleteReview } = require('../controllers/reviews');
const { auth, authorize } = require('../middleware/auth');

router.post('/', auth, createReview);
router.get('/', getAllReviews);
router.delete('/:id', auth, authorize(['admin','buyer']), deleteReview);

module.exports = router;
