const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth'); // تأكد من المسار

const { 
    createTicket, 
    getTickets, 
    getTicketById, 
    updateTicket, 
    addResponse, 
    deleteTicket 
} = require('../controllers/tickets');

// 1. إنشاء تذكرة (Auth Required)
router.post('/', auth, createTicket);

// 2. عرض التذاكر
router.get('/', auth, getTickets);

// 3. عرض تذكرة واحدة
router.get('/:id', auth, getTicketById);

// 4. إضافة رد
router.post('/:id/response', auth, addResponse);

// 5. تعديل التذكرة (Admin/Support Only)
router.put('/:id', auth, authorize('admin', 'support'), updateTicket);

// 6. حذف التذكرة
router.delete('/:id', auth, deleteTicket);

module.exports = router;