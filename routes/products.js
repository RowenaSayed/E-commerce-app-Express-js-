const express = require('express');
const router = express.Router();
const { createProduct, updateProduct, deleteProduct, getProducts, getProductById } = require('../controllers/products');
const { auth, authorize } = require('../middleware/auth');
const upload = require('../utilities/fileUpload'); // هنشرحه تحت

router.post('/', auth, authorize('admin'),upload.array('image',10) ,createProduct);
router.put('/:id', auth, authorize('admin'),upload.array('image',10), updateProduct);
router.delete('/:id', auth, authorize('admin'), deleteProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);

module.exports = router;
