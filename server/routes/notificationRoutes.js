import express from 'express';
import { auth } from '../middleware/auth.js';
import {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from '../controllers/notificationController.js';

const router = express.Router();

router.use(auth);

// GET /api/notifications  → unread notifications for the logged-in user
router.get('/', getNotifications);

// POST /api/notifications/read-all  → mark every unread as read
router.post('/read-all', markAllNotificationsRead);

// POST /api/notifications/:id/read  → mark one notification as read
router.post('/:id/read', markNotificationRead);

export default router;
