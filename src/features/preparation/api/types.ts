import {
  GroundedCoverLetter,
  GroundedApplicationQuestion,
  ApplicationSummary
} from '@/types/preparation';
import { ResumeTemplateId, ResumeExport } from '@/types/templates';

export interface PreparationMaterialsResponse {
  coverLetter: GroundedCoverLetter;
  questions: GroundedApplicationQuestion[];
  summary: ApplicationSummary;
  selectedTemplateId: ResumeTemplateId;
}

export interface UpdateCoverLetterPayload {
  applicationId: string;
  coverLetter: GroundedCoverLetter;
}

export interface UpdateQuestionPayload {
  applicationId: string;
  question: GroundedApplicationQuestion;
}

export interface UpdateTemplatePayload {
  applicationId: string;
  templateId: ResumeTemplateId;
}

export interface RecordExportPayload {
  applicationId: string;
  exportRecord: ResumeExport;
}

export interface ConfirmAppliedPayload {
  applicationId: string;
  note?: string;
  templateId?: ResumeTemplateId;
  templateVersion?: string;
  expectedVersion?: number;
}
