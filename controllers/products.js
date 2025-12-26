const Product = require('../models/products');
const User = require('../models/users')

const hasProductAccess = (user, product, action = 'view') => {
    if (user.role === 'admin') return true;
    if (user.role === 'seller') {
        return product.seller.toString() === user.id.toString();
    }
    return false;
};

const isAdmin = (user) => user && user.role === 'admin';
const isSeller = (user) => user && user.role === 'seller';
const isAdminOrSeller = (user) => user && (user.role === 'admin' || user.role === 'seller');

const createProduct = async (req, res) => {
    try {
        const user = req.user;

        if (!isAdminOrSeller(user)) {
            return res.status(403).json({
                success: false,
                message: "Access denied: Only admin or seller can add products"
            });
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
                success: false,
                message: "Missing required fields: name, category, condition, price, description"
            });
        }

        const parsedUsedDetails = usedDetails ?
            (typeof usedDetails === 'string' ? JSON.parse(usedDetails) : usedDetails) :
            undefined;

        const parsedImportedDetails = importedDetails ?
            (typeof importedDetails === 'string' ? JSON.parse(importedDetails) : importedDetails) :
            undefined;

        const parsedTechnicalSpecs = technicalSpecs ?
            (typeof technicalSpecs === 'string' ? JSON.parse(technicalSpecs) : technicalSpecs) :
            {};

        const parsedDimensions = dimensions ?
            (typeof dimensions === 'string' ? JSON.parse(dimensions) : dimensions) :
            {};

        const parsedWeight = weight ?
            (typeof weight === 'string' ? JSON.parse(weight) : weight) :
            {};

        const parsedWarranty = warranty ?
            (typeof warranty === 'string' ? JSON.parse(warranty) : warranty) :
            { type: "None" };

        if (condition === "Used" && (!parsedUsedDetails || !parsedUsedDetails.deviceConditionDescription)) {
            return res.status(400).json({
                success: false,
                message: "Used details required for used products"
            });
        }

        if (condition === "Imported" && (!parsedImportedDetails || !parsedImportedDetails.countryOfOrigin)) {
            return res.status(400).json({
                success: false,
                message: "Imported details required for imported products"
            });
        }

        const finalIsFeatured = user.role === 'admin' ? (isFeatured || false) : false;

        const newProduct = await Product.create({
            seller: user.id,
            name, nameAr,
            description, descriptionAr,
            category, subCategory,
            brand, sku,
            condition,
            price: Number(price),
            discount: discount ? Number(discount) : 0,
            stockQuantity: stockQuantity ? Number(stockQuantity) : 0,
            lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : 5,
            usedDetails: condition === "Used" ? parsedUsedDetails : undefined,
            importedDetails: condition === "Imported" ? parsedImportedDetails : undefined,
            technicalSpecs: parsedTechnicalSpecs,
            dimensions: parsedDimensions,
            weight: parsedWeight,
            warranty: parsedWarranty,
            images: imagePaths,
            isFeatured: finalIsFeatured,
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

const updateProduct = async (req, res) => {
    try {
        const user = req.user;
        const product = await Product.findById(req.params.id);

        if (!product) return res.status(404).json({
            success: false,
            message: "Product not found"
        });

        if (!hasProductAccess(user, product, 'update')) {
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
        const restrictedFields = ['seller', 'ratingsAverage', 'ratingsQuantity', 'sold', 'createdAt', '_id', '__v'];

        Object.keys(updates).forEach(key => {
            if (!restrictedFields.includes(key) && updates[key] !== undefined) {
                if (key === 'technicalSpecs' || key === 'dimensions' || key === 'weight' || key === 'warranty') {
                    product[key] = typeof updates[key] === 'string' ?
                        JSON.parse(updates[key]) : updates[key];
                } else if (key === 'isFeatured' && user.role === 'seller') {
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

const deleteProductImage = async (req, res) => {
    try {
        const user = req.user;
        const { id, imageIndex } = req.params;

        const product = await Product.findById(id);
        if (!product) return res.status(404).json({
            success: false,
            message: "Product not found"
        });

        if (!hasProductAccess(user, product, 'update')) {
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

const deleteProduct = async (req, res) => {
    try {
        const user = req.user;
        const product = await Product.findById(req.params.id);

        if (!product) return res.status(404).json({
            success: false,
            message: "Product not found"
        });

        if (!hasProductAccess(user, product, 'delete')) {
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

const restoreProduct = async (req, res) => {
    try {
        const user = req.user;
        const product = await Product.findById(req.params.id);

        if (!product) return res.status(404).json({
            success: false,
            message: "Product not found"
        });

        if (!isAdminOrSeller(user)) {
            return res.status(403).json({
                success: false,
                message: "Access denied: Admin Seller only"
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

const getProducts = async (req, res) => {
    try {
        const {
            category, condition, minPrice, maxPrice, brand,
            search, lowStock, showArchived, sort, cpu, gpu, ram, storage,
            page = 1, limit = 10, seller, featured
        } = req.query;

        let filter = {};

        if (showArchived === 'true' && isAdmin(req.user)) {
        } else {
            filter.isDeleted = false;
        }

        if (category) filter.category = category;
        if (condition) filter.condition = condition;
        if (brand) filter.brand = brand;
        if (cpu) filter['technicalSpecs.CPU'] = cpu;
        if (gpu) filter['technicalSpecs.GPU'] = gpu;
        if (ram) filter['technicalSpecs.RAM'] = ram;
        if (storage) filter['technicalSpecs.Storage'] = storage;
        if (seller) filter.seller = seller;
        if (featured === 'true') filter.isFeatured = true;

        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }

        if (search) {
            filter.$text = { $search: search };
        }

        if (lowStock === 'true' && isAdmin(req.user)) {
            filter.$expr = { $lte: ["$stockQuantity", "$lowStockThreshold"] };
        }

        if (isAdmin(req.user)) {
            filter.visibility = { $in: ["Published", "Draft", "Hidden"] };

        }
        else if (isSeller(req.user)) {
            filter.$or = [
                { seller: req.user.id },
                { visibility: "Published" }
            ];
        }
        else {
            filter.visibility = "Published";
        }

        let sortOption = { isFeatured: -1, createdAt: -1 };
        if (sort === 'price_asc') sortOption = { price: 1 };
        if (sort === 'price_desc') sortOption = { price: -1 };
        if (sort === 'sold') sortOption = { sold: -1 };
        if (sort === 'rating') sortOption = { ratingsAverage: -1 };
        if (sort === 'newest') sortOption = { createdAt: -1 };
        if (sort === 'oldest') sortOption = { createdAt: 1 };

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        let products, total;
        if (isAdmin(req.user)) {
            [products, total] = await Promise.all([
                Product.find()
                    .populate('seller', 'name profilePicture')
                    .sort(sortOption)
                    .skip(skip)
                    .limit(limitNum),
                Product.countDocuments()
            ]);
        }
        else {
            [products, total] = await Promise.all([
                Product.find(filter)
                    .populate('seller', 'name profilePicture')
                    .sort(sortOption)
                    .skip(skip)
                    .limit(limitNum),
                Product.countDocuments(filter)
            ]);
        }

        res.status(200).json({
            success: true,
            results: products.length,
            pagination: {
                totalItems: total,
                currentPage: pageNum,
                itemsPerPage: limitNum,
                totalPages: Math.ceil(total / limitNum)
            },
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

const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('seller', 'name email profilePicture');

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        if (product.isDeleted && !isAdmin(req.user)) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        if (product.visibility !== "Published") {
            if (isAdmin(req.user)) {
            } else if (isSeller(req.user) && product.seller._id.toString() === req.user?.id) {
            } else {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }
        }

        const similarProducts = await Product.find({
            _id: { $ne: product._id },
            category: product.category,
            isDeleted: false,
            visibility: "Published"
        })
            .limit(4)
            .select('name price condition images ratingsAverage brand slug')
            .populate('seller', 'name');

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

const getProductByCategory = async (req, res) => {
    try {
        const { page = 1, limit = 20, sort, condition } = req.query;
        const skip = (page - 1) * limit;

        let filter = {
            category: req.params.category,
            isDeleted: false
        };

        if (condition) filter.condition = condition;

        if (!isAdmin(req.user) && !isSeller(req.user)) {
            filter.visibility = "Published";
        }

        let sortOption = { isFeatured: -1, createdAt: -1 };
        if (sort === 'price_asc') sortOption = { price: 1 };
        if (sort === 'price_desc') sortOption = { price: -1 };
        if (sort === 'popular') sortOption = { sold: -1 };

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
            category: req.params.category,
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

const getProductsBySeller = async (req, res) => {
    try {
        const sellerId = req.params.sellerId || (req.user ? req.user.id : null);

        if (!sellerId) {
            return res.status(400).json({
                success: false,
                message: "Seller ID is required"
            });
        }

        const { page = 1, limit = 20, includeArchived } = req.query;
        const skip = (page - 1) * limit;

        let filter = {
            seller: sellerId
        };

        const isOwnProducts = req.user && sellerId === req.user.id;
        const isAdminUser = isAdmin(req.user);

        if (!isOwnProducts && !isAdminUser) {
            filter.isDeleted = false;
            filter.visibility = "Published";
        } else if (includeArchived !== 'true') {
            filter.isDeleted = false;
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
            sellerId,
            isOwnProducts,
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

const getLowStockProducts = async (req, res) => {
    try {
        if (!isAdmin(req.user)) {
            return res.status(403).json({
                success: false,
                message: "Access denied: Admin only"
            });
        }

        const { sellerId } = req.query;
        let filter = {
            stockQuantity: { $gt: 0 },
            $expr: { $lte: ["$stockQuantity", "$lowStockThreshold"] },
            isDeleted: false
        };

        if (sellerId) {
            filter.seller = sellerId;
        }

        const products = await Product.find(filter)
            .populate('seller', 'name email phone')
            .sort({ stockQuantity: 1 });

        const summary = {
            totalLowStock: products.length,
            critical: products.filter(p => p.stockQuantity <= 2).length,
            warning: products.filter(p => p.stockQuantity <= 5 && p.stockQuantity > 2).length
        };

        res.status(200).json({
            success: true,
            summary,
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

const getOutOfStockProducts = async (req, res) => {
    try {
        const count = await Product.countDocuments({
            stockQuantity: { $lte: 0 }
        });

        res.json({ count });
    } catch (error) {
        console.error("getOutOfStockProducts Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const updateStock = async (req, res) => {
    try {
        const user = req.user;
        const { quantity, action } = req.body;

        if (!isAdminOrSeller(user)) {
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

        if (!hasProductAccess(user, product, 'update')) {
            return res.status(403).json({
                success: false,
                message: "Access denied: You can only update your own products"
            });
        }

        let newQuantity = product.stockQuantity;

        switch (action) {
            case 'add':
                newQuantity += Number(quantity);
                break;
            case 'subtract':
                newQuantity -= Number(quantity);
                break;
            case 'set':
            default:
                newQuantity = Number(quantity);
        }

        if (newQuantity < 0) {
            return res.status(400).json({
                success: false,
                message: "Stock quantity cannot be negative"
            });
        }

        product.stockQuantity = newQuantity;
        await product.save();

        res.status(200).json({
            success: true,
            message: `Stock ${action === 'set' ? 'updated' : action}ed successfully`,
            previousStock: product.stockQuantity - (action === 'add' ? -quantity : action === 'subtract' ? quantity : 0),
            newStock: product.stockQuantity,
            action: action || 'set'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

const toggleFeatured = async (req, res) => {
    try {
        if (!isAdmin(req.user)) {
            return res.status(403).json({
                success: false,
                message: "Access denied: Admin only"
            });
        }

        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({
            success: false,
            message: "Product not found"
        });

        product.isFeatured = !product.isFeatured;
        await product.save();

        res.status(200).json({
            success: true,
            message: `Product ${product.isFeatured ? 'marked as' : 'removed from'} featured`,
            isFeatured: product.isFeatured
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

const updateVisibility = async (req, res) => {
    try {
        const user = req.user;
        const { visibility } = req.body;

        if (!isAdminOrSeller(user)) {
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

        if (!hasProductAccess(user, product, 'update')) {
            return res.status(403).json({
                success: false,
                message: "Access denied: You can only update your own products"
            });
        }
        const validVisibilities = ["Published", "Draft", "Hidden"];
        if (!validVisibilities.includes(visibility)) {
            return res.status(400).json({
                success: false,
                message: "Invalid visibility value"
            });
        }

        product.visibility = visibility;
        await product.save();

        res.status(200).json({
            success: true,
            message: `Product visibility updated to ${visibility}`,
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

const getSellerStatsById = async (req, res) => {
    try {
        if (!isSeller(req.user)) {
            return res.status(403).json({
                success: false,
                message: "Access denied: Seller only"
            });
        }

        const stats = await Product.aggregate([
            {
                $match: {
                    seller: req.user.id,
                    isDeleted: false
                }
            },
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    totalStock: { $sum: "$stockQuantity" },
                    totalSold: { $sum: "$sold" },
                    totalRevenue: { $sum: { $multiply: ["$sold", "$price"] } },
                    averageRating: { $avg: "$ratingsAverage" },
                    lowStockCount: {
                        $sum: {
                            $cond: [
                                { $lte: ["$stockQuantity", "$lowStockThreshold"] },
                                1,
                                0
                            ]
                        }
                    },
                    publishedCount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$visibility", "Published"] },
                                1,
                                0
                            ]
                        }
                    },
                    draftCount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$visibility", "Draft"] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const categoryStats = await Product.aggregate([
            {
                $match: {
                    seller: req.user.id,
                    isDeleted: false
                }
            },
            {
                $group: {
                    _id: "$category",
                    count: { $sum: 1 },
                    totalSold: { $sum: "$sold" },
                    totalRevenue: { $sum: { $multiply: ["$sold", "$price"] } }
                }
            },
            { $sort: { totalSold: -1 } }
        ]);

        res.status(200).json({
            success: true,
            stats: stats[0] || {
                totalProducts: 0,
                totalStock: 0,
                totalSold: 0,
                totalRevenue: 0,
                averageRating: 0,
                lowStockCount: 0,
                publishedCount: 0,
                draftCount: 0
            },
            categoryStats
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

const getSellerStats = async (req, res) => {
    try {
        const sellers = await User.find({ role: 'seller' })
            .select('name email accountStatus');

        const products = await Product.find({});

        const sellersWithStats = sellers.map(seller => {
            const sellerProducts = products.filter(p => p.seller.toString() === seller._id.toString());
            const revenue = sellerProducts.reduce((acc, p) => acc + (p.price || 0), 0);
            const productsCount = sellerProducts.length;

            return {
                ...seller.toObject(),
                revenue,
                productsCount
            };
        });

        res.status(200).json({ success: true, sellers: sellersWithStats });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error });
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
    updateStock,
    toggleFeatured,
    updateVisibility,
    getSellerStatsById,
    getSellerStats,
    getOutOfStockProducts
};