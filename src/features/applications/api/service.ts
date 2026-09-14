import { careerRepository } from '@/services/career-repository';
import {
  AddApplicationContactPayload,
  AddInterviewStagePayload,
  ApplicationDetail,
  ApplicationWithJob,
  CreateApplicationPayload,
  DeleteApplicationContactPayload,
  DeleteInterviewStagePayload,
  UpdateApplicationArchivePayload,
  UpdateApplicationContactPayload,
  UpdateApplicationFollowUpPayload,
  UpdateApplicationNotesPayload,
  UpdateApplicationStatusPayload,
  UpdateInterviewStagePayload
} from './types';
import { Application, ApplicationEvent } from '@/types/domain';

export async function getApplications(
  filters?: {
    status?: string;
    search?: string;
    sort?: string;
    includeArchived?: boolean;
  },
  candidateId?: string
): Promise<ApplicationWithJob[]> {
  return careerRepository.getApplications(filters, candidateId);
}

export async function getApplicationById(
  id: string,
  candidateId?: string
): Promise<ApplicationDetail | null> {
  return careerRepository.getApplicationById(id, candidateId);
}

export async function getApplicationByJobId(
  jobId: string,
  candidateId?: string
): Promise<Application | null> {
  return careerRepository.getApplicationByJobId(jobId, candidateId);
}

export async function updateApplicationStatus(
  payload: UpdateApplicationStatusPayload,
  candidateId?: string
): Promise<Application> {
  return careerRepository.updateApplicationStatus(
    payload.id,
    payload.status,
    payload.note,
    candidateId,
    payload.expectedVersion
  );
}

export async function createApplication(
  payload: CreateApplicationPayload,
  candidateId?: string
): Promise<Application> {
  return careerRepository.createApplication(
    payload.jobId,
    payload.initialStatus,
    undefined,
    candidateId
  );
}

export async function updateApplicationNotes(
  payload: UpdateApplicationNotesPayload,
  candidateId?: string
): Promise<Application> {
  return careerRepository.updateApplicationNotes(
    payload.id,
    payload.notes,
    candidateId,
    payload.expectedVersion
  );
}

export async function getApplicationEvents(
  applicationId?: string,
  candidateId?: string
): Promise<ApplicationEvent[]> {
  return careerRepository.getApplicationEvents(applicationId, candidateId);
}

export async function updateApplicationFollowUp(
  payload: UpdateApplicationFollowUpPayload,
  candidateId?: string
): Promise<Application> {
  return careerRepository.updateApplicationFollowUp(
    payload.id,
    {
      followUpDate: payload.followUpDate,
      followUpStatus: payload.followUpStatus,
      followUpNote: payload.followUpNote
    },
    candidateId,
    payload.expectedVersion
  );
}

export async function addInterviewStage(
  payload: AddInterviewStagePayload,
  candidateId?: string
): Promise<Application> {
  return careerRepository.addInterviewStage(payload.applicationId, payload.stage, candidateId);
}

export async function updateInterviewStage(
  payload: UpdateInterviewStagePayload,
  candidateId?: string
): Promise<Application> {
  return careerRepository.updateInterviewStage(payload.applicationId, payload.stage, candidateId);
}

export async function deleteInterviewStage(
  payload: DeleteInterviewStagePayload,
  candidateId?: string
): Promise<Application> {
  return careerRepository.deleteInterviewStage(payload.applicationId, payload.stageId, candidateId);
}

export async function addApplicationContact(
  payload: AddApplicationContactPayload,
  candidateId?: string
): Promise<Application> {
  return careerRepository.addApplicationContact(
    payload.applicationId,
    payload.contact,
    candidateId
  );
}

export async function updateApplicationContact(
  payload: UpdateApplicationContactPayload,
  candidateId?: string
): Promise<Application> {
  return careerRepository.updateApplicationContact(
    payload.applicationId,
    payload.contactId,
    payload.updates,
    candidateId
  );
}

export async function deleteApplicationContact(
  payload: DeleteApplicationContactPayload,
  candidateId?: string
): Promise<Application> {
  return careerRepository.deleteApplicationContact(
    payload.applicationId,
    payload.contactId,
    candidateId
  );
}

export async function updateApplicationArchiveStatus(
  payload: UpdateApplicationArchivePayload,
  candidateId?: string
): Promise<Application> {
  return careerRepository.updateApplicationArchiveStatus(
    payload.id,
    payload.isArchived,
    candidateId,
    payload.expectedVersion
  );
}
