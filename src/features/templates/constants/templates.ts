import { ResumeTemplate, ResumeTemplateId } from '@/types/templates';

export const RESUME_TEMPLATES: Record<ResumeTemplateId, ResumeTemplate> = {
  'classic-v1': {
    id: 'classic-v1',
    name: 'Classic Professional',
    tagline: 'Traditional ATS-Optimized',
    description:
      'Clean, conventional hierarchy with traditional typography, formal section dividers, and maximum ATS readability.',
    version: '1.0',
    bestFor: 'Software Engineering, Finance, Corporate & Enterprise roles',
    layout: {
      fontFamily: 'font-serif',
      headerAlignment: 'center',
      sectionSpacing: 'normal',
      dividerStyle: 'solid',
      skillsDisplay: 'grouped',
      compactBullets: false
    }
  },
  'modern-v1': {
    id: 'modern-v1',
    name: 'Modern Tech',
    tagline: 'Contemporary & Structured',
    description:
      'Crisp sans-serif typography, restrained visual accents, clear section contrast, and modern executive polish.',
    version: '1.0',
    bestFor: 'High-growth Tech, Startups, Product Engineering & Scale-ups',
    layout: {
      fontFamily: 'font-sans',
      headerAlignment: 'left',
      sectionSpacing: 'relaxed',
      dividerStyle: 'accent',
      skillsDisplay: 'pills',
      compactBullets: false
    }
  },
  'compact-v1': {
    id: 'compact-v1',
    name: 'Compact Executive',
    tagline: 'High Information Density',
    description:
      'Tight spacing, space-efficient inline skill rows, and concise bullet indentation optimized for single-page presentation.',
    version: '1.0',
    bestFor: 'Senior ICs, Staff Engineers, and high-density 1-page summaries',
    layout: {
      fontFamily: 'font-sans',
      headerAlignment: 'left',
      sectionSpacing: 'tight',
      dividerStyle: 'subtle',
      skillsDisplay: 'inline',
      compactBullets: true
    }
  }
};

export const RESUME_TEMPLATE_LIST: ResumeTemplate[] = Object.values(RESUME_TEMPLATES);

export function getResumeTemplate(id?: string | null): ResumeTemplate {
  if (id && id in RESUME_TEMPLATES) {
    return RESUME_TEMPLATES[id as ResumeTemplateId];
  }
  return RESUME_TEMPLATES['classic-v1'];
}
