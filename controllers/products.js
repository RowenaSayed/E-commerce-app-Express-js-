const Product = require('../models/products');

// 1. Create Product (FR-A3, FR-A6)
const createProduct = async (req, res) => {
    try {
        const user = req.user;

        if (!user || (user.role !== 'admin' && user.role !== 'seller')) {
            return res.status(403).json({ message: "Access denied: Only admin or seller can add products" });
        }

        let imagePaths = [];
        if (req.files && req.files.length > 0) {
            imagePaths = req.files.map(file => file.path || file.location);
        }

        const {
            name, nameAr,
            description, descriptionAr,
            category, subCategory,
            brand, sku,
            condition,
            price, discount,
            stockQuantity, lowStockThreshold,
            usedDetails, importedDetails,
            technicalSpecs,
            dimensions, weight,
            warranty,
            isFeatured, visibility
        } = req.body;

        if (!name || !category || !condition || !price || !description) {
            return res.status(400).json({
                message: "Missing required fields: name, category, condition, price, description"
            });
        }

        if (condition === "Used" && (!usedDetails || !usedDetails.deviceConditionDescription)) {
            return res.status(400).json({
                message: "Used details required for used products"
            });
        }

        if (condition === "Imported" && (!importedDetails || !importedDetails.countryOfOrigin)) {
            return res.status(400).json({
                message: "Imported details required for imported products"
            });
        }

        const newProduct = await Product.create({
            seller: user.id,
            name, nameAr,
            description, descriptionAr,
            category, subCategory,
            brand, sku,
            condition,
            price,
            discount: discount || 0,
            stockQuantity: stockQuantity || 0,
            lowStockThreshold: lowStockThreshold || 5,
            usedDetails: condition === "Used" ? usedDetails : undefined,
            importedDetails: condition === "Imported" ? importedDetails : undefined,
            technicalSpecs: technicalSpecs ? JSON.parse(technicalSpecs) : {},
            dimensions: dimensions ? JSON.parse(dimensions) : {},
            weight: weight ? JSON.parse(weight) : {},
            warranty: warranty ? JSON.parse(warranty) : { type: "None" },
            images: imagePaths,
            isFeatured: isFeatured || false,
            visibility: visibility || "Published"
        });

        res.status(201).json({
            success: true,
            message: "Product added successfully",
            product: newProduct
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Duplicate SKU. SKU must be unique"
            });
        }
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

// 2. Update Product (FR-A4)
const updateProduct = async (req, res) => {
    try {
        const user = req.user;
        const product = await Product.findById(req.params.id);

        if (!product) return res.status(404).json({
            success: false,
            message: "Product not found"
        });

        if (product.seller.toString() !== user.id.toString() && user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied: You can only update your own products"
            });
        }

        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => file.path || file.location);
            product.images = [...product.images, ...newImages];
        }

        const updates = req.body;
        const restrictedFields = ['seller', 'ratingsAverage', 'ratingsQuantity', 'sold', 'createdAt', '_id'];

        Object.keys(updates).forEach(key => {
            if (!restrictedFields.includes(key) && updates[key] !== undefined) {
                if (key === 'technicalSpecs' || key === 'dimensions' || key === 'weight' || key === 'warranty') {
                    product[key] = JSON.parse(updates[key]);
                } else {
                    product[key] = updates[key];
                }
            }
        });

        await product.save();
        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            product
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

