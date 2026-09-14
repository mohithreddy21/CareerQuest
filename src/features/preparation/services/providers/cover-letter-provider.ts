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
    const candidateName = candidate.name || 'Alex Chen';
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
        : 'full-stack architecture, TypeScript, and distributed systems';

    const bodyParagraphs = [
      `Dear ${company} Hiring Team,\n\nI am writing to submit my application for the ${role} position at ${company}. With over seven years of hands-on experience architecting high-scale web platforms and distributed backend pipelines, I have followed ${company}'s technical trajectory and developer-first products with admiration.`,

      `In my current role at Veloce Labs, I led the core platform engineering team serving over 120,000 monthly active users. Key outcomes included modernizing our client-server streaming architecture, optimizing p95 page load latencies from 2.4s down to 420ms through SSR streaming and query normalization, and deploying tiered caching that cut Redis throughput bottlenecks by 45%. Previously at Apex Cloud Systems, I helped execute zero-downtime relational database migrations for enterprise customer workloads, establishing high-reliability testing standards.`,

      `My core strengths in ${skillsToMention} and distributed systems design align closely with the engineering initiatives outlined for ${company}. I am passionate about engineering craftsmanship, deep observability, and fostering collaborative teams that deliver resilient software.`,

      `Thank you for your time and consideration. I welcome the opportunity to discuss how my verified background and technical leadership can support ${company}'s engineering goals.\n\nSincerely,\n${candidateName}`
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
