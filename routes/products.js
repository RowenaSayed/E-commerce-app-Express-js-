const express = require('express');
const router = express.Router();
const { 
    createProduct, 
    updateProduct, 
    deleteProduct, 
    getProducts, 
    getProductById, 
    getProductByCategory, 
    getProductsBySeller 
} = require('../controllers/products');

const { auth, authorize } = require('../middleware/auth');
const upload = require('../utilities/fileUpload'); 

// FR-A3 & FR-A6: Create Product (Admin/Seller) + Multiple Images (Max 10)
router.post('/', auth, authorize('admin', 'seller'), upload.array('image', 10), createProduct);

// FR-A4 & FR-A6: Edit Product
router.put('/:id', auth, authorize('admin', 'seller'), upload.array('image', 10), updateProduct);

// FR-A5: Soft Delete Product
router.delete('/:id', auth, authorize('admin', 'seller'), deleteProduct);

// Public Routes
router.get('/', getProducts); // يدعم فلاتر الأدمن مثل lowStock
router.get('/:id', getProductById);
router.get('/category/:category', getProductByCategory);
router.get('/seller/:sellerId', getProductsBySeller); // تم تعديل المسار لاستقبال ID

module.exports = router;