'use server';

import { careerRepository } from '@/services/career-repository';
import { requireCandidateId } from '@/lib/auth';
import { applicationPreparationService } from '../services/preparation-service';
import {
  PreparationMaterialsResponse,
  UpdateCoverLetterPayload,
  UpdateQuestionPayload,
  UpdateTemplatePayload,
  RecordExportPayload,
  ConfirmAppliedPayload
} from './types';
import {
  Application,
  GroundedCoverLetter,
  GroundedApplicationQuestion,
  ResumeVersion
} from '@/types/domain';
import { ResumeTemplateId, ResumeExport } from '@/types/templates';
import { RESUME_TEMPLATES } from '@/features/templates/constants/templates';

export async function getPreparationMaterials(
  applicationId: string,
  candidateId?: string
): Promise<PreparationMaterialsResponse> {
  const candId = candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  const application = await careerRepository.getApplicationById(applicationId, candId);
  if (!application) {
    throw new Error(`Application ${applicationId} not found`);
  }

  const job = application.job;
  const candidate = await careerRepository.getCandidateProfile(candId);
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
  let tailoredResume: ResumeVersion | null = await careerRepository.getTailoredResumeForJob(
    job.id,
    candId
  );
  if (!tailoredResume) {
    tailoredResume = await careerRepository.getMasterResume(candId);
  }
  if (!tailoredResume) {
    tailoredResume = {
      id: `resume-baseline-${candidate.id}`,
      candidateId: candidate.id,
      title: 'Master Resume',
      targetRole: candidate.targetRoles?.[0] || 'Professional',
      summary: candidate.professionalSummary || '',
      skills: candidate.skills || { technical: [], tools: [], soft: [], other: [] },
      experience: candidate.experience || [],
      education: candidate.education || [],
      projects: candidate.projects || [],
      certifications: candidate.certifications || [],
      changes: [],
      approvalState: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  const activeResume: ResumeVersion = tailoredResume;

  // Selected template
  const selectedTemplateId: ResumeTemplateId = application.selectedTemplateId || 'classic-v1';

  // Prepare cover letter and questions
  const { coverLetter, questions } =
    await applicationPreparationService.prepareApplicationMaterials({
      job,
      analysis: application.analysis,
      approvedKnowledge,
      tailoredResume: activeResume,
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
        tailoredResumeVersionId: activeResume.id
      },
      candId
    );
  }

  // Load match intelligence for generic gaps & score
  const jobMatch = await careerRepository.getJobMatch(job.id, candId);

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
  const candId = candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  const application = await careerRepository.getApplicationById(payload.applicationId, candId);
  if (!application) throw new Error(`Application not found: ${payload.applicationId}`);

  const candidate = await careerRepository.getCandidateProfile(candId);
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
    candId
  );
  return updatedCoverLetter;
}

export async function updateQuestionAnswer(
  payload: UpdateQuestionPayload,
  candidateId?: string
): Promise<GroundedApplicationQuestion> {
  const candId = candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  const application = await careerRepository.getApplicationById(payload.applicationId, candId);
  if (!application) throw new Error(`Application not found: ${payload.applicationId}`);

  const candidate = await careerRepository.getCandidateProfile(candId);
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
    candId
  );

  return verifiedQuestion;
}

export async function updateApplicationTemplateSelection(
  payload: UpdateTemplatePayload,
  candidateId?: string
): Promise<{ templateId: ResumeTemplateId }> {
  const candId = candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  const version = RESUME_TEMPLATES[payload.templateId]?.version || '1.0';
  await careerRepository.updateApplicationPreparation(
    payload.applicationId,
    {
      selectedTemplateId: payload.templateId,
      selectedTemplateVersion: version
    },
    candId
  );
  return { templateId: payload.templateId };
}

export async function recordResumeExportEvent(
  payload: RecordExportPayload,
  candidateId?: string
): Promise<ResumeExport> {
  const candId = candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  await careerRepository.recordApplicationExport(
    payload.applicationId,
    payload.exportRecord,
    candId
  );
  return payload.exportRecord;
}

export async function confirmApplicationSubmission(
  payload: ConfirmAppliedPayload,
  candidateId?: string,
  expectedVersion?: number
): Promise<Application> {
  const candId = candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return careerRepository.confirmApplicationSubmission(
    payload,
    candId,
    expectedVersion ?? payload.expectedVersion
  );
}
