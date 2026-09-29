import { Job, JobAnalysis, ResumeVersion } from '@/types/domain';
import { RetrievedCandidateKnowledge, ResumeChange } from '@/types/tailoring';
import { ResumeTailorProvider } from './providers/resume-tailor-provider';
import { getResumeTailorProvider } from './providers/resume-tailor-provider.factory';
import { positiveGroundingValidator } from './grounding-validator';
import { careerRepository } from '@/services/career-repository';
import { KnowledgeItem } from '@/types/knowledge';

export class ResumeTailoringService {
  constructor(private provider?: ResumeTailorProvider) {}

  async generateGroundedChanges(
    job: Job,
    analysis: JobAnalysis,
    masterResume: ResumeVersion,
    retrievedKnowledge: RetrievedCandidateKnowledge
  ): Promise<ResumeChange[]> {
    const activeProvider = this.provider ?? getResumeTailorProvider();

    // 1. Generate proposals via configured provider
    const proposals = await activeProvider.generateProposedChanges(
      job,
      analysis,
      masterResume,
      retrievedKnowledge
    );

    // 2. Load candidate's full knowledge bank for independent domain-level validation
    const candidateId = masterResume.candidateId;
    let candidateAllItems: KnowledgeItem[] = [];

    try {
      const bank = await careerRepository.getKnowledgeBank(candidateId);
      candidateAllItems = [
        ...(bank.skills || []),
        ...(bank.experiences || []),
        ...(bank.projects || []),
        ...(bank.education || []),
        ...(bank.certifications || []),
        ...(bank.achievements || [])
      ];
    } catch {
      // Fallback to retrieved knowledge items if repository is in-memory or not populated
      candidateAllItems = retrievedKnowledge.items.map((i) => ({
        id: i.knowledgeItemId,
        candidateId: i.candidateId,
        category: i.category,
        title: i.title,
        status: 'approved' as const,
        provenance: [
          {
            id: `prov-${i.knowledgeItemId}`,
            sourceType: 'resume_upload' as const,
            sourceLabel: i.provenanceLabel,
            addedAt: retrievedKnowledge.retrievedAt
          }
        ],
        content: {
          statement: i.supportingSnippet
        },
        createdAt: retrievedKnowledge.retrievedAt,
        updatedAt: retrievedKnowledge.retrievedAt
      }));
    }

    const validatedChanges: ResumeChange[] = [];

    for (const change of proposals) {
      // Rule 1: Check for source citations
      if (!change.sourceKnowledgeItemIds || change.sourceKnowledgeItemIds.length === 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[ResumeTailoringService] Change (${change.id}) has no sourceKnowledgeItemIds -> REQUIRES_REVIEW.`
        );
        validatedChanges.push({
          ...change,
          grounded: false,
          candidateId,
          jobId: job.id
        });
        continue;
      }

      // Rule 2: Execute independent PositiveGroundingValidator
      // The LLM is NEVER trusted to declare itself grounded.
      const validation = positiveGroundingValidator.validateClaim({
        proposedText: change.proposedContent,
        originalText: change.originalContent,
        sourceKnowledgeItemIds: change.sourceKnowledgeItemIds,
        candidateId,
        candidateApprovedKnowledge: candidateAllItems,
        contextLabel: `${change.section} tailoring for ${job.title} at ${job.company}`
      });

      // Security / Integrity failure: Drop completely rejected proposals
      // (e.g. cross-candidate attack, unapproved/archived items, or fabricated employer)
      if (validation.status === 'REJECTED') {
        // eslint-disable-next-line no-console
        console.warn(
          `[ResumeTailoringService] Dropped rejected proposal (${change.id}): ${validation.reasons.join('; ')}`
        );
        continue;
      }

      // Rule 3: Mark grounded based on domain validation
      const isGrounded = validation.status === 'GROUNDED';

      validatedChanges.push({
        ...change,
        grounded: isGrounded,
        candidateId,
        jobId: job.id
      });
    }

    return validatedChanges;
  }
}

export const resumeTailoringService = new ResumeTailoringService();
