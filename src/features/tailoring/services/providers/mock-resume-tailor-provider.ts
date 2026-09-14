import { Job, JobAnalysis, ResumeVersion } from '@/types/domain';
import { RetrievedCandidateKnowledge, ResumeChange } from '@/types/tailoring';
import { ResumeTailorProvider } from './resume-tailor-provider';

export class MockResumeTailorProvider implements ResumeTailorProvider {
  async generateProposedChanges(
    job: Job,
    _analysis: JobAnalysis,
    masterResume: ResumeVersion,
    retrievedKnowledge: RetrievedCandidateKnowledge
  ): Promise<ResumeChange[]> {
    const changes: ResumeChange[] = [];
    const company = job.company.toLowerCase();
    const candidateId = masterResume.candidateId;
    const resumeVersionId = `res-tailored-${job.id}`;

    // Lookup retrieved knowledge items to attach valid IDs
    const findRetrievedId = (category: string, titleSubstr: string) => {
      const match = retrievedKnowledge.items.find(
        (i) => i.category === category && i.title.toLowerCase().includes(titleSubstr.toLowerCase())
      );
      return match
        ? match.knowledgeItemId
        : retrievedKnowledge.items[0]?.knowledgeItemId || 'kb-exp-1';
    };

    const veloceId = findRetrievedId('experience', 'veloce');
    const apexId = findRetrievedId('experience', 'apex');
    const projId = findRetrievedId('project', 'openmetric');
    const perfAchId =
      findRetrievedId('achievement', 'performance') || findRetrievedId('achievement', 'latency');
    const tsSkillId = findRetrievedId('skill', 'typescript');
    const reactSkillId = findRetrievedId('skill', 'react');

    // 1. SECTION: SUMMARY TAILORING
    if (company.includes('stripe') || job.title.toLowerCase().includes('billing')) {
      changes.push({
        id: `change-${job.id}-summary`,
        candidateId,
        jobId: job.id,
        resumeVersionId,
        section: 'summary',
        originalContent: masterResume.summary,
        proposedContent:
          'Senior Full-Stack Engineer with 6+ years of experience architecting distributed payment systems, scalable PostgreSQL data layers, and high-performance React/Next.js user interfaces. Proven history reducing p95 latency by 82% and scaling merchant billing microservices processing mission-critical financial workloads.',
        rationale:
          'Reframes professional summary to directly address Stripe Billing priorities: distributed transaction processing, relational query performance, and polished developer interfaces.',
        jobRequirement:
          'Experience building scalable APIs, merchant billing pipelines, and customer-facing interfaces.',
        sourceCandidateEvidence:
          'Apex Cloud Systems billing pipeline experience and Veloce Labs Next.js performance achievements.',
        sourceKnowledgeItemIds: [apexId, veloceId, tsSkillId].filter(Boolean),
        evidenceReferences: [
          'Engineered real-time billing pipeline handling multi-tenant database partitions.',
          'Reduced p95 initial page load times from 2.4s to 420ms.'
        ],
        status: 'pending',
        grounded: true
      });

      // 2. SECTION: EXPERIENCE (Apex Cloud Systems)
      const apexExp = masterResume.experience.find((e) =>
        e.employer.toLowerCase().includes('apex')
      );
      if (apexExp && apexExp.responsibilities[0]) {
        changes.push({
          id: `change-${job.id}-exp-apex`,
          candidateId,
          jobId: job.id,
          resumeVersionId,
          section: 'experience',
          sectionItemId: apexExp.id,
          originalContent: apexExp.responsibilities[0],
          proposedContent:
            'Architected merchant billing pipelines and automated subscription invoicing workflows in Node.js and PostgreSQL, maintaining 99.99% ledger transaction accuracy.',
          rationale:
            'Elevates billing and database reliability responsibilities to directly map to Stripe product engineering expectations.',
          jobRequirement:
            'Scale merchant billing pipelines processing hundreds of millions of dollars daily.',
          sourceCandidateEvidence:
            'Verified Apex Cloud Systems commercial billing and database architecture history.',
          sourceKnowledgeItemIds: [apexId],
          evidenceReferences: [
            'Architected core subscription billing workflows in Node.js & PostgreSQL.'
          ],
          status: 'pending',
          grounded: true
        });
      }

      // 3. SECTION: EXPERIENCE (Veloce Labs)
      const veloceExp = masterResume.experience.find((e) =>
        e.employer.toLowerCase().includes('veloce')
      );
      if (veloceExp && veloceExp.responsibilities[0]) {
        changes.push({
          id: `change-${job.id}-exp-veloce`,
          candidateId,
          jobId: job.id,
          resumeVersionId,
          section: 'experience',
          sectionItemId: veloceExp.id,
          originalContent: veloceExp.responsibilities[0],
          proposedContent:
            'Led frontend architecture of developer-facing dashboard using Next.js App Router and React 19, optimizing initial page load from 2.4s to 420ms (-82%).',
          rationale:
            'Highlights frontend performance leadership and React 19 adoption relevant to Stripe developer dashboards.',
          jobRequirement:
            'Partner with product managers and designers to craft elegant developer experiences.',
          sourceCandidateEvidence:
            'Veloce Labs performance optimization verified in baseline knowledge.',
          sourceKnowledgeItemIds: [veloceId, perfAchId].filter(Boolean),
          evidenceReferences: [
            'Led migration of legacy client application to Next.js App Router and React 19.'
          ],
          status: 'pending',
          grounded: true
        });
      }

      // 4. SECTION: SKILLS REORDERING
      changes.push({
        id: `change-${job.id}-skills`,
        candidateId,
        jobId: job.id,
        resumeVersionId,
        section: 'skills',
        originalContent: masterResume.skills.technical.slice(0, 5).join(', '),
        proposedContent:
          'TypeScript, React, Node.js, PostgreSQL, Distributed Systems, Redis, GraphQL, REST APIs',
        rationale:
          'Reorders verified technical skills to place exact required stack items at the front of the candidate resume.',
        jobRequirement:
          'Required Skills: React, TypeScript, Node.js, Distributed Systems, PostgreSQL',
        sourceCandidateEvidence: 'All listed skills verified in Candidate Knowledge Bank.',
        sourceKnowledgeItemIds: [tsSkillId, reactSkillId].filter(Boolean),
        evidenceReferences: ['Verified technical skills in Knowledge Bank.'],
        status: 'pending',
        grounded: true
      });
    } else if (company.includes('datadog')) {
      // Datadog: High-throughput telemetry, latency, microservices (NO eBPF)
      changes.push({
        id: `change-${job.id}-summary`,
        candidateId,
        jobId: job.id,
        resumeVersionId,
        section: 'summary',
        originalContent: masterResume.summary,
        proposedContent:
          'Backend & Systems Engineer with deep expertise in distributed data ingestion, high-throughput microservices in Go and Node.js, and low-latency PostgreSQL architectures. Experienced in building telemetry dashboards and optimizing streaming pipelines handling real-time data with sub-second latencies.',
        rationale:
          'Reposition summary for Datadog telemetry and streaming pipelines. Note: Missing skill eBPF is omitted to maintain 100% truthfulness.',
        jobRequirement:
          'Build high-performance streaming pipelines handling massive telemetry payloads.',
        sourceCandidateEvidence:
          'OpenMetric Dashboard telemetry engine & Veloce Labs WebSocket pipeline.',
        sourceKnowledgeItemIds: [projId, veloceId].filter(Boolean),
        evidenceReferences: [
          'Architected core telemetry ingestion engine in OpenMetric Dashboard.'
        ],
        status: 'pending',
        grounded: true
      });

      // Projects bullet
      const proj = masterResume.projects.find((p) => p.name.toLowerCase().includes('openmetric'));
      if (proj) {
        changes.push({
          id: `change-${job.id}-proj-openmetric`,
          candidateId,
          jobId: job.id,
          resumeVersionId,
          section: 'projects',
          sectionItemId: proj.id,
          originalContent: proj.contributions,
          proposedContent:
            'Architected distributed telemetry ingestion engine and real-time visualization widgets, achieving sub-second metrics ingestion across 300+ active teams.',
          rationale:
            'Highlights telemetry streaming architecture directly relevant to Datadog APM team.',
          jobRequirement: 'Optimize data storage engines and query paths for real-time analytics.',
          sourceCandidateEvidence: 'OpenMetric Dashboard contributions verified in Knowledge Bank.',
          sourceKnowledgeItemIds: [projId],
          evidenceReferences: [
            'Architected core telemetry ingestion engine and real-time visualization widgets.'
          ],
          status: 'pending',
          grounded: true
        });
      }
    } else if (company.includes('linear')) {
      // Linear: Offline-first, real-time sync, latency, keyboard-driven UI (NO Electron)
      changes.push({
        id: `change-${job.id}-summary`,
        candidateId,
        jobId: job.id,
        resumeVersionId,
        section: 'summary',
        originalContent: masterResume.summary,
        proposedContent:
          'Staff Software Engineer specializing in high-performance web applications, real-time WebSocket state synchronization, and sub-50ms user interactions. Track record leading frontend architecture and cutting latency by 82% in high-concurrency client products.',
        rationale:
          'Emphasizes sub-50ms client latency and real-time sync engine for Linear. Note: Missing skill Electron is omitted.',
        jobRequirement:
          'Lead architectural initiatives across our sync engine and client applications.',
        sourceCandidateEvidence:
          'Veloce Labs WebSocket real-time collaboration engine & latency achievements.',
        sourceKnowledgeItemIds: [veloceId, perfAchId].filter(Boolean),
        evidenceReferences: ['Architected real-time collaboration engine using WebSocket pub/sub.'],
        status: 'pending',
        grounded: true
      });
    } else {
      // Generic job role refinement
      changes.push({
        id: `change-${job.id}-summary`,
        candidateId,
        jobId: job.id,
        resumeVersionId,
        section: 'summary',
        originalContent: masterResume.summary,
        proposedContent: `Senior Full-Stack Engineer with verified expertise across ${job.requiredSkills.slice(0, 3).join(', ')}. Track record leading end-to-end architecture, optimizing latency, and shipping robust user-facing applications at scale.`,
        rationale: `Aligns summary with required stack for ${job.title} at ${job.company}.`,
        jobRequirement: `Demonstrated experience with ${job.requiredSkills.join(', ')}`,
        sourceCandidateEvidence: 'Verified technical skills in Knowledge Bank.',
        sourceKnowledgeItemIds: [tsSkillId, veloceId].filter(Boolean),
        evidenceReferences: ['Verified baseline skills.'],
        status: 'pending',
        grounded: true
      });
    }

    return changes;
  }
}
