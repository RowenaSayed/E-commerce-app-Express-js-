const express = require('express');
const router = express.Router();
const { createTicket, getTickets, getTicketById, updateTicket, addResponse, deleteTicket } = require('../controllers/tickets');
const { auth, authorize } = require('../middleware/auth');

router.post('/', auth, createTicket);
router.get('/', auth, getTickets);
router.get('/:id', auth, getTicketById);
router.put('/:id', auth, updateTicket);
router.post('/:id/response', auth, authorize(['support', 'admin']), addResponse);
router.delete('/:id', auth, authorize(['support', 'admin']), deleteTicket);

module.exports = router;
