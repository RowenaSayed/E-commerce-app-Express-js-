const Product = require('../models/products');

const createProduct = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        // Only admin or seller can add products
        if (user.role !== 'admin' && user.role !== 'seller') {
            return res.status(403).json({ message: "Only admin or seller can add products" });
        }

        const {
            name,
            description,
            category,
            subCategory,
            brand,
            sku,
            condition,
            price,
            stockQuantity,
            usedDetails,
            importedDetails,
            technicalSpecs,
            warranty,
            images,
            isFeatured,
            visibility
        } = req.body;

        // Required fields according to schema
        if (!name || !category || !condition || !price) {
            return res.status(400).json({ message: "Required fields: name, category, condition, price" });
        }

        const newProduct = await Product.create({
            seller: user.id, 
            name,
            description: description || "",
            category,
            subCategory: subCategory || "",
            brand: brand || "",
            sku: sku || "",
            condition,
            price,
            stockQuantity: stockQuantity || 0,
            usedDetails: usedDetails || {},
            importedDetails: importedDetails || {},
            technicalSpecs: technicalSpecs || {},
            warranty: warranty || {},
            images: images || [],
            isFeatured: isFeatured || false,
            visibility: visibility || "Published"
        });

        res.status(201).json({
            message: "Product added successfully",
            product: newProduct
        });

    } catch (error) {
        res.status(500).json({
            message: "Server Error",
            error: error.message
        });
    }
};

const updateProduct = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Check if user is owner or admin
        if (product.seller.toString() !== user.id.toString() && user.role !== 'admin') {
            return res.status(403).json({ message: "You can only update your own products" });
        }

        const updates = req.body;

        // Update fields
        Object.keys(updates).forEach(key => {
            if (updates[key] !== undefined) {
                product[key] = updates[key];
            }
        });

        await product.save();

        res.status(200).json({
            message: "Product updated successfully",
            product
        });

    } catch (error) {
        res.status(500).json({
            message: "Server Error",
            error: error.message
        });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Check if user is owner or admin
        if (product.seller.toString() !== user.id.toString() && user.role !== 'admin') {
            return res.status(403).json({ message: "You can only delete your own products" });
        }

        await Product.findByIdAndDelete(req.params.id);

        res.status(200).json({
            message: "Product deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            message: "Server Error",
            error: error.message
        });
    }
};

const getProducts = async (req, res) => {
    try {
        const { category, condition, minPrice, maxPrice, brand } = req.query;

        let filter = { visibility: "Published" };

        if (category) filter.category = category;
        if (condition) filter.condition = condition;
        if (brand) filter.brand = brand;
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }

        const products = await Product.find(filter)
            .populate('seller', 'name profilePicture')
            .sort({ isFeatured: -1, createdAt: -1, price: 1 });

        if (products.length === 0) {
            return res.status(404).json({
                message: "No products found",
                filters: req.query
            });
        }

        res.status(200).json({
            count: products.length,
            products
        });

    } catch (error) {
        res.status(500).json({
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
            return res.status(404).json({ message: "Product not found" });
        }

        const similarProducts = await Product.find({
            _id: { $ne: product._id },
            category: product.category,
            visibility: "Published"
        })
            .limit(4)
            .select('name price condition brand images category')
            .populate('seller', 'name')
            .sort({ isFeatured: -1, createdAt: -1 });

        res.status(200).json({
            product,
            similar: similarProducts
        });

    } catch (error) {
        res.status(500).json({
            message: "Server Error",
            error: error.message
        });
    }
};

const getProductByCategory = async (req, res) => {
    try {
        const category = req.params.category;

        const products = await Product.find({
            category: category,
            visibility: "Published"
        })
            .populate('seller', 'name profilePicture')
            .sort({ isFeatured: -1, price: 1, createdAt: -1 });

        res.status(200).json({
            category,
            count: products.length,
            products
        });

    } catch (error) {
        res.status(500).json({
            message: "Server Error",
            error: error.message
        });
    }
};

const getProductsBySeller = async (req, res) => {
    try {
        const sellerId = req.params.sellerId || req.user?._id;

        if (!sellerId) {
            return res.status(400).json({ message: "Seller ID is required" });
        }

        const products = await Product.find({
            seller: sellerId
        })
            .populate('seller', 'name profilePicture')
            .sort({ createdAt: -1 });

        res.status(200).json({
            count: products.length,
            products
        });

    } catch (error) {
        res.status(500).json({
            message: "Server Error",
            error: error.message
        });
    }
};

module.exports = {
    createProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    getProductById,
    getProductByCategory,
    getProductsBySeller
};