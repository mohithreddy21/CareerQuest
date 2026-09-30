import { Job, JobAnalysis, JobMatch, CandidateProfile } from '@/types/domain';

import { KnowledgeItem } from '@/types/knowledge';
import { TailoredResumeVersion } from '@/types/tailoring';
import {
  GroundedCoverLetter,
  GroundedApplicationQuestion,
  ApplicationSummary,
  ApplicationReadinessChecklistItem
} from '@/types/preparation';
import { ResumeTemplateId } from '@/types/templates';
import { getResumeTemplate } from '@/features/templates/constants/templates';
import { CoverLetterProvider } from './providers/cover-letter-provider';
import { ApplicationQuestionProvider } from './providers/application-question-provider';
import {
  getCoverLetterProvider,
  getApplicationQuestionProvider
} from './providers/preparation-provider.factory';
import { positiveGroundingValidator } from '@/features/tailoring/services/grounding-validator';

export class ApplicationPreparationService {
  constructor(
    private coverLetterProvider: CoverLetterProvider = getCoverLetterProvider(),
    private questionProvider: ApplicationQuestionProvider = getApplicationQuestionProvider()
  ) {}

  /**
   * Validate that all referenced knowledge item IDs exist in candidate's approved knowledge bank
   * and that factual claims are positively anchored without fabrication.
   */
  validateGrounding(
    text: string,
    sourceKnowledgeItemIds: string[],
    approvedKnowledge: KnowledgeItem[],
    candidateId: string,
    allowPersuasiveLanguage: boolean = false
  ): boolean {
    const validation = positiveGroundingValidator.validateClaim({
      proposedText: text,
      sourceKnowledgeItemIds,
      candidateId,
      candidateApprovedKnowledge: approvedKnowledge,
      allowPersuasiveLanguage
    });
    return validation.isValid && validation.status === 'GROUNDED';
  }

  /**
   * Generates or loads grounded preparation materials (cover letter and questions)
   */
  async prepareApplicationMaterials({
    job,
    analysis,
    approvedKnowledge,
    tailoredResume,
    candidate,
    existingCoverLetter,
    existingQuestions
  }: {
    job: Job;
    analysis?: JobAnalysis | null;
    approvedKnowledge: KnowledgeItem[];
    tailoredResume: TailoredResumeVersion;
    candidate: CandidateProfile;
    existingCoverLetter?: GroundedCoverLetter | null;
    existingQuestions?: GroundedApplicationQuestion[] | null;
  }): Promise<{
    coverLetter: GroundedCoverLetter;
    questions: GroundedApplicationQuestion[];
  }> {
    // 1. Cover letter
    let coverLetter: GroundedCoverLetter;
    if (existingCoverLetter) {
      coverLetter = existingCoverLetter;
    } else {
      try {
        coverLetter = await this.coverLetterProvider.generateCoverLetter({
          job,
          analysis,
          approvedKnowledge,
          tailoredResume,
          candidate
        });
      } catch (err) {
        console.warn(
          'Cover letter generation failed or rate limited, using grounded fallback draft:',
          err
        );
        const { MockCoverLetterProvider } = await import('./providers/cover-letter-provider');
        const fallbackProvider = new MockCoverLetterProvider();
        coverLetter = await fallbackProvider.generateCoverLetter({
          job,
          analysis,
          approvedKnowledge,
          tailoredResume,
          candidate
        });
      }
    }

    // 2. Application questions
    let questions: GroundedApplicationQuestion[];
    if (existingQuestions && existingQuestions.length > 0) {
      questions = existingQuestions;
    } else {
      try {
        questions = await this.questionProvider.generateQuestions({
          job,
          analysis,
          approvedKnowledge,
          tailoredResume,
          candidate
        });
      } catch (err) {
        console.warn(
          'Questions generation failed or rate limited, using grounded fallback questions:',
          err
        );
        const { MockApplicationQuestionProvider } =
          await import('./providers/application-question-provider');
        const fallbackProvider = new MockApplicationQuestionProvider();
        questions = await fallbackProvider.generateQuestions({
          job,
          analysis,
          approvedKnowledge,
          tailoredResume,
          candidate
        });
      }
    }

    return { coverLetter, questions };
  }

  /**
   * Regenerates a grounded cover letter from scratch for the application.
   */
  async regenerateCoverLetter(params: {
    job: Job;
    analysis?: JobAnalysis | null;
    approvedKnowledge: KnowledgeItem[];
    tailoredResume: TailoredResumeVersion;
    candidate: CandidateProfile;
    toneOrInstructions?: string;
  }): Promise<GroundedCoverLetter> {
    return this.coverLetterProvider.generateCoverLetter(params);
  }

  /**
   * Regenerates or answers a specific question.
   */
  async regenerateQuestionAnswer(params: {
    question: string;
    job: Job;
    analysis?: JobAnalysis | null;
    approvedKnowledge: KnowledgeItem[];
    tailoredResume: TailoredResumeVersion;
    candidate: CandidateProfile;
  }): Promise<GroundedApplicationQuestion> {
    const questions = await this.questionProvider.generateQuestions({
      job: params.job,
      analysis: params.analysis,
      approvedKnowledge: params.approvedKnowledge,
      tailoredResume: params.tailoredResume,
      candidate: params.candidate,
      questionsToAnswer: [params.question]
    });

    return (
      questions[0] || {
        id: `q-regen-${Date.now()}`,
        question: params.question,
        category: 'other',
        suggestedAnswer: '',
        sourceKnowledgeItemIds: [],
        evidenceReferences: [],
        grounded: false,
        reviewed: false,
        reviewStatus: 'REQUIRES_REVIEW',
        missingEvidenceNote: null
      }
    );
  }

