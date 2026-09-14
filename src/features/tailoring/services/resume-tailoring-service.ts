import { Job, JobAnalysis, ResumeVersion } from '@/types/domain';
import { RetrievedCandidateKnowledge, ResumeChange } from '@/types/tailoring';
import { ResumeTailorProvider } from './providers/resume-tailor-provider';
import { MockResumeTailorProvider } from './providers/mock-resume-tailor-provider';

export class ResumeTailoringService {
  constructor(private provider: ResumeTailorProvider = new MockResumeTailorProvider()) {}

  async generateGroundedChanges(
    job: Job,
    analysis: JobAnalysis,
    masterResume: ResumeVersion,
    retrievedKnowledge: RetrievedCandidateKnowledge
  ): Promise<ResumeChange[]> {
    // 1. Generate proposals via provider
    const proposals = await this.provider.generateProposedChanges(
      job,
      analysis,
      masterResume,
      retrievedKnowledge
    );

    // 2. DOMAIN-LEVEL POSITIVE EVIDENCE GROUNDING VALIDATION
    // The provider is NEVER trusted to declare grounded: true on its own.
    // We strictly verify each proposed change against approved knowledge.
    const approvedKnowledgeIdSet = new Set(retrievedKnowledge.items.map((i) => i.knowledgeItemId));

    const missingSkillKeywords = retrievedKnowledge.missingRequirements
      .map((m) =>
        m.requirementText
          .replace(/^(Required|Preferred) Skill:\s*/i, '')
          .toLowerCase()
          .trim()
      )
      .filter(Boolean);

    const validatedChanges: ResumeChange[] = [];

    for (const change of proposals) {
      // Rule 1: sourceKnowledgeItemIds must not be empty
      if (!change.sourceKnowledgeItemIds || change.sourceKnowledgeItemIds.length === 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[ResumeTailoringService] Dropped ungrounded change (${change.id}): missing sourceKnowledgeItemIds.`
        );
        continue;
      }

      // Rule 2: All referenced knowledge items must exist in retrieved approved knowledge
      const allIdsApproved = change.sourceKnowledgeItemIds.every((id) =>
        approvedKnowledgeIdSet.has(id)
      );
      if (!allIdsApproved) {
        // eslint-disable-next-line no-console
        console.warn(
          `[ResumeTailoringService] Dropped change (${change.id}): references unapproved or non-retrieved knowledge ID.`
        );
        continue;
      }

      // Rule 3: Must NOT introduce missing/unsupported skills into proposed content
      const proposedLower = change.proposedContent.toLowerCase();
      const introducesMissingSkill = missingSkillKeywords.some((skill) => {
        // Match whole word for missing skill
        const regex = new RegExp(`\\b${skill}\\b`, 'i');
        return regex.test(proposedLower);
      });

      if (introducesMissingSkill) {
        // eslint-disable-next-line no-console
        console.warn(
          `[ResumeTailoringService] Dropped change (${change.id}): attempts to claim unsupported missing skill.`
        );
        continue;
      }

      // Rule 4: Compute grounded status deterministically
      validatedChanges.push({
        ...change,
        grounded: true,
        candidateId: masterResume.candidateId,
        jobId: job.id
      });
    }

    return validatedChanges;
  }
}

export const resumeTailoringService = new ResumeTailoringService();
