const Promotion = require('../models/promos');

const createPromo = async (req, res) => {
    try {
        const { code, type, value, minPurchase, startDate, endDate, usageLimitPerUser, totalUsageLimit } = req.body;
        if (!code || !type || !value || !startDate || !endDate) {
            return res.status(400).json({ message: "Required fields are missing" });
        }

        const existingPromo = await Promotion.findOne({ code });
        if (existingPromo) return res.status(400).json({ message: "Promo code already exists" });

        const newPromo = await Promotion.create({
            code,
            type,
            value,
            minPurchase: minPurchase || 0,
            startDate,
            endDate,
            usageLimitPerUser: usageLimitPerUser || null,
            totalUsageLimit: totalUsageLimit || null,
            active: true
        });

        res.status(201).json({ message: "Promo created successfully!", promo: newPromo });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

const updatePromo = async (req, res) => {
    try {
        const promo = await Promotion.findById(req.params.id);
        if (!promo) return res.status(404).json({ message: "Promo not found" });

        Object.keys(req.body).forEach(key => {
            if (req.body[key] !== undefined) promo[key] = req.body[key];
        });

        await promo.save();
        res.status(200).json({ message: "Promo updated successfully!", promo });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

const deletePromo = async (req, res) => {
    try {
        const promo = await Promotion.findByIdAndDelete(req.params.id);
        if (!promo) return res.status(404).json({ message: "Promo not found" });

        res.status(200).json({ message: "Promo deleted successfully" });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

module.exports = {
    createPromo,
    updatePromo,
    deletePromo
};
