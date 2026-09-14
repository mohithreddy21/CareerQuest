import { create } from 'zustand';
// import { persist } from 'zustand/middleware';
import type { NotificationStatus, NotificationAction } from '@/components/ui/notification-card';

export type Notification = {
  id: string;
  title: string;
  body: string;
  status: NotificationStatus;
  createdAt: string;
  actions?: NotificationAction[];
};

type NotificationState = {
  notifications: Notification[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  addNotification: (notification: Omit<Notification, 'status'>) => void;
  unreadCount: () => number;
};

const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'High match opportunity discovered',
    body: 'Senior Full-Stack Engineer at Stripe (94% match) has been added to your discovery feed.',
    status: 'unread',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    actions: [
      {
        id: 'view-job',
        label: 'View job',
        type: 'redirect',
        style: 'primary'
      }
    ]
  },
  {
    id: '2',
    title: 'Interview confirmed',
    body: 'Technical screening scheduled with Linear for Senior Platform Engineer.',
    status: 'unread',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    actions: [
      {
        id: 'view-application',
        label: 'View application',
        type: 'redirect',
        style: 'primary'
      }
    ]
  },
  {
    id: '3',
    title: 'Resume tailoring ready',
    body: 'Targeted resume draft prepared for Stripe Senior Full-Stack role.',
    status: 'unread',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    actions: [
      {
        id: 'view-resume',
        label: 'Review resume',
        type: 'redirect',
        style: 'primary'
      }
    ]
  },
  {
    id: '4',
    title: 'Application follow-up due',
    body: 'Follow up recommended for Datadog application submitted 7 days ago.',
    status: 'read',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    actions: [
      {
        id: 'view-application',
        label: 'Open applications',
        type: 'redirect',
        style: 'primary'
      }
    ]
  }
];

export const useNotificationStore = create<NotificationState>()(
  // To enable persistence across refreshes, uncomment the persist wrapper below:
  // persist(
  (set, get) => ({
    notifications: mockNotifications,

    markAsRead: (id) =>
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, status: 'read' as const } : n
        )
      })),

    markAllAsRead: () =>
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          status: 'read' as const
        }))
      })),

    removeNotification: (id) =>
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
      })),

    addNotification: (notification) =>
      set((state) => ({
        notifications: [{ ...notification, status: 'unread' as const }, ...state.notifications]
      })),

    unreadCount: () => get().notifications.filter((n) => n.status === 'unread').length
  })
  //   ,
  //   { name: 'notifications' }
  // )
);
