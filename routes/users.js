const express = require('express');
const router = express.Router();
const { createUser, login, getUserById, updateUserById, deleteUserById, listUsers } = require('../controllers/users');
const { auth, authorize } = require('../middleware/auth');

router.post('/register', createUser);
router.post('/login', login);
router.get('/', auth, authorize('admin'), listUsers);
router.get('/:id', auth, getUserById);
router.put('/:id', auth, updateUserById);
router.delete('/:id', auth, deleteUserById);

module.exports = router;
