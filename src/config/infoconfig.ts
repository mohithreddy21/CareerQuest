import type { InfobarContent } from '@/components/ui/infobar';

export const discoverInfoContent: InfobarContent = {
  title: 'Job Discovery & Match Engine',
  sections: [
    {
      title: 'Overview',
      description:
        'Discover high-signal job opportunities scored against your candidate profile. Each role includes deep requirement breakdown, match analysis, and direct application links.',
      links: []
    },
    {
      title: 'Match Breakdown',
      description:
        'Match percentages reflect technical alignment, seniority fit, culture, and domain experience. Red flags and missing requirements are highlighted transparently.',
      links: []
    }
  ]
};

export const applicationsInfoContent: InfobarContent = {
  title: 'Application Pipeline',
  sections: [
    {
      title: 'Workflow Stages',
      description:
        'Track opportunities across 7 lifecycle stages: Discovered, Interested, Preparing, Applied, Interview, Offer, and Rejected. Drag cards across columns or use the status menu.',
      links: []
    },
    {
      title: 'Preparation Workspace',
      description:
        'For roles in Preparing stage, generate targeted resumes and tailored cover letters before applying directly on company portals.',
      links: []
    }
  ]
};

export const resumeInfoContent: InfobarContent = {
  title: 'Resume & Profile System',
  sections: [
    {
      title: 'Base Profile',
      description:
        'Your verified master profile contains core skills, career history, and portfolio accomplishments used as ground truth for all job matching.',
      links: []
    },
    {
      title: 'Targeted Tailoring',
      description:
        'When tailoring a resume for a specific job, view diffs item-by-item. Every modification requires your explicit review and approval before export.',
      links: []
    }
  ]
};
