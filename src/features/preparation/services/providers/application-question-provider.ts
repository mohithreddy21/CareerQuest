import { Job, JobAnalysis, CandidateProfile } from '@/types/domain';
import { KnowledgeItem } from '@/types/knowledge';
import { TailoredResumeVersion } from '@/types/tailoring';
import { GroundedApplicationQuestion } from '@/types/preparation';

export interface ApplicationQuestionProvider {
  generateQuestions(params: {
    job: Job;
    analysis?: JobAnalysis | null;
    approvedKnowledge: KnowledgeItem[];
    tailoredResume: TailoredResumeVersion;
    candidate: CandidateProfile;
  }): Promise<GroundedApplicationQuestion[]>;
}

export class MockApplicationQuestionProvider implements ApplicationQuestionProvider {
  async generateQuestions({
    job,
    analysis: _analysis,
    approvedKnowledge,
    tailoredResume: _tailoredResume,
    candidate: _candidate
  }: {
    job: Job;
    analysis?: JobAnalysis | null;
    approvedKnowledge: KnowledgeItem[];
    tailoredResume: TailoredResumeVersion;
    candidate: CandidateProfile;
  }): Promise<GroundedApplicationQuestion[]> {
    const veloceExp = approvedKnowledge.find((k) => {
      if (k.category !== 'experience') return false;
      const c = k.content as { employer?: string };
      return c.employer?.toLowerCase().includes('veloce');
    });
    const apexExp = approvedKnowledge.find((k) => {
      if (k.category !== 'experience') return false;
      const c = k.content as { employer?: string };
      return c.employer?.toLowerCase().includes('apex');
    });
    const openmetricProj = approvedKnowledge.find((k) => {
      if (k.category !== 'project') return false;
      const c = k.content as { name?: string };
      return c.name?.toLowerCase().includes('openmetric');
    });

    const questions: GroundedApplicationQuestion[] = [
      {
        id: `q-1-${job.id}`,
        question: `Why are you interested in joining ${job.company} as a ${job.title}?`,
        category: 'interest',
        suggestedAnswer: `I have long followed ${job.company}'s engineering culture and focus on high-reliability systems. Throughout my career at Veloce Labs and Apex Cloud Systems, I have focused on building scalable, latency-sensitive web architectures and developer experiences. The technical roadmap for ${job.company} directly aligns with my passion for distributed cloud services and engineering craftsmanship.`,
        sourceKnowledgeItemIds: [veloceExp?.id, apexExp?.id].filter(Boolean) as string[],
        evidenceReferences: [
          'Veloce Labs: 120k MAU platform architecture',
          'Apex Cloud Systems: Enterprise cloud infrastructure'
        ],
        grounded: true,
        reviewed: false
      },
      {
        id: `q-2-${job.id}`,
        question: `Describe a recent technical challenge you solved and how you measured success.`,
        category: 'experience',
        suggestedAnswer: `At Veloce Labs, our core dashboard experienced p95 latency spikes up to 2.4s under peak concurrency. I spearheaded an architectural overhaul incorporating SSR streaming, query cache normalization, and tiered Redis caching. This dropped p95 latency by over 80% down to 420ms and cut Redis CPU utilization by 45%, directly improving retention across 120,000 active users.`,
        sourceKnowledgeItemIds: [veloceExp?.id].filter(Boolean) as string[],
        evidenceReferences: [
          'Veloce Labs: p95 latency reduction from 2.4s to 420ms via SSR streaming & Redis cache tiering'
        ],
        grounded: true,
        reviewed: false
      },
      {
        id: `q-3-${job.id}`,
        question: `Tell us about an open-source tool, system, or project you built from scratch.`,
        category: 'technical',
        suggestedAnswer: `I designed and open-sourced OpenMetric Dashboard, a real-time observability visualizer built with TypeScript, Next.js, and WebSocket streaming. It earned over 1,800 GitHub stars and is adopted by more than 300 engineering teams globally for lightweight metrics visualization.`,
        sourceKnowledgeItemIds: [openmetricProj?.id].filter(Boolean) as string[],
        evidenceReferences: [
          'OpenMetric Dashboard: 1.8k GitHub stars & 300+ engineering teams in production'
        ],
        grounded: true,
        reviewed: false
      },
      {
        id: `q-4-${job.id}`,
        question: `How do you collaborate across disciplines (product, design, infra) to maintain delivery velocity?`,
        category: 'fit',
        suggestedAnswer: `I treat engineering velocity and product alignment as shared responsibilities. At Veloce Labs, I led full-stack squads in close sync with product managers and UX designers, establishing clear API contracts early and implementing optimistic UI patterns so features felt instantaneous to users while backend pipelines scaled safely.`,
        sourceKnowledgeItemIds: [veloceExp?.id].filter(Boolean) as string[],
        evidenceReferences: [
          'Veloce Labs: Full-stack squad leadership & mentoring 4 junior/mid engineers'
        ],
        grounded: true,
        reviewed: false
      }
    ];

    return questions;
  }
}

export const mockApplicationQuestionProvider = new MockApplicationQuestionProvider();
