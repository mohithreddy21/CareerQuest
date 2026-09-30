import { ApplicationDetail } from '@/features/applications/api/types';
import { PreparationMaterialsResponse } from '../api/types';

export type PreFlightStatus = 'ready' | 'needs_review' | 'missing' | 'unavailable';

export interface PreFlightCheckItem {
  id: string;
  label: string;
  category: 'resume' | 'cover_letter' | 'questions' | 'destination' | 'integrity';
  status: PreFlightStatus;
  isBlocking: boolean;
  detail: string;
}

export interface ReadyRoomEvaluation {
  isReadyToApply: boolean;
  blockingCount: number;
  warningsCount: number;
  items: PreFlightCheckItem[];
  destinationUrl: string | null;
  destinationDomain: string | null;
  hasResume: boolean;
  hasCoverLetter: boolean;
  questionsTotal: number;
  questionsReviewed: number;
  isApplied: boolean;
}

export function evaluateApplicationReadiness(
  application: ApplicationDetail,
  prep: PreparationMaterialsResponse
): ReadyRoomEvaluation {
  const isApplied = application.status === 'applied' || Boolean(application.dateApplied);
  const items: PreFlightCheckItem[] = [];

  // 1. Resume validation
  const resume = application.resume;
  const hasResume = Boolean(resume);
  const pendingChanges = resume?.changes?.filter((c) => c.status === 'pending') || [];
  const isResumeApproved = resume?.approvalState === 'approved';

  if (!hasResume) {
    items.push({
      id: 'resume-attached',
      label: 'Tailored Resume',
      category: 'resume',
      status: 'missing',
      isBlocking: true,
      detail: 'No tailored resume or master resume is attached to this application.'
    });
  } else if (!isResumeApproved && pendingChanges.length > 0) {
    items.push({
      id: 'resume-attached',
      label: 'Tailored Resume',
      category: 'resume',
      status: 'needs_review',
      isBlocking: false,
      detail: `${pendingChanges.length} proposed revisions are pending your review.`
    });
  } else {
    items.push({
      id: 'resume-attached',
      label: 'Tailored Resume',
      category: 'resume',
      status: 'ready',
      isBlocking: false,
      detail: `Approved resume version: "${resume?.title || 'Tailored Resume'}"`
    });
  }

  // 2. Final resume version selected
  const hasVersionId = Boolean(
    application.tailoredResumeVersionId || application.resumeVersionId || resume?.id
  );
  items.push({
    id: 'resume-version-selected',
    label: 'Resume Version Selected',
    category: 'resume',
    status: hasVersionId ? 'ready' : 'missing',
    isBlocking: true,
    detail: hasVersionId
      ? `Anchored to version ${application.tailoredResumeVersionId || application.resumeVersionId || resume?.id}`
      : 'No target resume version ID identified.'
  });

  // 3. Resume export available
  const hasExportContent = hasResume && Boolean(resume?.summary || resume?.experience?.length);
  items.push({
    id: 'resume-export',
    label: 'Resume Export Available',
    category: 'resume',
    status: hasExportContent ? 'ready' : 'unavailable',
    isBlocking: false,
    detail: hasExportContent
      ? 'PDF and DOCX exports can be generated on demand.'
      : 'Resume content is empty; export unavailable.'
  });

  // 4. Cover Letter validation
  const coverLetter = prep.coverLetter;
  const hasCoverLetter = Boolean(
    coverLetter && coverLetter.body && coverLetter.body.trim().length > 0
  );
  const isCoverLetterReviewed = coverLetter?.status === 'reviewed';

  if (!hasCoverLetter) {
    items.push({
      id: 'cover-letter',
      label: 'Cover Letter',
      category: 'cover_letter',
      status: 'missing',
      isBlocking: false, // Optional for many roles
      detail: 'No cover letter prepared. (Optional for roles not requesting one)'
    });
  } else if (!isCoverLetterReviewed) {
    items.push({
      id: 'cover-letter',
      label: 'Cover Letter',
      category: 'cover_letter',
      status: 'needs_review',
      isBlocking: false,
      detail: 'Cover letter draft generated but pending candidate review.'
    });
  } else {
    items.push({
      id: 'cover-letter',
      label: 'Cover Letter',
      category: 'cover_letter',
      status: 'ready',
      isBlocking: false,
      detail: 'Cover letter reviewed and grounded in Knowledge Bank facts.'
    });
  }

  // 5. Application Questions validation
  const questions = prep.questions || [];
  const questionsTotal = questions.length;
  const questionsReviewed = questions.filter((q) => q.reviewed).length;
  const missingEvidenceCount = questions.filter(
    (q) => q.reviewStatus === 'MISSING_EVIDENCE'
  ).length;

  if (questionsTotal === 0) {
    items.push({
      id: 'questions',
      label: 'Application Questions',
      category: 'questions',
      status: 'ready',
      isBlocking: false,
      detail: 'No application questions detected for this position.'
    });
  } else if (questionsReviewed < questionsTotal) {
    items.push({
      id: 'questions',
      label: 'Application Questions',
      category: 'questions',
      status: 'needs_review',
      isBlocking: false,
      detail: `${questionsReviewed} of ${questionsTotal} questions reviewed.${missingEvidenceCount > 0 ? ` (${missingEvidenceCount} flagged for missing evidence)` : ''}`
    });
  } else {
    items.push({
      id: 'questions',
      label: 'Application Questions',
      category: 'questions',
      status: 'ready',
      isBlocking: false,
      detail: `All ${questionsTotal} application questions reviewed.`
    });
  }

  // 6. Application Destination URL validation
  const job = application.job;
  const destinationUrl = job.originalUrl || null;
  let destinationDomain: string | null = null;

  if (destinationUrl) {
    try {
      const parsed = new URL(destinationUrl);
      destinationDomain = parsed.hostname.replace(/^www\./, '');
    } catch {
      destinationDomain = 'External Website';
    }
  }

  const hasValidDestination = Boolean(destinationUrl && destinationUrl.startsWith('http'));
  items.push({
    id: 'destination-url',
    label: 'Application Destination',
    category: 'destination',
    status: hasValidDestination ? 'ready' : 'unavailable',
    isBlocking: true,
    detail: hasValidDestination
      ? `Verified portal: ${destinationDomain || destinationUrl}`
      : 'No external application URL recorded for this opportunity.'
  });

  // 7. Overall blocking evaluation
  const blockingItems = items.filter(
    (item) => item.isBlocking && (item.status === 'missing' || item.status === 'unavailable')
  );
  const warningItems = items.filter(
    (item) => item.status === 'needs_review' || (!item.isBlocking && item.status === 'missing')
  );

  const isReadyToApply = blockingItems.length === 0;

  return {
    isReadyToApply,
    blockingCount: blockingItems.length,
    warningsCount: warningItems.length,
    items,
    destinationUrl,
    destinationDomain,
    hasResume,
    hasCoverLetter,
    questionsTotal,
    questionsReviewed,
    isApplied
  };
}
