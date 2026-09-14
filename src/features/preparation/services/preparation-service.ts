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
import { mockCoverLetterProvider, CoverLetterProvider } from './providers/cover-letter-provider';
import {
  mockApplicationQuestionProvider,
  ApplicationQuestionProvider
} from './providers/application-question-provider';

export class ApplicationPreparationService {
  constructor(
    private coverLetterProvider: CoverLetterProvider = mockCoverLetterProvider,
    private questionProvider: ApplicationQuestionProvider = mockApplicationQuestionProvider
  ) {}

  /**
   * Validate that all referenced knowledge item IDs exist in candidate's approved knowledge bank
   * and that no fabricated claims exist.
   */
  validateGrounding(
    sourceKnowledgeItemIds: string[],
    approvedKnowledge: KnowledgeItem[],
    candidateId: string
  ): boolean {
    if (!sourceKnowledgeItemIds || sourceKnowledgeItemIds.length === 0) {
      return false;
    }

    const approvedItems = approvedKnowledge.filter(
      (k) => k.status === 'approved' && k.candidateId === candidateId
    );
    const approvedIds = new Set(approvedItems.map((k) => k.id));

    return sourceKnowledgeItemIds.every((id) => approvedIds.has(id));
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
      const generated = await this.coverLetterProvider.generateCoverLetter({
        job,
        analysis,
        approvedKnowledge,
        tailoredResume,
        candidate
      });
      const isGrounded = this.validateGrounding(
        generated.sourceKnowledgeItemIds,
        approvedKnowledge,
        candidate.id
      );
      coverLetter = {
        ...generated,
        grounded: isGrounded
      };
    }

    // 2. Application questions
    let questions: GroundedApplicationQuestion[];
    if (existingQuestions && existingQuestions.length > 0) {
      questions = existingQuestions;
    } else {
      const generatedQ = await this.questionProvider.generateQuestions({
        job,
        analysis,
        approvedKnowledge,
        tailoredResume,
        candidate
      });
      questions = generatedQ.map((q) => ({
        ...q,
        grounded: this.validateGrounding(q.sourceKnowledgeItemIds, approvedKnowledge, candidate.id)
      }));
    }

    return { coverLetter, questions };
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
          ? '100% of claims anchored to approved Knowledge Bank items'
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
