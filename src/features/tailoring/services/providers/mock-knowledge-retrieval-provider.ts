import { Job, JobAnalysis } from '@/types/domain';
import {
  KnowledgeItem,
  SkillKnowledgeContent,
  ExperienceKnowledgeContent,
  ProjectKnowledgeContent,
  EducationKnowledgeContent,
  CertificationKnowledgeContent,
  AchievementKnowledgeContent
} from '@/types/knowledge';
import {
  RetrievedCandidateKnowledge,
  RetrievedKnowledgeItem,
  MissingRequirementInfo
} from '@/types/tailoring';
import { KnowledgeRetrievalProvider } from './knowledge-retrieval-provider';
import { DuplicateDetectionService } from '@/features/knowledge/services/duplicate-detection-service';

export class MockKnowledgeRetrievalProvider implements KnowledgeRetrievalProvider {
  async retrieveRelevantKnowledge(
    job: Job,
    analysis: JobAnalysis,
    approvedKnowledgeItems: KnowledgeItem[]
  ): Promise<RetrievedCandidateKnowledge> {
    const candidateId = approvedKnowledgeItems[0]?.candidateId || 'cand-1';
    const retrievedItems: RetrievedKnowledgeItem[] = [];
    const matchedSkillNames = new Set<string>();

    const duplicateService = new DuplicateDetectionService();
    const normalize = (text: string) => duplicateService.normalizeSkill(text).toLowerCase();

    // 1. Technical Skills Matching (Exact, Canonical, and Alias)
    const requiredSkillsNorm = job.requiredSkills.map((s) => ({
      original: s,
      norm: normalize(s)
    }));
    const preferredSkillsNorm = (job.preferredSkills || []).map((s) => ({
      original: s,
      norm: normalize(s)
    }));

    const skillItems = approvedKnowledgeItems.filter((i) => i.category === 'skill');

    for (const item of skillItems) {
      const content = item.content as SkillKnowledgeContent;
      const itemSkillNorm = normalize(content.name);

      // Check required match
      const reqMatch = requiredSkillsNorm.find(
        (r) =>
          r.norm === itemSkillNorm ||
          itemSkillNorm.includes(r.norm) ||
          r.norm.includes(itemSkillNorm)
      );

      if (reqMatch) {
        matchedSkillNames.add(reqMatch.original);
        const reqObj = analysis.extractedRequirements.find(
          (er) => normalize(er.text) === reqMatch.norm
        );

        retrievedItems.push({
          id: `ret-${job.id}-${item.id}`,
          knowledgeItemId: item.id,
          candidateId,
          jobId: job.id,
          category: 'skill',
          title: content.name,
          matchedRequirementId: reqObj?.id,
          matchedRequirementText: `Required Skill: ${reqMatch.original}`,
          relevanceCategory: 'direct_technical',
          relevanceReason: `Direct technical match for core required technology (${reqMatch.original}).`,
          supportingSnippet: `${content.name} (${content.proficiency || 'verified'} proficiency, ${content.yearsOfExperience || 3}+ years experience)`,
          provenanceLabel: item.provenance[0]?.sourceLabel || 'Verified Baseline',
          retrievalRank: 100
        });
        continue;
      }

      // Check preferred match
      const prefMatch = preferredSkillsNorm.find(
        (p) =>
          p.norm === itemSkillNorm ||
          itemSkillNorm.includes(p.norm) ||
          p.norm.includes(itemSkillNorm)
      );

      if (prefMatch) {
        matchedSkillNames.add(prefMatch.original);
        const prefObj = analysis.extractedRequirements.find(
          (er) => normalize(er.text) === prefMatch.norm
        );

        retrievedItems.push({
          id: `ret-${job.id}-${item.id}`,
          knowledgeItemId: item.id,
          candidateId,
          jobId: job.id,
          category: 'skill',
          title: content.name,
          matchedRequirementId: prefObj?.id,
          matchedRequirementText: `Preferred Skill: ${prefMatch.original}`,
          relevanceCategory: 'tool_infrastructure',
          relevanceReason: `Matches preferred technical stack qualification (${prefMatch.original}).`,
          supportingSnippet: `${content.name} (${content.proficiency || 'verified'})`,
          provenanceLabel: item.provenance[0]?.sourceLabel || 'Verified Baseline',
          retrievalRank: 80
        });
      }
    }

    // 2. Experience Matching (Overlap with responsibilities & role domain)
    const expItems = approvedKnowledgeItems.filter((i) => i.category === 'experience');
    for (const item of expItems) {
      const content = item.content as ExperienceKnowledgeContent;
      const employer = content.employer.toLowerCase();
      const allText =
        `${content.role} ${content.employer} ${(content.responsibilities || []).join(' ')}`.toLowerCase();

      // Check Stripe / FinTech / Payments
      if (
        job.company.toLowerCase().includes('stripe') ||
        job.title.toLowerCase().includes('billing')
      ) {
        if (
          employer.includes('apex') ||
          allText.includes('billing') ||
          allText.includes('postgres') ||
          allText.includes('api')
        ) {
          retrievedItems.push({
            id: `ret-${job.id}-${item.id}`,
            knowledgeItemId: item.id,
            candidateId,
            jobId: job.id,
            category: 'experience',
            title: `${content.role} at ${content.employer}`,
            matchedRequirementText: 'Scale merchant billing pipelines and maintain APIs',
            relevanceCategory: 'architectural_responsibility',
            relevanceReason:
              'Direct commercial track record architecting billing pipelines and high-throughput databases.',
            supportingSnippet:
              content.responsibilities?.[0] || 'Led full-stack architecture of core services.',
            provenanceLabel: item.provenance[0]?.sourceLabel || 'Verified Baseline',
            retrievalRank: 95
          });
        }
        if (
          employer.includes('veloce') ||
          allText.includes('react') ||
          allText.includes('latency')
        ) {
          retrievedItems.push({
            id: `ret-${job.id}-${item.id}`,
            knowledgeItemId: item.id,
            candidateId,
            jobId: job.id,
            category: 'experience',
            title: `${content.role} at ${content.employer}`,
            matchedRequirementText: 'Developer experience and customer-facing interfaces',
            relevanceCategory: 'architectural_responsibility',
            relevanceReason:
              'Deep frontend architecture leadership with modern React, App Router, and sub-second p95 latency.',
            supportingSnippet:
              content.responsibilities?.[0] || 'Led migration to Next.js App Router and React 19.',
            provenanceLabel: item.provenance[0]?.sourceLabel || 'Verified Baseline',
            retrievalRank: 92
          });
        }
      } else if (job.company.toLowerCase().includes('datadog')) {
        // Datadog backend telemetry / latency
        if (
          employer.includes('veloce') ||
          allText.includes('latency') ||
          allText.includes('real-time') ||
          allText.includes('websocket')
        ) {
          retrievedItems.push({
            id: `ret-${job.id}-${item.id}`,
            knowledgeItemId: item.id,
            candidateId,
            jobId: job.id,
            category: 'experience',
            title: `${content.role} at ${content.employer}`,
            matchedRequirementText: 'High-throughput distributed systems & low latency',
            relevanceCategory: 'architectural_responsibility',
            relevanceReason:
              'Demonstrated experience optimizing latency and maintaining sub-second ingestion engines.',
            supportingSnippet:
              'Architected real-time collaboration engine using WebSocket pub/sub.',
            provenanceLabel: item.provenance[0]?.sourceLabel || 'Verified Baseline',
            retrievalRank: 90
          });
        }
        if (
          employer.includes('apex') ||
          allText.includes('postgres') ||
          allText.includes('microservices')
        ) {
          retrievedItems.push({
            id: `ret-${job.id}-${item.id}`,
            knowledgeItemId: item.id,
            candidateId,
            jobId: job.id,
            category: 'experience',
            title: `${content.role} at ${content.employer}`,
            matchedRequirementText: 'Distributed data storage & query paths',
            relevanceCategory: 'architectural_responsibility',
            relevanceReason:
              'Proven experience designing microservices and transactional database persistence.',
            supportingSnippet: 'Optimized relational queries and multi-tenant database partitions.',
            provenanceLabel: item.provenance[0]?.sourceLabel || 'Verified Baseline',
            retrievalRank: 85
          });
        }
      } else {
        // Generic job experience match based on stack / role category
        retrievedItems.push({
          id: `ret-${job.id}-${item.id}`,
          knowledgeItemId: item.id,
          candidateId,
          jobId: job.id,
          category: 'experience',
          title: `${content.role} at ${content.employer}`,
          matchedRequirementText: `${job.title} leadership and technical execution`,
          relevanceCategory: 'architectural_responsibility',
          relevanceReason: `Commercial engineering experience aligning with ${job.title} responsibilities.`,
          supportingSnippet:
            content.responsibilities?.[0] || 'Senior engineering ownership and delivery.',
          provenanceLabel: item.provenance[0]?.sourceLabel || 'Verified Baseline',
          retrievalRank: 88
        });
      }
    }

    // 3. Projects Matching
    const projectItems = approvedKnowledgeItems.filter((i) => i.category === 'project');
    for (const item of projectItems) {
      const content = item.content as ProjectKnowledgeContent;
      const techList = content.technologies || [];
      const hasRelevantTech = techList.some((t) =>
        requiredSkillsNorm.some((r) => r.norm === normalize(t))
      );

      if (
        hasRelevantTech ||
        content.description.toLowerCase().includes('observability') ||
        content.description.toLowerCase().includes('telemetry')
      ) {
        retrievedItems.push({
          id: `ret-${job.id}-${item.id}`,
          knowledgeItemId: item.id,
          candidateId,
          jobId: job.id,
          category: 'project',
          title: content.name,
          matchedRequirementText: `Demonstrated implementation with ${techList.slice(0, 3).join(', ')}`,
          relevanceCategory: 'domain_experience',
          relevanceReason: `Open-source production project utilizing ${techList.join(', ')}.`,
          supportingSnippet: content.description,
          provenanceLabel: item.provenance[0]?.sourceLabel || 'Verified Baseline',
          retrievalRank: 86
        });
      }
    }

    // 4. Education & Certification
    const certItems = approvedKnowledgeItems.filter((i) => i.category === 'certification');
    for (const item of certItems) {
      const content = item.content as CertificationKnowledgeContent;
      retrievedItems.push({
        id: `ret-${job.id}-${item.id}`,
        knowledgeItemId: item.id,
        candidateId,
        jobId: job.id,
        category: 'certification',
        title: content.name,
        matchedRequirementText: 'Cloud infrastructure & architectural standards',
        relevanceCategory: 'credential',
        relevanceReason: `Verified cloud architectural certification from ${content.issuer}.`,
        supportingSnippet: `${content.name} (Issued ${content.issueDate})`,
        provenanceLabel: item.provenance[0]?.sourceLabel || 'Verified Baseline',
        retrievalRank: 70
      });
    }

    const eduItems = approvedKnowledgeItems.filter((i) => i.category === 'education');
    for (const item of eduItems) {
      const content = item.content as EducationKnowledgeContent;
      retrievedItems.push({
        id: `ret-${job.id}-${item.id}`,
        knowledgeItemId: item.id,
        candidateId,
        jobId: job.id,
        category: 'education',
        title: `${content.degree} — ${content.institution}`,
        matchedRequirementText: job.educationRequirement || 'Computer Science degree',
        relevanceCategory: 'credential',
        relevanceReason: 'Direct academic foundation satisfying educational qualifications.',
        supportingSnippet: `${content.degree} in ${content.fieldOfStudy}, ${content.institution}`,
        provenanceLabel: item.provenance[0]?.sourceLabel || 'Verified Baseline',
        retrievalRank: 65
      });
    }

    // 5. Achievements
    const achItems = approvedKnowledgeItems.filter((i) => i.category === 'achievement');
    for (const item of achItems) {
      const content = item.content as AchievementKnowledgeContent;
      retrievedItems.push({
        id: `ret-${job.id}-${item.id}`,
        knowledgeItemId: item.id,
        candidateId,
        jobId: job.id,
        category: 'achievement',
        title: content.title,
        matchedRequirementText: 'High performance & system optimization',
        relevanceCategory: 'domain_experience',
        relevanceReason: 'Quantifiable operational impact reducing latency and compute overhead.',
        supportingSnippet: `${content.description} [${content.metric || ''}]`,
        provenanceLabel: item.provenance[0]?.sourceLabel || 'Verified Baseline',
        retrievalRank: 75
      });
    }

    // 6. Detect Missing Requirements (Strict Grounding: NO hallucinations for unverified skills)
    const missingRequirements: MissingRequirementInfo[] = [];

    const allCandidateSkillsNorm = new Set(
      skillItems.map((s) => normalize((s.content as SkillKnowledgeContent).name))
    );

    // Check all required skills
    for (const req of job.requiredSkills) {
      const normReq = normalize(req);
      const isFound =
        allCandidateSkillsNorm.has(normReq) ||
        Array.from(allCandidateSkillsNorm).some((s) => s.includes(normReq) || normReq.includes(s));
      if (!isFound) {
        missingRequirements.push({
          requirementId: `missing-${job.id}-${normReq}`,
          requirementText: `Required Skill: ${req}`,
          status: 'unsupported',
          note: `No approved evidence for "${req}" in your Knowledge Bank.`
        });
      }
    }

    // Check all preferred skills (e.g. eBPF in Datadog, Electron in Linear)
    for (const pref of job.preferredSkills || []) {
      const normPref = normalize(pref);
      const isFound =
        allCandidateSkillsNorm.has(normPref) ||
        Array.from(allCandidateSkillsNorm).some(
          (s) => s.includes(normPref) || normPref.includes(s)
        );
      if (!isFound) {
        missingRequirements.push({
          requirementId: `missing-${job.id}-${normPref}`,
          requirementText: `Preferred Skill: ${pref}`,
          status: 'unsupported',
          note: `No approved evidence for "${pref}" in your Knowledge Bank.`
        });
      }
    }

    // Deduplicate retrieved items by knowledgeItemId (keep highest rank)
    const uniqueMap = new Map<string, RetrievedKnowledgeItem>();
    for (const item of retrievedItems) {
      const existing = uniqueMap.get(item.knowledgeItemId);
      if (!existing || item.retrievalRank > existing.retrievalRank) {
        uniqueMap.set(item.knowledgeItemId, item);
      }
    }

    const sortedItems = Array.from(uniqueMap.values()).toSorted(
      (a, b) => b.retrievalRank - a.retrievalRank
    );

    return {
      jobId: job.id,
      candidateId,
      retrievedAt: new Date().toISOString(),
      items: sortedItems,
      missingRequirements
    };
  }
}
