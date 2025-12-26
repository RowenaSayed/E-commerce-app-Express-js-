const express = require('express');
const router = express.Router();


const {
    createProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    getProductById,
    getProductByCategory,
    getProductsBySeller,
    deleteProductImage,
    getLowStockProducts,
    restoreProduct,
    updateStock,
    getSellerStats,
    getSellerStatsById,
    toggleFeatured,
    updateVisibility,
    getOutOfStockProducts
} = require('../controllers/products');

const { auth, authorize } = require('../middleware/auth');
const upload = require('../utilities/fileUpload');



router.post(
    '/',
    auth,
    authorize(['admin', 'seller']),
    upload.array('image', 10),
    createProduct
);

// FR-A4 & FR-A6: Edit Product
router.put(
    '/:id',
    auth,
    authorize(['admin', 'seller']),
    upload.array('image', 10),
    updateProduct
);

router.delete(
    '/:id',
    auth,
    authorize(['admin', 'seller']),
    deleteProduct
);

router.delete(
    '/:id/image',
    auth,
    authorize(['admin', 'seller']),
    deleteProductImage
);

router.post(
    '/:id/restore',
    auth,
    authorize(['admin', 'seller']),
    restoreProduct
);

router.put(
    '/:id/stock',
    auth,
    authorize(['admin', 'seller']),
    updateStock
);

// Update product visibility
router.put(
    '/:id/visibility',
    auth,
    authorize(['admin', 'seller']),
    updateVisibility
);

/* =========================
   Admin Only Routes
========================= */

router.get(
    '/low-stock/admin',
    auth,
    authorize('admin'),
    getLowStockProducts
);

// FR-A12: Toggle featured product
router.put(
    '/:id/toggle-featured',
    auth,
    authorize('admin'),
    toggleFeatured
);

/* =========================
   Seller Only Routes
========================= */

router.get(
    '/stats/seller',
    auth,
    authorize('seller'),
    getSellerStatsById
);
router.get('/allStats',auth,authorize('admin'),getSellerStats)

/* =========================
    Public Routes
========================= */

router.get('/', getProducts);

router.get('/:id', getProductById);

router.get('/category/:category', getProductByCategory);

router.get('/seller/:sellerId', getProductsBySeller);
router.get("/stats/out-of-stock", getOutOfStockProducts);

module.exports = router;
