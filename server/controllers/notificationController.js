import Notification from '../models/Notification.js';

/**
 * GET /api/notifications
 * Returns all unread notifications for the currently authenticated user,
 * newest first. The frontend can poll this or trigger it after receiving
 * a `budget_alert` / `settlement_created` socket event.
 */
export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({
            userId: req.userId,
            read: false,
        })
            .sort({ createdAt: -1 })
            .limit(50)          // cap the payload size
            .lean();

        res.json({ notifications, count: notifications.length });
    } catch (error) {
        console.error('getNotifications error:', error);
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
};

/**
 * POST /api/notifications/:id/read
 * Marks a single notification as read for the authenticated user.
 * Only the owner may mark their own notification read.
 */
export const markNotificationRead = async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            userId: req.userId,     // ownership check
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        notification.read = true;
        await notification.save();

        res.json({ message: 'Notification marked as read', notification });
    } catch (error) {
        console.error('markNotificationRead error:', error);
        res.status(500).json({ message: 'Failed to mark notification as read' });
    }
};

/**
 * POST /api/notifications/read-all
 * Convenience endpoint: marks ALL unread notifications for the user as read.
 */
export const markAllNotificationsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.userId, read: false },
            { read: true }
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('markAllNotificationsRead error:', error);
        res.status(500).json({ message: 'Failed to mark notifications as read' });
    }
};
