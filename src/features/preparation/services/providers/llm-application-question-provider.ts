import { Job, JobAnalysis, CandidateProfile } from '@/types/domain';
import { KnowledgeItem } from '@/types/knowledge';
import { TailoredResumeVersion } from '@/types/tailoring';
import { GroundedApplicationQuestion } from '@/types/preparation';
import { ApplicationQuestionProvider } from './application-question-provider';
import { aiOrchestrator } from '@/lib/ai/ai-orchestrator';
import { ApplicationQuestionInput, ApplicationQuestionOutput } from '@/lib/ai/task-types';
import { classifyQuestionCategory } from '../../lib/question-classifier';
import { knowledgeRetrievalService } from '@/features/tailoring/services/knowledge-retrieval-service';
import { positiveGroundingValidator } from '@/features/tailoring/services/grounding-validator';

export class LLMApplicationQuestionProvider implements ApplicationQuestionProvider {
  async generateQuestions(params: {
    job: Job;
    analysis?: JobAnalysis | null;
    approvedKnowledge: KnowledgeItem[];
    tailoredResume: TailoredResumeVersion;
    candidate: CandidateProfile;
    questionsToAnswer?: string[];
  }): Promise<GroundedApplicationQuestion[]> {
    const { job, approvedKnowledge, candidate, questionsToAnswer } = params;

    const defaultQuestions = [
      `Why are you interested in joining ${job.company} as a ${job.title}?`,
      `Describe a recent technical challenge you solved and how you measured success.`,
      `Tell us about a technical system, project, or architecture you built from scratch.`,
      `How do you collaborate across disciplines (product, design, infra) to maintain delivery velocity?`
    ];

    const questionsList =
      questionsToAnswer && questionsToAnswer.length > 0 ? questionsToAnswer : defaultQuestions;

    const results: GroundedApplicationQuestion[] = [];

    for (let idx = 0; idx < questionsList.length; idx++) {
      const qText = questionsList[idx];
      const category = classifyQuestionCategory(qText);

      // 1. Task-aware knowledge retrieval for this question & category
      const retrieval = await knowledgeRetrievalService.retrieveKnowledgeForQuestion({
        question: qText,
        category,
        job,
        candidateId: candidate.id,
        approvedKnowledge,
        candidateProfile: candidate,
        candidatePreferences: candidate.preferences
      });

      // 2. Critical Missing Evidence Guard: If required evidence is absent, do NOT fabricate an answer
      if (!retrieval.hasSufficientEvidence && retrieval.items.length === 0) {
        results.push({
          id: `q-${idx + 1}-${job.id}`,
          question: qText,
          category,
          suggestedAnswer: `[Candidate Input Required]: ${retrieval.missingEvidenceNote || 'Please supply this information to complete your answer.'}`,
          sourceKnowledgeItemIds: [],
          evidenceReferences: [],
          grounded: false,
          reviewed: false,
          reviewStatus: 'MISSING_EVIDENCE',
          missingEvidenceNote: retrieval.missingEvidenceNote
        });
        continue;
      }

      // Format retrieved items for the AI task contract
      const formattedKnowledge = retrieval.items.map((item) => {
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

      // 3. Prepare structured ApplicationQuestionInput
      const input: ApplicationQuestionInput = {
        question: qText,
        category,
        job: {
          id: job.id,
          title: job.title,
          company: job.company
        },
        candidateProfileContext: candidate.preferences
          ? {
              targetRoles: candidate.preferences.targetRoles || [],
              preferredLocations: candidate.preferences.preferredLocations || [],
              workArrangements: candidate.preferences.workArrangements || [],
              targetSalaryMin: candidate.preferences.targetSalaryMin,
              currency: candidate.preferences.currency || 'USD'
            }
          : undefined,
        approvedKnowledge: formattedKnowledge
      };

      // 4. Dispatch to AIOrchestrator
      const aiResult = await aiOrchestrator.dispatch<ApplicationQuestionOutput>(
        'APPLICATION_QUESTION',
        input,
        {
          candidateId: candidate.id
        }
      );

      const output = aiResult.data;

      // 5. Independent Domain Grounding Validation
      const validation = positiveGroundingValidator.validateClaim({
        proposedText: output.proposedAnswer,
        sourceKnowledgeItemIds: output.sourceKnowledgeItemIds,
        candidateId: candidate.id,
        candidateApprovedKnowledge: approvedKnowledge,
        contextLabel: `Question: ${qText}`,
        allowPersuasiveLanguage: category === 'motivation' || category === 'other'
      });

      const isGrounded = validation.isValid && validation.status === 'GROUNDED';
      const reviewStatus = !output.hasSufficientEvidence
        ? 'MISSING_EVIDENCE'
        : isGrounded
          ? 'VERIFIED'
          : 'REQUIRES_REVIEW';

      results.push({
        id: `q-${idx + 1}-${job.id}`,
        question: qText,
        category,
        suggestedAnswer: output.proposedAnswer,
        sourceKnowledgeItemIds: output.sourceKnowledgeItemIds,
        evidenceReferences: output.evidenceReferences,
        grounded: isGrounded,
        reviewed: false,
        reviewStatus,
        missingEvidenceNote: output.missingEvidenceNote
      });
    }

    return results;
  }
}
