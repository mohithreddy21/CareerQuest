import {
  KnowledgeItem,
  SkillKnowledgeContent,
  ExperienceKnowledgeContent,
  ProjectKnowledgeContent,
  EducationKnowledgeContent,
  CertificationKnowledgeContent
} from '@/types/domain';

export class DuplicateDetectionService {
  // Canonical dictionary for common technology aliases
  private static skillAliases: Record<string, string> = {
    postgres: 'PostgreSQL',
    postgresql: 'PostgreSQL',
    react: 'React',
    'react.js': 'React',
    reactjs: 'React',
    'react 19': 'React 19',
    node: 'Node.js',
    'node.js': 'Node.js',
    nodejs: 'Node.js',
    typescript: 'TypeScript',
    ts: 'TypeScript',
    javascript: 'JavaScript',
    js: 'JavaScript',
    esnext: 'JavaScript',
    go: 'Go',
    golang: 'Go',
    k8s: 'Kubernetes',
    kubernetes: 'Kubernetes',
    aws: 'AWS',
    'amazon web services': 'AWS',
    tailwind: 'Tailwind CSS',
    tailwindcss: 'Tailwind CSS',
    redis: 'Redis',
    graphql: 'GraphQL',
    docker: 'Docker',
    grpc: 'gRPC',
    python: 'Python',
    nextjs: 'Next.js',
    'next.js': 'Next.js'
  };

  /**
   * Normalize a skill name to canonical spelling
   */
  normalizeSkill(rawName: string): string {
    const cleaned = rawName.trim().toLowerCase();
    return DuplicateDetectionService.skillAliases[cleaned] || rawName.trim();
  }

  /**
   * Find matching skill in existing approved skills
   */
  findMatchingSkill(
    incomingName: string,
    existingSkills: KnowledgeItem<SkillKnowledgeContent>[]
  ): {
    matchType: 'exact' | 'alias' | 'none';
    existingItem?: KnowledgeItem<SkillKnowledgeContent>;
  } {
    const canonicalIncoming = this.normalizeSkill(incomingName).toLowerCase();
    const rawIncoming = incomingName.trim().toLowerCase();

    for (const item of existingSkills) {
      const canonicalExisting = this.normalizeSkill(item.content.name).toLowerCase();
      const rawExisting = item.content.name.trim().toLowerCase();

      if (rawIncoming === rawExisting) {
        return { matchType: 'exact', existingItem: item };
      }
      if (canonicalIncoming === canonicalExisting) {
        return { matchType: 'alias', existingItem: item };
      }
    }

    return { matchType: 'none' };
  }

  /**
   * Find matching experience by employer and date overlap
   */
  findMatchingExperience(
    incomingEmployer: string,
    incomingStartDate: string,
    existingExperiences: KnowledgeItem<ExperienceKnowledgeContent>[]
  ): KnowledgeItem<ExperienceKnowledgeContent> | null {
    const normEmployer = incomingEmployer
      .toLowerCase()
      .replace(/inc\.?|llc|corp\.?/gi, '')
      .trim();

    for (const exp of existingExperiences) {
      const existingNormEmployer = exp.content.employer
        .toLowerCase()
        .replace(/inc\.?|llc|corp\.?/gi, '')
        .trim();

      if (normEmployer === existingNormEmployer) {
        // Same employer
        return exp;
      }
    }
    return null;
  }

  /**
   * Find matching project by name
   */
  findMatchingProject(
    incomingName: string,
    existingProjects: KnowledgeItem<ProjectKnowledgeContent>[]
  ): KnowledgeItem<ProjectKnowledgeContent> | null {
    const norm = incomingName.toLowerCase().trim();
    for (const proj of existingProjects) {
      if (proj.content.name.toLowerCase().trim() === norm) {
        return proj;
      }
    }
    return null;
  }

  /**
   * Find matching education by institution
   */
  findMatchingEducation(
    incomingInstitution: string,
    existingEducation: KnowledgeItem<EducationKnowledgeContent>[]
  ): KnowledgeItem<EducationKnowledgeContent> | null {
    const norm = incomingInstitution.toLowerCase().trim();
    for (const edu of existingEducation) {
      if (
        edu.content.institution.toLowerCase().trim().includes(norm) ||
        norm.includes(edu.content.institution.toLowerCase().trim())
      ) {
        return edu;
      }
    }
    return null;
  }

  /**
   * Find matching certification by name
   */
  findMatchingCertification(
    incomingName: string,
    existingCerts: KnowledgeItem<CertificationKnowledgeContent>[]
  ): KnowledgeItem<CertificationKnowledgeContent> | null {
    const norm = incomingName.toLowerCase().trim();
    for (const cert of existingCerts) {
      if (cert.content.name.toLowerCase().trim() === norm) {
        return cert;
      }
    }
    return null;
  }
}

export const duplicateDetectionService = new DuplicateDetectionService();
