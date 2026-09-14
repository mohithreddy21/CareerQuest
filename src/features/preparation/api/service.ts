import { careerRepository } from '@/services/career-repository';
import { applicationPreparationService } from '../services/preparation-service';
import {
  PreparationMaterialsResponse,
  UpdateCoverLetterPayload,
  UpdateQuestionPayload,
  UpdateTemplatePayload,
  RecordExportPayload,
  ConfirmAppliedPayload
} from './types';
import { Application, GroundedCoverLetter, GroundedApplicationQuestion } from '@/types/domain';
import { ResumeTemplateId, ResumeExport } from '@/types/templates';
import { RESUME_TEMPLATES } from '@/features/templates/constants/templates';

export async function getPreparationMaterials(
  applicationId: string,
  candidateId?: string
): Promise<PreparationMaterialsResponse> {
  const application = await careerRepository.getApplicationById(applicationId, candidateId);
  if (!application) {
    throw new Error(`Application ${applicationId} not found`);
  }

  const job = application.job;
  const candidate = await careerRepository.getCandidateProfile(candidateId);
  const kb = await careerRepository.getKnowledgeBank(candidate.id);
  const approvedKnowledge = [
    ...kb.skills,
    ...kb.experiences,
    ...kb.projects,
    ...kb.education,
    ...kb.certifications,
    ...kb.achievements
  ].filter((k) => k.status === 'approved');

  // Load tailored resume or master resume fallback
  let tailoredResume = await careerRepository.getTailoredResumeForJob(job.id, candidateId);
  if (!tailoredResume) {
    tailoredResume = await careerRepository.getMasterResume(candidateId);
  }
  if (!tailoredResume) {
    throw new Error('Candidate resume not found');
  }

  // Selected template
  const selectedTemplateId: ResumeTemplateId = application.selectedTemplateId || 'classic-v1';

  // Prepare cover letter and questions
  const { coverLetter, questions } =
    await applicationPreparationService.prepareApplicationMaterials({
      job,
      analysis: application.analysis,
      approvedKnowledge,
      tailoredResume,
      candidate,
      existingCoverLetter: application.coverLetterData,
      existingQuestions: application.preparedQuestions
    });

  // Persist generated initial items if not yet persisted
  if (!application.coverLetterData || !application.preparedQuestions) {
    await careerRepository.updateApplicationPreparation(
      application.id,
      {
        coverLetterData: coverLetter,
        coverLetter: coverLetter.body,
        preparedQuestions: questions,
        selectedTemplateId,
        selectedTemplateVersion: RESUME_TEMPLATES[selectedTemplateId]?.version || '1.0',
        tailoredResumeVersionId: tailoredResume.id
      },
      candidateId
    );
  }

  // Load match intelligence for generic gaps & score
  const jobMatch = await careerRepository.getJobMatch(job.id, candidateId);

  // Compute summary
  const summary = applicationPreparationService.computeApplicationSummary({
    job,
    analysis: application.analysis,
    match: jobMatch,
    tailoredResume,
    selectedTemplateId,
    coverLetter,
    questions
  });

  return {
    coverLetter,
    questions,
    summary,
    selectedTemplateId
  };
}

export async function updateCoverLetterDraft(
  payload: UpdateCoverLetterPayload,
  candidateId?: string
): Promise<GroundedCoverLetter> {
  const application = await careerRepository.getApplicationById(payload.applicationId, candidateId);
  if (!application) throw new Error(`Application not found: ${payload.applicationId}`);

  const candidate = await careerRepository.getCandidateProfile(candidateId);
  const kb = await careerRepository.getKnowledgeBank(candidate.id);
  const approvedKnowledge = [
    ...kb.skills,
    ...kb.experiences,
    ...kb.projects,
    ...kb.education,
    ...kb.certifications,
    ...kb.achievements
  ].filter((k) => k.status === 'approved');

  // Grounding validation on candidate edit
  const isGrounded = applicationPreparationService.validateGrounding(
    payload.coverLetter.sourceKnowledgeItemIds,
    approvedKnowledge,
    candidate.id
  );

  const updatedCoverLetter: GroundedCoverLetter = {
    ...payload.coverLetter,
    grounded: isGrounded
  };

  await careerRepository.updateApplicationPreparation(
    payload.applicationId,
    {
      coverLetterData: updatedCoverLetter,
      coverLetter: updatedCoverLetter.body
    },
    candidateId
  );
  return updatedCoverLetter;
}

export async function updateQuestionAnswer(
  payload: UpdateQuestionPayload,
  candidateId?: string
): Promise<GroundedApplicationQuestion> {
  const application = await careerRepository.getApplicationById(payload.applicationId, candidateId);
  if (!application) throw new Error(`Application not found: ${payload.applicationId}`);

  const candidate = await careerRepository.getCandidateProfile(candidateId);
  const kb = await careerRepository.getKnowledgeBank(candidate.id);
  const approvedKnowledge = [
    ...kb.skills,
    ...kb.experiences,
    ...kb.projects,
    ...kb.education,
    ...kb.certifications,
    ...kb.achievements
  ].filter((k) => k.status === 'approved');

  // Grounding validation on candidate edit
  const isGrounded = applicationPreparationService.validateGrounding(
    payload.question.sourceKnowledgeItemIds,
    approvedKnowledge,
    candidate.id
  );

  const verifiedQuestion: GroundedApplicationQuestion = {
    ...payload.question,
    grounded: isGrounded
  };

  const questions = (application.preparedQuestions || []).map((q) =>
    q.id === payload.question.id ? verifiedQuestion : q
  );

  await careerRepository.updateApplicationPreparation(
    payload.applicationId,
    {
      preparedQuestions: questions
    },
    candidateId
  );

  return verifiedQuestion;
}

export async function updateApplicationTemplateSelection(
  payload: UpdateTemplatePayload,
  candidateId?: string
): Promise<{ templateId: ResumeTemplateId }> {
  const version = RESUME_TEMPLATES[payload.templateId]?.version || '1.0';
  await careerRepository.updateApplicationPreparation(
    payload.applicationId,
    {
      selectedTemplateId: payload.templateId,
      selectedTemplateVersion: version
    },
    candidateId
  );
  return { templateId: payload.templateId };
}

export async function recordResumeExportEvent(
  payload: RecordExportPayload,
  candidateId?: string
): Promise<ResumeExport> {
  await careerRepository.recordApplicationExport(
    payload.applicationId,
    payload.exportRecord,
    candidateId
  );
  return payload.exportRecord;
}

export async function confirmApplicationSubmission(
  payload: ConfirmAppliedPayload,
  candidateId?: string,
  expectedVersion?: number
): Promise<Application> {
  return careerRepository.confirmApplicationSubmission(
    payload,
    candidateId,
    expectedVersion ?? payload.expectedVersion
  );
}
