const Ticket = require('../models/tickets');
const { sendTicketStatusEmail } = require('../utilities/email'); 

const createTicket = async (req, res) => {
    try {
        const user = req.user; 

        if (!user || (!user._id && !user.id)) {
            return res.status(401).json({ message: "Authentication required." });
        }
        
        const userId = user._id || user.id;

        const { 
            subject, message, orderNumber, category, 
            name, email, phone 
        } = req.body;

        if (!subject || !message || !name || !email || !phone) {
            return res.status(400).json({ message: "All fields (subject, message, name, email, phone) are required" });
        }
        const random = Math.floor(1000 + Math.random() * 9000);
        const timestamp = Date.now().toString().slice(-4);      
        // ==========================================================

        const newTicket = new Ticket({
            user: userId,
            ticketNumber: generatedTicketNumber, 
            
            contactDetails: {
                name, email, phone
            },
            subject,
            message,
            orderNumber: orderNumber || null,
            category: category || "Other", 
            status: 'Open'
        });

        await newTicket.save();
        
        res.status(201).json({ message: "Ticket created successfully", ticket: newTicket });
    } catch (err) {
        console.error("Create Ticket Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const getTickets = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        let tickets;
        
        if (req.user.role === "admin" || req.user.role === "support") {
            tickets = await Ticket.find()
                .populate('user', 'name email')
                .populate('assignedTo', 'name')
                .sort({ createdAt: -1 });
        } else {
            tickets = await Ticket.find({ user: userId }) 
                .populate('assignedTo', 'name')
                .sort({ createdAt: -1 });
        }
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const getTicketById = async (req, res) => {
    try {
        const userId = (req.user._id || req.user.id).toString();

        const ticket = await Ticket.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate('assignedTo', 'name')
            .populate('responses.sender', 'name role');

        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        const isOwner = ticket.user._id.toString() === userId;
        const isAdminOrSupport = req.user.role === "admin" || req.user.role === "support";

        if (!isAdminOrSupport && !isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }
        res.json(ticket);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const updateTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        if (req.user.role !== "admin" && req.user.role !== "support") {
            return res.status(403).json({ message: "Access denied." });
        }

        const allowedUpdates = ["status", "assignedTo", "category"];
        const oldStatus = ticket.status;

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                ticket.set(field, req.body[field]);
            }
        });

        const statusChanged = oldStatus !== ticket.status;

        try {
            await ticket.validate();
        } catch (validationErr) {
             return res.status(400).json({ message: "Validation Error", errors: validationErr.errors });
        }

        await ticket.save();

        if (statusChanged) {
            if (typeof sendTicketStatusEmail === 'function') {
                try {
                    await sendTicketStatusEmail(
                        ticket.contactDetails.email, 
                        ticket.contactDetails.name, 
                        ticket.ticketNumber, 
                        ticket.status
                    );
                } catch (emailErr) {
                    console.error("Email notification failed:", emailErr.message);
                }
            }
        }
        
        res.json({ message: "Ticket updated successfully", ticket });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const addResponse = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        const user = req.user;
        const userId = user._id || user.id;
        const { message } = req.body;
        
        if (!message) return res.status(400).json({ message: "Message is required" });

        let senderRole = user.role; 
        if (!["admin", "support", "seller", "buyer"].includes(senderRole)) {
            senderRole = "buyer";
        }

        ticket.responses.push({ 
            sender: userId, 
            role: senderRole, 
            message 
        });

        const isStaff = ["support", "admin", "seller"].includes(user.role);

        if (isStaff) {
            if (ticket.status !== "Closed") ticket.status = "Waiting for Customer Response";
        } else {
            if (ticket.status !== "Closed") ticket.status = "In Progress";
        }

        await ticket.save();
        res.json({ message: "Response added", ticket });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const deleteTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        const userId = (req.user._id || req.user.id).toString();
        const isOwner = ticket.user.toString() === userId; 

        if (req.user.role !== "admin" && !isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }

        await ticket.deleteOne();
        res.json({ message: "Ticket deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
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