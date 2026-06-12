import express from 'express';
import { auth } from '../middleware/auth.js';
import { getAnalytics, searchUsers, lookupPhone } from '../controllers/userController.js';

const router = express.Router();

router.get('/analytics', auth, getAnalytics);
router.get('/lookup', auth, lookupPhone);
router.get('/search', auth, searchUsers);

export default router;
