const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { 
    createTicket, getTickets, getTicketById, 
    updateTicket, addResponse, deleteTicket 
} = require('../controllers/tickets');

router.post('/', auth, createTicket);
router.get('/', auth, getTickets);
router.get('/:id', auth, getTicketById);
router.post('/:id/response', auth, addResponse);
router.put('/:id', auth, authorize('admin', 'support'), updateTicket);
router.delete('/:id', auth, deleteTicket);

module.exports = router;