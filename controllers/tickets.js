const Ticket = require('../models/tikcets');

const createTicket = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Authentication required" });

        const { subject, message, orderNumber, category } = req.body;
        if (!subject || !message) return res.status(400).json({ message: "Subject and message are required" });

        const newTicket = new Ticket({
            user: user._id,
            subject,
            message,
            orderNumber: orderNumber || null,
            category: category || "Other",
        });

        await newTicket.save();
        res.status(201).json({ message: "Ticket created successfully", ticket: newTicket });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

const getTickets = async (req, res) => {
    try {
        let tickets;
        if (req.user.role === "admin" || req.user.role === "support") {
            tickets = await Ticket.find().populate('user').populate('assignedTo').populate('responses.support');
        } else {
            tickets = await Ticket.find({ user: req.user._id }).populate('assignedTo').populate('responses.support');
        }
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

const getTicketById = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id).populate('user').populate('assignedTo').populate('responses.support');
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });
        if (req.user.role !== "admin" && req.user.role !== "support" && ticket.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied" });
        }
        res.json(ticket);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

const updateTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });
        if (req.user.role !== "admin" && req.user.role !== "support" && ticket.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied" });
        }

        const allowedUpdates = ["subject", "message", "status", "assignedTo", "category"];
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) ticket[field] = req.body[field];
        });

        await ticket.save();
        const populatedTicket = await ticket.populate('user').populate('assignedTo').populate('responses.support');
        res.json({ message: "Ticket updated successfully", ticket: populatedTicket });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

const addResponse = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        const user = req.user;
        const { message } = req.body;
        if (!message) return res.status(400).json({ message: "Response message required" });

        ticket.responses.push({ support: user._id, message });
        await ticket.save();
        const populatedTicket = await ticket.populate('user').populate('assignedTo').populate('responses.support');
        res.json({ message: "Response added successfully", ticket: populatedTicket });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

const deleteTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });
        if (req.user.role !== "admin" && ticket.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied" });
        }

        await ticket.remove();
        res.json({ message: "Ticket deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

module.exports = {
    createTicket,
    getTickets,
    getTicketById,
    updateTicket,
    addResponse,
    deleteTicket
};
