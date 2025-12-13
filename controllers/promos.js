const Promotion = require("../models/promos");

/* =====================================================
   CREATE PROMO  (ADMIN)
===================================================== */
const createPromo = async (req, res) => {
    try {
        let {
            code,
            type,
            value,
            minPurchase,
            startDate,
            endDate,
            usageLimitPerUser,
            totalUsageLimit
        } = req.body;

        if (!code || !type || value === undefined || !startDate || !endDate) {
            return res.status(400).json({ message: "Required fields are missing" });
        }

        code = code.toUpperCase();

        // -------- type validation --------
        if (type === "Percentage" && (value <= 0 || value > 100)) {
            return res.status(400).json({ message: "Percentage must be between 1 and 100" });
        }

        if (type === "Fixed" && value <= 0) {
            return res.status(400).json({ message: "Fixed discount must be greater than 0" });
        }

        if (type === "FreeShipping" && value !== 0) {
            return res.status(400).json({ message: "FreeShipping value must be 0" });
        }

        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({ message: "startDate must be before endDate" });
        }

        const existingPromo = await Promotion.findOne({ code });
        if (existingPromo) {
            return res.status(400).json({ message: "Promo code already exists" });
        }

        const promo = await Promotion.create({
            code,
            type,
            value,
            minPurchase: minPurchase ?? 0,
            startDate,
            endDate,
            usageLimitPerUser: usageLimitPerUser ?? null,
            totalUsageLimit: totalUsageLimit ?? null,
            createdBy: req.user._id
        });

        res.status(201).json({
            message: "Promo created successfully",
            promo
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

/* =====================================================
   GET PUBLIC PROMOS (NO AUTH)
===================================================== */
const getPublicPromos = async (req, res) => {
    try {
        const now = new Date();

        const promos = await Promotion.find({
            active: true,
            startDate: { $lte: now },
            endDate: { $gte: now }
        }).select("code type value minPurchase endDate");

        res.status(200).json({ promos });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

/* =====================================================
   GET ADMIN PROMOS (ADMIN ONLY)
===================================================== */
const getAdminPromos = async (req, res) => {
    try {
        const promos = await Promotion.find({
            createdBy: req.user._id
        }).sort({ createdAt: -1 });

        res.status(200).json({ promos });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

/* =====================================================
   UPDATE PROMO (ADMIN)
===================================================== */
const updatePromo = async (req, res) => {
    try {
        const promo = await Promotion.findById(req.params.id);
        if (!promo) {
            return res.status(404).json({ message: "Promo not found" });
        }

        // allow only these fields
        const allowedFields = [
            "type",
            "value",
            "minPurchase",
            "startDate",
            "endDate",
            "usageLimitPerUser",
            "totalUsageLimit",
            "active"
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                promo[field] = req.body[field];
            }
        });

        // -------- re-validation --------
        if (promo.type === "Percentage" && (promo.value <= 0 || promo.value > 100)) {
            return res.status(400).json({ message: "Percentage must be between 1 and 100" });
        }

        if (promo.type === "Fixed" && promo.value <= 0) {
            return res.status(400).json({ message: "Fixed discount must be greater than 0" });
        }

        if (promo.type === "FreeShipping" && promo.value !== 0) {
            return res.status(400).json({ message: "FreeShipping value must be 0" });
        }

        if (new Date(promo.startDate) >= new Date(promo.endDate)) {
            return res.status(400).json({ message: "startDate must be before endDate" });
        }

        await promo.save();

        res.status(200).json({
            message: "Promo updated successfully",
            promo
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

/* =====================================================
   DELETE PROMO (ADMIN)
===================================================== */
const deletePromo = async (req, res) => {
    try {
        const promo = await Promotion.findByIdAndDelete(req.params.id);
        if (!promo) {
            return res.status(404).json({ message: "Promo not found" });
        }

        res.status(200).json({ message: "Promo deleted successfully" });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

module.exports = {
    createPromo,
    getPublicPromos,
    getAdminPromos,
    updatePromo,
    deletePromo
};