  /**
   * Computes comprehensive ApplicationSummary and readiness status
   */
  computeApplicationSummary({
    job,
    analysis: _analysis,
    match,
    tailoredResume,
    selectedTemplateId,
    coverLetter,
    questions,
    missingRequirements
  }: {
    job: Job;
    analysis?: JobAnalysis | null;
    match?: JobMatch | null;
    tailoredResume?: TailoredResumeVersion | null;
    selectedTemplateId?: ResumeTemplateId | null;
    coverLetter?: GroundedCoverLetter | null;
    questions?: GroundedApplicationQuestion[] | null;
    missingRequirements?: string[];
  }): ApplicationSummary {
    const tplId: ResumeTemplateId = selectedTemplateId || 'classic-v1';
    const tpl = getResumeTemplate(tplId);

    const isResumeApproved = tailoredResume?.approvalState === 'approved';
    const pendingChanges = tailoredResume?.changes?.filter((c) => c.status === 'pending') || [];
    const isResumeGrounded = tailoredResume?.changes?.every((c) => c.grounded !== false) ?? false;

    const isCoverLetterReviewed = coverLetter?.status === 'reviewed';
    const totalQuestions = questions?.length || 0;
    const reviewedQuestions = questions?.filter((q) => q.reviewed).length || 0;
    const allQuestionsReviewed = totalQuestions > 0 && reviewedQuestions === totalQuestions;

    const checklist: ApplicationReadinessChecklistItem[] = [
      {
        id: 'resume-finalized',
        title: 'Tailored Resume Finalized',
        description: isResumeApproved
          ? `All proposed changes reviewed and approved (${tailoredResume?.title || 'Tailored Resume'})`
          : pendingChanges.length > 0
            ? `${pendingChanges.length} proposed revisions pending your candidate review`
            : 'Resume draft in review',
        status: isResumeApproved ? 'complete' : 'warning'
      },
      {
        id: 'resume-grounded',
        title: 'Knowledge Bank Grounding',
        description: isResumeGrounded
          ? 'All claims anchored to approved Knowledge Bank items'
          : 'Contains unverified or ungrounded statements',
        status: isResumeGrounded ? 'complete' : 'incomplete'
      },
      {
        id: 'template-selected',
        title: 'Presentation Template Selected',
        description: `${tpl.name} (v${tpl.version}) configured for PDF & DOCX export`,
        status: 'complete'
      },
      {
        id: 'cover-letter-ready',
        title: 'Cover Letter Reviewed',
        description: isCoverLetterReviewed
          ? 'Cover letter tailored and marked reviewed'
          : 'Cover letter draft generated — needs candidate review',
        status: isCoverLetterReviewed ? 'complete' : 'warning'
      },
      {
        id: 'questions-ready',
        title: 'Application Q&A Preparation',
        description: allQuestionsReviewed
          ? `All ${totalQuestions} application questions reviewed & verified`
          : `${reviewedQuestions}/${totalQuestions} application questions reviewed`,
        status: allQuestionsReviewed ? 'complete' : 'warning'
      }
    ];

    // Generic gap detection from JobMatch or analysis (no hardcoded company names)
    const knownGaps: string[] = [];
    if (missingRequirements && missingRequirements.length > 0) {
      knownGaps.push(...missingRequirements);
    } else if (match?.missingRequirements && match.missingRequirements.length > 0) {
      match.missingRequirements.forEach((m) => {
        knownGaps.push(`${m.title}: ${m.detail}`);
      });
    }

    if (knownGaps.length > 0) {
      checklist.push({
        id: 'known-gaps',
        title: 'Known Skill Gaps Identified',
        description: `Acknowledged ${knownGaps.length} unverified job requirements (not fabricated on resume)`,
        status: 'complete'
      });
    }

    const allComplete = checklist.every((c) => c.status === 'complete');
    const hasIncomplete = checklist.some((c) => c.status === 'incomplete');

    const readinessStatus: 'ready' | 'needs_review' | 'incomplete' = hasIncomplete
      ? 'incomplete'
      : allComplete
        ? 'ready'
        : 'needs_review';

    return {
      jobId: job.id,
      company: job.company,
      role: job.title,
      matchScore: match?.score ?? 85,
      recommendation: match?.recommendation ?? 'good',
      tailoredResumeStatus: tailoredResume?.approvalState || 'draft',
      selectedTemplateId: tplId,
      selectedTemplateName: tpl.name,
      coverLetterReady: isCoverLetterReviewed,
      questionsCount: totalQuestions,
      questionsReviewedCount: reviewedQuestions,
      knownGaps,
      readinessStatus,
      checklist
    };
  }
}

export const applicationPreparationService = new ApplicationPreparationService();
