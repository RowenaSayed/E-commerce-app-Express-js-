const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { 
    createReview, 
    getAllReviews, 
    deleteReview,
    markReviewHelpful 
} = require('../controllers/reviews');

// 1. عرض الريفيوهات (مفتوح للكل)
router.get('/', getAllReviews);

// 2. إنشاء ريفيو (Auth فقط، والتحقق من الرتبة بيتم جوه الكنترولر)
router.post('/', auth, createReview);

// 3. تصويت مفيد (Auth Required)
router.put('/:id/helpful', auth, markReviewHelpful);

// 4. حذف ريفيو (Auth Required)
// شيلنا authorize('admin') من هنا، وهندلناها جوه الكنترولر عشان نسمح لصاحب الريفيو يمسحه
router.delete('/:id', auth, deleteReview);

module.exports = router;