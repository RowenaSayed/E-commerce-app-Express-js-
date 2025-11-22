const express = require('express');
const router = express.Router();
const { createProduct, updateProduct, deleteProduct, getProducts, getProductById } = require('../controllers/products');
const { auth, authorize } = require('../middleware/auth');

router.post('/', auth, authorize('admin'), createProduct);
router.put('/:id', auth, authorize('admin'), updateProduct);
router.delete('/:id', auth, authorize('admin'), deleteProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);

module.exports = router;
