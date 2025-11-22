const Product = require('../models/products');

const createProduct = async (req, res) => {
    try {
        const user = req.user;
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Only admin can add products" });
        }

        const { name, description, category_id, subCategory, brand, sku, condition, price, stockQuantity, technicalSpecs, warranty, images, isFeatured, visibility } = req.body;

        if (!name || !category_id || !condition || !price) {
            return res.status(400).json({ message: "Required fields are missing" });
        }

        const newProduct = await Product.create({
            name,
            description: description || "",
            category_id,
            subCategory: subCategory || "",
            brand: brand || "",
            sku: sku || "",
            condition,
            price,
            stockQuantity: stockQuantity || 0,
            technicalSpecs: technicalSpecs || {},
            warranty: warranty || {},
            images: images || [],
            isFeatured: isFeatured || false,
            visibility: visibility || "Published"
        });

        res.status(201).json({ message: "Product added successfully", product: newProduct });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

const updateProduct = async (req, res) => {
    try {
        const user = req.user;
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Only admin can update products" });
        }

        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });

        Object.keys(req.body).forEach(key => {
            if (req.body[key] !== undefined) product[key] = req.body[key];
        });

        await product.save();
        res.status(200).json({ message: "Product updated successfully", product });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const user = req.user;
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Only admin can delete products" });
        }

        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });

        res.status(200).json({ message: "Product deleted successfully" });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

const getProducts = async (req, res) => {
    try {
        const products = await Product.find().populate('category_id');
        res.status(200).json({ products });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('category_id');
        if (!product) return res.status(404).json({ message: "Product not found" });
        res.status(200).json({ product });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

module.exports = {
    createProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    getProductById
};
