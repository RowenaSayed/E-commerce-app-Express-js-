const express = require('express');
const router = express.Router();

// Import Controllers
const { 
    createReview, 
    getAllReviews, 
    deleteReview 
} = require('../controllers/reviews');

// Import Middleware
const { auth, authorize } = require('../middleware/auth');

// FR-R1 & FR-R8: Create Review
// Only logged-in users can write. Logic for "Verified Purchase" is handled inside the controller.
router.post('/', auth, createReview);

// FR-R5 & FR-R7: Get All Reviews
// Public route (no auth needed) so anyone can see product ratings.
router.get('/', getAllReviews);

// Delete Review
// Restricted to Admin only to match the Controller logic
router.delete('/:id', auth, authorize('admin'), deleteReview);

module.exports = router;