// 3. Delete Product Image
const deleteProductImage = async (req, res) => {
    try {
        const user = req.user;
        const { id, imageIndex } = req.params;

        const product = await Product.findById(id);
        if (!product) return res.status(404).json({
            success: false,
            message: "Product not found"
        });

        if (product.seller.toString() !== user.id.toString() && user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        const index = parseInt(imageIndex);
        if (isNaN(index) || index < 0 || index >= product.images.length) {
            return res.status(400).json({
                success: false,
                message: "Invalid image index"
            });
        }

        product.images.splice(index, 1);
        await product.save();

        res.status(200).json({
            success: true,
            message: "Image deleted successfully",
            images: product.images
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

// 4. Soft Delete Product (FR-A5)
const deleteProduct = async (req, res) => {
    try {
        const user = req.user;
        const product = await Product.findById(req.params.id);

        if (!product) return res.status(404).json({
            success: false,
            message: "Product not found"
        });

        if (product.seller.toString() !== user.id.toString() && user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        product.isDeleted = true;
        product.deletedAt = new Date();
        product.visibility = 'Hidden';

        await product.save();

        res.status(200).json({
            success: true,
            message: "Product archived successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

// 5. Restore Product (FR-A5)
const restoreProduct = async (req, res) => {
    try {
        const user = req.user;
        const product = await Product.findById(req.params.id);

        if (!product) return res.status(404).json({
            success: false,
            message: "Product not found"
        });

        if (user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied: Admin only"
            });
        }

        product.isDeleted = false;
        product.deletedAt = undefined;
        product.visibility = 'Published';

        await product.save();

        res.status(200).json({
            success: true,
            message: "Product restored successfully",
            product
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

// 6. Get Products (Advanced Filtering)
const getProducts = async (req, res) => {
    try {
        const {
            category, condition, minPrice, maxPrice, brand,
            search, lowStock, showArchived, sort, page = 1, limit = 20
        } = req.query;

        let filter = {};

        if (showArchived !== 'true') {
            filter.isDeleted = false;
        }

        if (category) filter.category = category;
        if (condition) filter.condition = condition;
        if (brand) filter.brand = brand;

        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }

        if (search) {
            filter.$text = { $search: search };
        }

        if (lowStock === 'true') {
            filter.$expr = { $lte: ["$stockQuantity", "$lowStockThreshold"] };
        }

        if (!req.user || req.user.role !== 'admin') {
            filter.visibility = "Published";
        }

        let sortOption = { isFeatured: -1, createdAt: -1 };
        if (sort === 'price_asc') sortOption = { price: 1 };
        if (sort === 'price_desc') sortOption = { price: -1 };
        if (sort === 'sold') sortOption = { sold: -1 };
        if (sort === 'rating') sortOption = { ratingsAverage: -1 };

        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            Product.find(filter)
                .populate('seller', 'name profilePicture')
                .sort(sortOption)
                .skip(skip)
                .limit(Number(limit)),
            Product.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            count: products.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            products
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

// 7. Get Single Product By ID
const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('seller', 'name email profilePicture');

        if (!product || (product.isDeleted && (!req.user || req.user.role !== 'admin'))) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        if (product.visibility !== "Published" && (!req.user || req.user.role !== 'admin')) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const similarProducts = await Product.find({
            _id: { $ne: product._id },
            category: product.category,
            isDeleted: false,
            visibility: "Published"
        })
            .limit(4)
            .select('name price condition images ratingsAverage brand');

        res.status(200).json({
            success: true,
            product,
            similar: similarProducts
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

// 8. Get Products By Category
const getProductByCategory = async (req, res) => {
    try {
        const { page = 1, limit = 20, sort } = req.query;
        const skip = (page - 1) * limit;

        let filter = {
            category: req.params.category,
            isDeleted: false
        };

        if (!req.user || req.user.role !== 'admin') {
            filter.visibility = "Published";
        }

        let sortOption = { isFeatured: -1, createdAt: -1 };
        if (sort === 'price_asc') sortOption = { price: 1 };
        if (sort === 'price_desc') sortOption = { price: -1 };

        const [products, total] = await Promise.all([
            Product.find(filter)
                .populate('seller', 'name profilePicture')
                .sort(sortOption)
                .skip(skip)
                .limit(Number(limit)),
            Product.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            count: products.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

// 9. Get Products By Seller
const getProductsBySeller = async (req, res) => {
    try {
        const sellerId = req.params.sellerId || (req.user ? req.user.id : null);

        if (!sellerId) {
            return res.status(400).json({
                success: false,
                message: "Seller ID is required"
            });
        }

        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        let filter = {
            seller: sellerId,
            isDeleted: false
        };

        if (sellerId !== req.user?.id && (!req.user || req.user.role !== 'admin')) {
            filter.visibility = "Published";
        }

        const [products, total] = await Promise.all([
            Product.find(filter)
                .populate('seller', 'name profilePicture')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Product.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            count: products.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

// 10. Get Low Stock Products (FR-A8)
const getLowStockProducts = async (req, res) => {
    try {
        const user = req.user;

        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied: Admin only"
            });
        }

        const products = await Product.find({
            $expr: { $lte: ["$stockQuantity", "$lowStockThreshold"] },
            isDeleted: false
        })
            .populate('seller', 'name email phone')
            .sort({ stockQuantity: 1 });

        res.status(200).json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

// 11. Update Stock Quantity
const updateStock = async (req, res) => {
    try {
        const user = req.user;
        const { quantity } = req.body;

        if (!user || (user.role !== 'admin' && user.role !== 'seller')) {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({
            success: false,
            message: "Product not found"
        });

        if (product.seller.toString() !== user.id.toString() && user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied: You can only update your own products"
            });
        }

        if (quantity < 0) {
            return res.status(400).json({
                success: false,
                message: "Stock quantity cannot be negative"
            });
        }

        product.stockQuantity = quantity;
        await product.save();

        res.status(200).json({
            success: true,
            message: "Stock updated successfully",
            product
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

module.exports = {
    createProduct,
    updateProduct,
    deleteProduct,
    restoreProduct,
    deleteProductImage,
    getProducts,
    getProductById,
    getProductByCategory,
    getProductsBySeller,
    getLowStockProducts,
    updateStock
};