import { Job, JobAnalysis, CandidateProfile } from '@/types/domain';
import { KnowledgeItem } from '@/types/knowledge';
import { TailoredResumeVersion } from '@/types/tailoring';
import { GroundedCoverLetter } from '@/types/preparation';

export interface CoverLetterProvider {
  generateCoverLetter(params: {
    job: Job;
    analysis?: JobAnalysis | null;
    approvedKnowledge: KnowledgeItem[];
    tailoredResume: TailoredResumeVersion;
    candidate: CandidateProfile;
  }): Promise<GroundedCoverLetter>;
}

export class MockCoverLetterProvider implements CoverLetterProvider {
  async generateCoverLetter({
    job,
    analysis: _analysis,
    approvedKnowledge,
    tailoredResume,
    candidate
  }: {
    job: Job;
    analysis?: JobAnalysis | null;

    approvedKnowledge: KnowledgeItem[];
    tailoredResume: TailoredResumeVersion;
    candidate: CandidateProfile;
  }): Promise<GroundedCoverLetter> {
    const candidateName = candidate.name || 'Candidate';
    const company = job.company;
    const role = job.title;

    // Positive evidence gathering from approved knowledge items
    const sourceKnowledgeItemIds: string[] = [];
    const evidenceReferences: string[] = [];

    // Find verified experience and skills
    const veloceExp = approvedKnowledge.find((k) => {
      if (k.category !== 'experience') return false;
      const c = k.content as { employer?: string };
      return c.employer?.toLowerCase().includes('veloce');
    });
    if (veloceExp) {
      sourceKnowledgeItemIds.push(veloceExp.id);
      evidenceReferences.push('Veloce Labs: Full-stack architecture & 420ms p95 latency reduction');
    }

    const apexExp = approvedKnowledge.find((k) => {
      if (k.category !== 'experience') return false;
      const c = k.content as { employer?: string };
      return c.employer?.toLowerCase().includes('apex');
    });
    if (apexExp) {
      sourceKnowledgeItemIds.push(apexExp.id);
      evidenceReferences.push(
        'Apex Cloud Systems: Distributed database migration & query optimization'
      );
    }

    const otherExps = approvedKnowledge.filter(
      (k) => k.category === 'experience' && k.id !== veloceExp?.id && k.id !== apexExp?.id
    );
    for (const exp of otherExps.slice(0, 2)) {
      sourceKnowledgeItemIds.push(exp.id);
      const c = exp.content as { employer?: string; role?: string };
      evidenceReferences.push(
        `${c.employer || 'Professional Experience'}: ${c.role || 'Software Engineering'}`
      );
    }

    const reactSkill = approvedKnowledge.find((k) => {
      if (k.category !== 'skill') return false;
      const c = k.content as { name?: string };
      return c.name?.toLowerCase().includes('react');
    });
    if (reactSkill) {
      sourceKnowledgeItemIds.push(reactSkill.id);
      evidenceReferences.push('Verified Technical Skill: React / Next.js ecosystem');
    }

    const postgresSkill = approvedKnowledge.find((k) => {
      if (k.category !== 'skill') return false;
      const c = k.content as { name?: string };
      return c.name?.toLowerCase().includes('postgres');
    });
    if (postgresSkill) {
      sourceKnowledgeItemIds.push(postgresSkill.id);
      evidenceReferences.push('Verified Technical Skill: PostgreSQL & relational data modeling');
    }

    // Role-tailored narrative without inventing missing requirements
    // Filter skills so only verified candidate skills from approved knowledge bank are cited
    const approvedSkillNames = approvedKnowledge
      .filter((k) => k.category === 'skill')
      .map((k) => ((k.content as { name?: string }).name || '').toLowerCase());

    const verifiedSkills = job.requiredSkills.filter((req) =>
      approvedSkillNames.some(
        (appr) => appr.includes(req.toLowerCase()) || req.toLowerCase().includes(appr)
      )
    );

    const skillsToMention =
      verifiedSkills.length > 0
        ? verifiedSkills.slice(0, 3).join(', ')
        : approvedSkillNames.length > 0
          ? approvedSkillNames.slice(0, 3).join(', ')
          : 'software engineering and disciplined problem solving';

    const hasExperience = approvedKnowledge.some((k) => k.category === 'experience');
    const introExperience = hasExperience
      ? 'With a strong track record of engineering impact and hands-on system building,'
      : 'With a commitment to high standards and structured engineering practices,';

    let experienceParagraph = '';
    if (veloceExp || apexExp) {
      experienceParagraph = `In my current role at Veloce Labs, I led the core platform engineering team serving over 120,000 monthly active users. Key outcomes included modernizing our client-server streaming architecture, optimizing p95 page load latencies from 2.4s down to 420ms through SSR streaming and query normalization, and deploying tiered caching that cut Redis throughput bottlenecks by 45%. Previously at Apex Cloud Systems, I helped execute zero-downtime relational database migrations for enterprise customer workloads, establishing high-reliability testing standards.`;
    } else if (otherExps.length > 0) {
      const topExp = otherExps[0].content as {
        employer?: string;
        role?: string;
        achievements?: string[];
      };
      const roleStr = topExp.role ? ` as ${topExp.role}` : '';
      const atStr = topExp.employer ? ` at ${topExp.employer}` : '';
      const achStr =
        topExp.achievements && topExp.achievements.length > 0
          ? ` Key focus areas included ${topExp.achievements[0]}.`
          : '';
      experienceParagraph = `Throughout my professional career${roleStr}${atStr}, I focused on delivering maintainable, high-impact software solutions.${achStr}`;
    } else {
      experienceParagraph = `I am eager to contribute my background and disciplined engineering approach to the initiatives and team objectives at ${company}.`;
    }

    const bodyParagraphs = [
      `Dear ${company} Hiring Team,\n\nI am writing to submit my application for the ${role} position at ${company}. ${introExperience} I have followed ${company}'s technical trajectory and developer-first products with admiration.`,

      experienceParagraph,

      `My core strengths in ${skillsToMention} align closely with the engineering initiatives outlined for ${company}. I am passionate about engineering craftsmanship, deep observability, and fostering collaborative teams that deliver resilient software.`,

      `Thank you for your time and consideration. I welcome the opportunity to discuss how my verified background and technical capabilities can support ${company}'s engineering goals.\n\nSincerely,\n${candidateName}`
    ];

    return {
      id: `cov-${job.id}-${Date.now()}`,
      jobId: job.id,
      candidateId: candidate.id,
      tailoredResumeVersionId: tailoredResume.id,
      recipient: `${company} Engineering Team`,
      company,
      role,
      body: bodyParagraphs.join('\n\n'),
      sourceKnowledgeItemIds,
      evidenceReferences,
      grounded: true,
      status: 'draft'
    };
  }
}

export const mockCoverLetterProvider = new MockCoverLetterProvider();
