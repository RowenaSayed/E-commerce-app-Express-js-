const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { 
    createReview, 
    getAllReviews, 
    deleteReview,
    markReviewHelpful 
} = require('../controllers/reviews');

router.get('/', getAllReviews);

router.post('/', auth, createReview);

router.put('/:id/helpful', auth, markReviewHelpful);

router.delete('/:id', auth, deleteReview);

module.exports = router;