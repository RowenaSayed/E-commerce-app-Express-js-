const Category = require('../models/category');
const slugify = require('slugify');

const createCategory = async (req, res) => {
    try {
        const { name, parent_id, image } = req.body;
        if (!name) return res.status(400).json({ message: 'Category name is required' });

        const existCategory = await Category.findOne({ name });
        if (existCategory) return res.status(400).json({ message: 'This category already exists!' });

        const slug = slugify(name, { lower: true, strict: true });

        const newCat = await Category.create({
            name,
            slug,
            parent_id: parent_id || null,
            image: image || null
        });

        res.status(201).json({ message: "Category added successfully!", category: newCat });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

const updateCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const { name, parent_id, image } = req.body;

        const category = await Category.findById(categoryId);
        if (!category) return res.status(404).json({ message: "Category does not exist" });

        if (name) {
            category.name = name;
            category.slug = slugify(name, { lower: true, strict: true });
        }

        if (parent_id !== undefined) category.parent_id = parent_id;
        if (image !== undefined) category.image = image;

        await category.save();
        res.status(200).json({ message: "Category has been updated successfully!", category });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Category.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ message: "Category not found" });
        res.status(200).json({ message: "Category deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

const getCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 });
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

module.exports = {
    createCategory,
    updateCategory,
    deleteCategory,
    getCategories
};
