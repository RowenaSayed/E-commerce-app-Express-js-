const express = require('express');
const router = express.Router();
const { createProduct, updateProduct, deleteProduct, getProducts, getProductById ,getProductByCategory,getProductsBySeller} = require('../controllers/products');
const { auth, authorize } = require('../middleware/auth');
const upload = require('../utilities/fileUpload'); 

router.post('/', auth, authorize('admin'),upload.array('image',10) ,createProduct);
router.put('/:id', auth, authorize('admin'),upload.array('image',10), updateProduct);
router.delete('/:id', auth, authorize('admin'), deleteProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.get('/category/:category', getProductByCategory);
router.get('/seller/', getProductsBySeller);

module.exports = router;
