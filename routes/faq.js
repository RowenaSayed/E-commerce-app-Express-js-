const express = require('express');
const router = express.Router();
const { 
    createFAQ, 
    getPublicFAQs, 
    getAllFAQs, 
    updateFAQ, 
    deleteFAQ 
} = require('../controllers/faq');

const { auth, authorize } = require('../middleware/auth');

router.get('/', getPublicFAQs); 

router.get('/admin/all', auth, authorize('admin'), getAllFAQs);
router.post('/', auth, authorize('admin'), createFAQ);
router.put('/:id', auth, authorize('admin'), updateFAQ);
router.delete('/:id', auth, authorize('admin'), deleteFAQ);

module.exports = router;