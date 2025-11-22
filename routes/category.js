const express = require('express');
const router = express.Router();
const { createCategory, updateCategory, deleteCategory, getCategories } = require('../controllers/category');
const { auth, authorize } = require('../middleware/auth');

router.post('/', auth, authorize('admin'), createCategory);
router.put('/:id', auth, authorize('admin'), updateCategory);
router.delete('/:id', auth, authorize('admin'), deleteCategory);
router.get('/', getCategories);

module.exports = router;
