const FAQ = require('../models/faq');

const createFAQ = async (req, res) => {
    try {
        const { question, answer, category } = req.body;

        if (!question || !answer || !category) {
            return res.status(400).json({ message: "All fields (Question, Answer, Category) are required" });
        }

        const newFAQ = new FAQ({
            question,
            answer,
            category,
            isActive: true 
        });

        await newFAQ.save();
        res.status(201).json({ message: "FAQ created successfully", faq: newFAQ });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const getPublicFAQs = async (req, res) => {
    try {
        const { category } = req.query;
        let query = { isActive: true }; 

        if (category) {
            query.category = category;
        }

        const faqs = await FAQ.find(query).sort({ category: 1, createdAt: -1 });
        res.json(faqs);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
const getAllFAQs = async (req, res) => {
    try {
        const faqs = await FAQ.find().sort({ createdAt: -1 });
        res.json(faqs);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const updateFAQ = async (req, res) => {
    try {
        const faq = await FAQ.findById(req.params.id);
        if (!faq) return res.status(404).json({ message: "FAQ not found" });

        const allowedUpdates = ["question", "answer", "category", "isActive"];
        
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                faq[field] = req.body[field];
            }
        });

        await faq.save();
        res.json({ message: "FAQ updated successfully", faq });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const deleteFAQ = async (req, res) => {
    try {
        const faq = await FAQ.findById(req.params.id);
        if (!faq) return res.status(404).json({ message: "FAQ not found" });

        await faq.deleteOne();
        res.json({ message: "FAQ deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

module.exports = {
    createFAQ,
    getPublicFAQs,
    getAllFAQs,
    updateFAQ,
    deleteFAQ
};