import { Job, JobAnalysis, CandidateProfile } from '@/types/domain';
import { KnowledgeItem } from '@/types/knowledge';
import { TailoredResumeVersion } from '@/types/tailoring';
import { GroundedCoverLetter } from '@/types/preparation';
import { CoverLetterProvider } from './cover-letter-provider';
import { aiOrchestrator } from '@/lib/ai/ai-orchestrator';
import { CoverLetterInput, CoverLetterOutput } from '@/lib/ai/task-types';
import { positiveGroundingValidator } from '@/features/tailoring/services/grounding-validator';
import { knowledgeRetrievalService } from '@/features/tailoring/services/knowledge-retrieval-service';

export class LLMCoverLetterProvider implements CoverLetterProvider {
  async generateCoverLetter(params: {
    job: Job;
    analysis?: JobAnalysis | null;
    approvedKnowledge: KnowledgeItem[];
    tailoredResume: TailoredResumeVersion;
    candidate: CandidateProfile;
    toneOrInstructions?: string;
  }): Promise<GroundedCoverLetter> {
    const {
      job,
      analysis: _analysis,
      approvedKnowledge,
      tailoredResume,
      candidate,
      toneOrInstructions
    } = params;

    // 1. Task-aware knowledge retrieval: 3–6 strong candidate evidence anchors
    const anchorItems = await knowledgeRetrievalService.retrieveKnowledgeForCoverLetter(
      job,
      candidate.id,
      approvedKnowledge
    );

    // Fallback: If retrieval returned empty, use any approved candidate knowledge items (up to 3)
    const effectiveAnchors = anchorItems.length > 0 ? anchorItems : approvedKnowledge.slice(0, 3);

    // Format approved knowledge for AI task contract
    const formattedKnowledge = effectiveAnchors.map((item) => {
      let snippet = '';
      const c = item.content as Record<string, unknown> | null;
      if (c) {
        if (typeof c.statement === 'string') {
          snippet = c.statement;
        } else if (typeof c.name === 'string') {
          snippet = `Verified skill / project: ${c.name}`;
        } else if (typeof c.employer === 'string') {
          snippet = `${c.role || 'Role'} at ${c.employer}: ${Array.isArray(c.responsibilities) ? c.responsibilities.join('; ') : ''}`;
        } else {
          snippet = JSON.stringify(c);
        }
      }
      return {
        knowledgeItemId: item.id,
        category: item.category,
        title: ((c?.title || c?.name || c?.employer) as string) || 'Candidate Evidence',
        supportingSnippet: snippet
      };
    });

    // 2. Prepare structured CoverLetterInput
    const input: CoverLetterInput = {
      candidate: {
        name: candidate.name || 'Candidate',
        headline: candidate.professionalSummary?.slice(0, 100),
        professionalSummary: candidate.professionalSummary
      },
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        descriptionSummary: job.description ? job.description.slice(0, 600) : undefined
      },
      approvedKnowledge: formattedKnowledge,
      toneOrInstructions
    };

    // 3. Dispatch to AIOrchestrator
    const result = await aiOrchestrator.dispatch<CoverLetterOutput>('COVER_LETTER', input, {
      candidateId: candidate.id
    });

    const output = result.data;

    // 4. Independent Domain Grounding Validation
    // Validates factual statements against candidate's approved Knowledge Bank
    // Allows normal persuasive / candidate-authentic phrasing
    const validation = positiveGroundingValidator.validateClaim({
      proposedText: output.body,
      sourceKnowledgeItemIds: output.sourceKnowledgeItemIds,
      candidateId: candidate.id,
      candidateApprovedKnowledge: approvedKnowledge,
      contextLabel: `Cover Letter for ${job.title} at ${job.company}`,
      allowPersuasiveLanguage: true
    });

    const isGrounded = validation.isValid && validation.status === 'GROUNDED';

    return {
      id: `cov-${job.id}-${Date.now()}`,
      jobId: job.id,
      candidateId: candidate.id,
      tailoredResumeVersionId: tailoredResume.id,
      recipient: output.recipient || `${job.company} Hiring Team`,
      company: job.company,
      role: job.title,
      body: output.body,
      sourceKnowledgeItemIds: output.sourceKnowledgeItemIds,
      evidenceReferences: output.evidenceReferences,
      grounded: isGrounded,
      status: 'draft'
    };
  }
}
