const Ticket = require('../models/tickets'); 
 const { sendStatusChangeEmail } = require('../utilities/email');   

// 1. Create Ticket
const createTicket = async (req, res) => {
    try {
        console.log("User making request:", req.user); 

        if (!req.user) {
            return res.status(401).json({ message: "Authentication required. Please login first." });
        }

        const { 
            subject, message, orderNumber, category, 
            name, email, phone 
        } = req.body;

        // التحقق من البيانات القادمة من البوست مان
        if (!subject || !message || !name || !email || !phone) {
            return res.status(400).json({ message: "All fields (subject, message, name, email, phone) are required" });
        }

        const newTicket = new Ticket({
            // 👇👇 الحل هنا: لازم نربط التذكرة باليوزر 👇👇
            user: req.user._id, 
            
            contactDetails: {
                name,
                email,
                phone
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
// 2. Get Tickets
const getTickets = async (req, res) => {
    try {
        let tickets;
        // الأدمن والدعم يرون كل التذاكر
        if (req.user.role === "admin" || req.user.role === "support") {
            tickets = await Ticket.find()
                .populate('user', 'name email')
                .populate('assignedTo', 'name')
                .sort({ createdAt: -1 });
        } else {
            // العميل يرى تذاكره فقط
            tickets = await Ticket.find({ user: req.user._id })
                .populate('assignedTo', 'name')
                .sort({ createdAt: -1 });
        }
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 3. Get Ticket By ID
const getTicketById = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate('assignedTo', 'name')
            .populate('responses.sender', 'name role');

        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        // التحقق من الصلاحية
        if (req.user.role !== "admin" && req.user.role !== "support" && ticket.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied" });
        }
        res.json(ticket);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 4. Update Ticket (Status or Assign)
const updateTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        // الحماية: فقط الدعم والأدمن
        if (req.user.role !== "admin" && req.user.role !== "support") {
            return res.status(403).json({ message: "Access denied." });
        }

        const allowedUpdates = ["status", "assignedTo", "category"];
        let statusChanged = false;

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                // نتحقق لو الحالة اتغيرت فعلاً
                if (field === "status" && ticket.status !== req.body[field]) {
                    statusChanged = true;
                }
                ticket[field] = req.body[field];
            }
        });

        await ticket.save();

        // 👇👇👇 هنا التصحيح: شلنا النقاط (...) وحطينا البيانات الصح 👇👇👇
        if (statusChanged) {
            // نتأكد إن دالة الإيميل موجودة قبل ما نستخدمها
            if (typeof sendStatusChangeEmail === 'function') {
                await sendStatusChangeEmail(
                    ticket.contactDetails.email, // إيميل العميل
                    ticket.contactDetails.name,  // اسم العميل
                    ticket.ticketNumber,         // رقم التذكرة
                    ticket.status                // الحالة الجديدة
                );
            }
        }
        res.json({ message: "Ticket updated successfully", ticket });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
    

// 5. Add Response
const addResponse = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        const user = req.user;
        const { message } = req.body;
        
        if (!message) return res.status(400).json({ message: "Message is required" });

        // تحديد الدور بدقة ليتطابق مع الـ Enum في المودل
        let senderRole = "Customer";
        if (user.role === "admin") senderRole = "Admin";
        if (user.role === "support") senderRole = "Support";

        // إضافة الرد
        ticket.responses.push({ 
            sender: user._id, 
            role: senderRole, 
            message 
        });

        // تحديث الحالة تلقائياً
        if (senderRole === "Support" || senderRole === "Admin") {
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

// 6. Delete Ticket
const deleteTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        if (req.user.role !== "admin" && ticket.user.toString() !== req.user._id.toString()) {
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