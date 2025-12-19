const express = require('express');
const router = express.Router();

/* =========================
   Controllers
========================= */
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

/* =========================
   Middleware
========================= */
const { auth, authorize } = require('../middleware/auth');
const upload = require('../utilities/fileUpload');

/* =========================
   Protected Routes
   (Admin / Seller)
========================= */

// FR-A3 & FR-A6: Create Product (Admin/Seller) + Multiple Images (Max 10)
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

// FR-A5: Soft Delete Product
router.delete(
    '/:id',
    auth,
    authorize(['admin', 'seller']),
    deleteProduct
);

// Delete single product image
router.delete(
    '/:id/image',
    auth,
    authorize(['admin', 'seller']),
    deleteProductImage
);

// Restore archived product
router.post(
    '/:id/restore',
    auth,
    authorize(['admin', 'seller']),
    restoreProduct
);

// Update stock quantity
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

// FR-A9: Get low stock products
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

// FR-A11: Seller dashboard stats
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

// Get all products (supports admin filters like lowStock)
router.get('/', getProducts);

router.get('/:id', getProductById);

router.get('/category/:category', getProductByCategory);

router.get('/seller/:sellerId', getProductsBySeller);
router.get("/stats/out-of-stock", getOutOfStockProducts);

/* =========================
    Export Router
========================= */
module.exports = router;
