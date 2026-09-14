import { NavGroup } from '@/types';

/**
 * CareerQuest Navigation Configuration
 *
 * Primary navigation items representing the job-search lifecycle:
 * 1. Dashboard
 * 2. Discover Jobs
 * 3. Applications
 * 4. Resume & Profile
 * 5. Settings
 */
export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard/overview',
        icon: 'dashboard',
        isActive: false,
        shortcut: ['d', 'd'],
        items: []
      },
      {
        title: 'Discover Jobs',
        url: '/dashboard/discover',
        icon: 'search',
        isActive: false,
        shortcut: ['j', 'j'],
        items: []
      },
      {
        title: 'Applications',
        url: '/dashboard/applications',
        icon: 'kanban',
        isActive: false,
        shortcut: ['a', 'a'],
        items: []
      },
      {
        title: 'Resume & Profile',
        url: '/dashboard/resume',
        icon: 'user',
        isActive: false,
        shortcut: ['r', 'r'],
        items: []
      }
    ]
  },
  {
    label: 'Preferences',
    items: [
      {
        title: 'Settings',
        url: '/dashboard/settings',
        icon: 'settings',
        isActive: false,
        shortcut: ['s', 's'],
        items: []
      }
    ]
  }
];
