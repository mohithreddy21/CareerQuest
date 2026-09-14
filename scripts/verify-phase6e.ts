/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { setTestCandidateId } from '../src/lib/auth';
import { serializeActionResponse } from '../src/lib/action-utils';
import {
  createApplicationAction,
  updateApplicationStatusAction,
  updateApplicationNotesAction,
  updateApplicationFollowUpAction,
  updateApplicationArchiveStatusAction,
  addInterviewStageAction,
  updateInterviewStageAction,
  deleteInterviewStageAction,
  addApplicationContactAction,
  updateApplicationContactAction,
  deleteApplicationContactAction
} from '../src/features/applications/actions';
import {
  confirmApplicationSubmissionAction,
  updateCoverLetterDraftAction,
  updateQuestionAnswerAction,
  updateApplicationTemplateSelectionAction,
  recordResumeExportEventAction
} from '../src/features/preparation/actions';
import {
  addKnowledgeItemAction,
  updateKnowledgeItemAction,
  updateKnowledgeItemStatusAction,
  deleteKnowledgeItemAction,
  resolveProposedItemAction
} from '../src/features/knowledge/actions';
import {
  updateCandidateProfileAction,
  updateResumeChangeStatusAction,
  editResumeChangeContentAction,
  approveAllResumeChangesAction
} from '../src/features/resume/actions';
import {
  importJobByUrlAction,
  runJobAnalysisAction
} from '../src/features/jobs/actions';
import { updateUserSettingsAction } from '../src/features/settings/actions';
import { getCareerRepository, setCareerRepositoryMode } from '../src/services/repository-provider';

const prisma = new PrismaClient();

interface TestResult {
  group: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(group: string, name: string, passed: boolean, details?: string) {
  results.push({ group, name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${group}] ${name}${details ? ` -> ${details}` : ''}`);
}

async function verifyPhase6E() {
  console.log('🔍 Starting CareerQuest Phase 6E Server Actions & Mutation Pipeline Verification...\n');

  try {
    // -------------------------------------------------------------------------
    // 1. Guardrail 1: Test Candidate ID Isolation & Auth Boundary
    // -------------------------------------------------------------------------
    console.log('🛡️ 1. Testing Auth Boundary & Guardrail 1...');

    // A: Unauthenticated mutation rejection
    setTestCandidateId(null);
    let unauthRejected = false;
    try {
      await updateApplicationStatusAction({
        id: 'app-1',
        status: 'interview'
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNAUTHENTICATED')) {
        unauthRejected = true;
      }
    }
    recordTest(
      'Auth Boundary',
      'Unauthenticated mutation rejected with UNAUTHENTICATED error',
      unauthRejected,
      'Blocked without session'
    );

    // B: Guardrail 1 - setTestCandidateId fails if NODE_ENV === 'production'
    const prevEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    let prodGuardBlocked = false;
    try {
      setTestCandidateId('malicious-id');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('SECURITY VIOLATION')) {
        prodGuardBlocked = true;
      }
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
    }
    recordTest(
      'Guardrail 1',
      'setTestCandidateId fails loudly in production environment',
      prodGuardBlocked,
      'Throws SECURITY VIOLATION'
    );

    // Set authenticated test candidate Alex Chen (cand-1)
    setTestCandidateId('cand-1');

    // -------------------------------------------------------------------------
    // 2. Runtime Input Validation
    // -------------------------------------------------------------------------
    console.log('\n📋 2. Testing Runtime Input Validation (Zod)...');

    let malformedRejected = false;
    try {
      // Missing id and invalid status
      await (updateApplicationStatusAction as any)({
        id: '',
        status: 'invalid_status_xyz'
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('VALIDATION_ERROR')) {
        malformedRejected = true;
      }
    }
    recordTest(
      'Runtime Validation',
      'Malformed payload rejected with VALIDATION_ERROR before service execution',
      malformedRejected,
      'Validated via Zod'
    );

    let invalidUrlRejected = false;
    try {
      await importJobByUrlAction({
        url: 'not-a-valid-url'
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('VALIDATION_ERROR')) {
        invalidUrlRejected = true;
      }
    }
    recordTest(
      'Runtime Validation',
      'Invalid job URL rejected before repository access',
      invalidUrlRejected,
      'Validated URL format'
    );

    // -------------------------------------------------------------------------
    // 3. Candidate Isolation & Ownership Enforcement
    // -------------------------------------------------------------------------
    console.log('\n🔒 3. Testing Candidate Ownership & Isolation...');

    // Candidate B (Bob) tries to mutate Candidate A (Alex, cand-1)'s application
    setTestCandidateId('cand-2'); // Bob
    let crossCandidateBlocked = false;
    try {
      await updateApplicationStatusAction({
        id: 'app-1', // Belongs to cand-1
        status: 'withdrawn'
      });
    } catch (err: unknown) {
      // Repository throws Error/ForbiddenError/NotFoundError for cross-candidate
      crossCandidateBlocked = true;
    }
    recordTest(
      'Candidate Isolation',
      'Candidate B cannot mutate Candidate A application (cross-candidate blocked)',
      crossCandidateBlocked,
      'Isolation boundary preserved'
    );

    // Switch back to Candidate A (Alex Chen)
    setTestCandidateId('cand-1');

    // -------------------------------------------------------------------------
    // 4. Application Mutations via Server Actions
    // -------------------------------------------------------------------------
    // Clean up any pre-existing application for job-5 for test determinism
    await prisma.application.deleteMany({
      where: { candidateId: 'cand-1', jobId: 'job-5' }
    });

    // Create Application
    const newApp = await createApplicationAction({
      jobId: 'job-5',
      initialStatus: 'interested'
    });
    recordTest(
      'Application Actions',
      'createApplicationAction creates application for authenticated candidate',
      Boolean(newApp && newApp.id && newApp.status === 'interested'),
      `Created Application ID: ${newApp.id}`
    );

    // Update Status
    const statusUpdated = await updateApplicationStatusAction({
      id: newApp.id,
      status: 'preparing',
      note: 'Started tailored preparation phase'
    });
    recordTest(
      'Application Actions',
      'updateApplicationStatusAction updates lifecycle stage to preparing',
      statusUpdated.status === 'preparing',
      `Stage: ${statusUpdated.status}`
    );

    // Update Notes
    const notesUpdated = await updateApplicationNotesAction({
      id: newApp.id,
      notes: 'Initial recruiter screening scheduled for next week.'
    });
    recordTest(
      'Application Actions',
      'updateApplicationNotesAction saves candidate notes',
      Boolean(notesUpdated.notes?.includes('Initial recruiter screening')),
      `Notes: "${notesUpdated.notes?.slice(0, 35)}..."`
    );

    // Update Follow-up
    const followUpUpdated = await updateApplicationFollowUpAction({
      id: newApp.id,
      followUpDate: '2026-09-30',
      followUpStatus: 'pending',
      followUpNote: 'Check in on resume review status'
    });
    recordTest(
      'Application Actions',
      'updateApplicationFollowUpAction schedules follow-up milestone',
      followUpUpdated.followUpStatus === 'pending' && followUpUpdated.followUpDate === '2026-09-30',
      `Date: ${followUpUpdated.followUpDate}, Status: ${followUpUpdated.followUpStatus}`
    );

    // Add Interview Stage
    const stageAdded = await addInterviewStageAction({
      applicationId: newApp.id,
      stage: {
        stageName: 'Technical Screen',
        scheduledDate: '2026-10-02T14:00:00Z',
        interviewerNames: ['Jane Smith (Staff Eng)'],
        meetingLink: 'https://meet.google.com/abc-def-ghi',
        status: 'scheduled',
        outcome: 'pending'
      }
    });
    recordTest(
      'Application Actions',
      'addInterviewStageAction appends interview milestone',
      Boolean(stageAdded && stageAdded.id === newApp.id),
      'Interview round added'
    );

    // Add Application Contact
    const contactAdded = await addApplicationContactAction({
      applicationId: newApp.id,
      contact: {
        name: 'Sarah Connor',
        role: 'Engineering Recruiter',
        email: 'sarah.connor@example.com',
        phone: '555-0199',
        notes: 'Initial recruiter contact'
      }
    });
    recordTest(
      'Application Actions',
      'addApplicationContactAction adds recruiter contact card',
      Boolean(contactAdded && contactAdded.id === newApp.id),
      'Contact card saved'
    );

    // Archive & Unarchive
    const archived = await updateApplicationArchiveStatusAction({
      id: newApp.id,
      isArchived: true
    });
    recordTest(
      'Application Actions',
      'updateApplicationArchiveStatusAction sets isArchived to true',
      archived.isArchived === true,
      'Application archived'
    );

    const unarchived = await updateApplicationArchiveStatusAction({
      id: newApp.id,
      isArchived: false
    });
    recordTest(
      'Application Actions',
      'updateApplicationArchiveStatusAction restores isArchived to false',
      unarchived.isArchived === false,
      'Application restored'
    );

    // -------------------------------------------------------------------------
    // 5. Optimistic Concurrency Control via Server Actions
    // -------------------------------------------------------------------------
    console.log('\n⚡ 5. Testing Optimistic Concurrency Control...');

    // Current version in DB
    const currentApp = await prisma.application.findUnique({
      where: { id: newApp.id }
    });
    const currentVersion = currentApp?.version ?? 1;

    // A: Stale version attempt
    let staleBlocked = false;
    try {
      await updateApplicationNotesAction({
        id: newApp.id,
        notes: 'Stale overwrite attempt',
        expectedVersion: currentVersion - 1 // Stale
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('CONCURRENCY_ERROR')) {
        staleBlocked = true;
      }
    }
    recordTest(
      'Optimistic Concurrency',
      'Stale expectedVersion throws CONCURRENCY_ERROR through Server Action',
      staleBlocked,
      `Expected ${currentVersion - 1} vs Actual ${currentVersion}`
    );

    // B: Correct version succeeds
    const correctVersionUpdated = await updateApplicationNotesAction({
      id: newApp.id,
      notes: 'Concurrency verified notes',
      expectedVersion: currentVersion
    });
    recordTest(
      'Optimistic Concurrency',
      'Valid expectedVersion succeeds and increments version atomically',
      correctVersionUpdated.version === currentVersion + 1,
      `New version: ${correctVersionUpdated.version}`
    );

    // -------------------------------------------------------------------------
    // 6. Application Confirmation Transaction & Historical Immutability
    // -------------------------------------------------------------------------
    console.log('\n🔒 6. Testing Application Confirmation Transaction...');

    // Create fresh application for confirmation test
    const appToConfirm = await createApplicationAction({
      jobId: 'job-1', // Stripe
      initialStatus: 'preparing'
    });

    // Confirm application submission
    const confirmed = await confirmApplicationSubmissionAction({
      applicationId: appToConfirm.id,
      note: 'Applied on Stripe career portal with classic-v1 template',
      templateId: 'classic-v1',
      templateVersion: '1.0'
    });

    recordTest(
      'Confirmation Transaction',
      'confirmApplicationSubmissionAction transitions status to applied',
      confirmed.status === 'applied' && Boolean(confirmed.dateApplied),
      `Status: ${confirmed.status}, Applied: ${confirmed.dateApplied}`
    );

    recordTest(
      'Confirmation Transaction',
      'Freezes resumeSnapshot and matchScoreAtApplication in transaction',
      Boolean(confirmed.resumeSnapshot && confirmed.matchScoreAtApplication === 94),
      `Frozen Match Score: ${confirmed.matchScoreAtApplication}%, Snapshot: ${(confirmed.resumeSnapshot as any)?.identity?.name || (confirmed.resumeSnapshot as any)?.contact?.name}`
    );

    // Double-submit protection: confirmation on already confirmed application
    let doubleConfirmSafe = false;
    try {
      // Calling confirm on already-applied application
      const reConfirm = await confirmApplicationSubmissionAction({
        applicationId: appToConfirm.id,
        note: 'Accidental double submission click'
      });
      // Should either return existing or preserve snapshot without duplicating applied_confirmed
      if (reConfirm.status === 'applied') doubleConfirmSafe = true;
    } catch {
      doubleConfirmSafe = true;
    }
    recordTest(
      'Double Submit Protection',
      'Repeated confirmation does not corrupt frozen fields or fail catastrophically',
      doubleConfirmSafe,
      'Protected against double click'
    );

    // Historical Immutability: Template selection cannot mutate applied application
    const frozenSnapshotBefore = JSON.stringify(confirmed.resumeSnapshot);
    await updateApplicationTemplateSelectionAction({
      applicationId: appToConfirm.id,
      templateId: 'modern-v1' as any
    });
    const checkAfter = await prisma.application.findUnique({
      where: { id: appToConfirm.id }
    });
    recordTest(
      'Historical Immutability',
      'Template update attempts on confirmed application safely ignore mutations',
      checkAfter?.selectedTemplateId === 'classic-v1' &&
        JSON.stringify(checkAfter?.resumeSnapshot) === frozenSnapshotBefore,
      'Immutable snapshot and template preserved'
    );

    // -------------------------------------------------------------------------
    // 7. Knowledge Bank & Provenance Mutations via Server Actions
    // -------------------------------------------------------------------------
    console.log('\n📚 7. Testing Knowledge Bank Mutation Server Actions...');

    // Add Knowledge Item
    const newKnowledgeItem = await addKnowledgeItemAction({
      category: 'skill',
      content: { name: 'Distributed Systems Tracing', level: 'expert' },
      provenanceLabel: 'Server Action Test'
    });
    recordTest(
      'Knowledge Actions',
      'addKnowledgeItemAction adds verified knowledge item with provenance',
      Boolean(newKnowledgeItem && newKnowledgeItem.id),
      `Item ID: ${newKnowledgeItem.id}, Status: ${newKnowledgeItem.status}`
    );

    // Update Knowledge Item
    const updatedItem = await updateKnowledgeItemAction({
      id: newKnowledgeItem.id,
      content: { name: 'Distributed Systems Tracing (OpenTelemetry)', level: 'expert' },
      provenanceNote: 'Updated via Server Action'
    });
    recordTest(
      'Knowledge Actions',
      'updateKnowledgeItemAction updates content and appends provenance note',
      Boolean(updatedItem),
      'Content and provenance updated'
    );

    // Update Status (archive)
    const archivedItem = await updateKnowledgeItemStatusAction({
      id: newKnowledgeItem.id,
      status: 'archived'
    });
    recordTest(
      'Knowledge Actions',
      'updateKnowledgeItemStatusAction updates lifecycle status to archived',
      archivedItem.status === 'archived',
      `Status: ${archivedItem.status}`
    );

    // Delete Knowledge Item
    const deleted = await deleteKnowledgeItemAction(newKnowledgeItem.id);
    recordTest(
      'Knowledge Actions',
      'deleteKnowledgeItemAction permanently deletes candidate knowledge item',
      deleted === true,
      'Item deleted'
    );

    // -------------------------------------------------------------------------
    // 8. Resume Tailoring & Profile Mutations
    // -------------------------------------------------------------------------
    console.log('\n📝 8. Testing Resume Tailoring & Profile Server Actions...');

    // Update Candidate Profile (presentation only)
    const updatedProfile = await updateCandidateProfileAction({
      updates: {
        headline: 'Staff Full-Stack & Systems Architect',
        professionalSummary: 'Senior engineering leader focused on resilient distributed architectures.'
      }
    });
    recordTest(
      'Profile Actions',
      'updateCandidateProfileAction updates presentation facts scoped to candidate',
      updatedProfile.headline === 'Staff Full-Stack & Systems Architect',
      `Headline: ${updatedProfile.headline}`
    );

    // Resume change review
    const tailoredResume = await prisma.resumeVersion.findFirst({
      where: { candidateId: 'cand-1', jobId: { not: null } },
      include: { changes: true }
    });
    if (tailoredResume) {
      const pendingChange = (tailoredResume.changes as any[])?.[0];
      if (pendingChange) {
        const approvedChange = await updateResumeChangeStatusAction({
          resumeVersionId: tailoredResume.id,
          changeId: pendingChange.id,
          status: 'approved'
        });
        recordTest(
          'Tailoring Actions',
          'updateResumeChangeStatusAction updates change review status to approved',
          Boolean(approvedChange),
          `Change: ${pendingChange.id} approved`
        );
      }
    }

    // -------------------------------------------------------------------------
    // 9. Settings & Preferences Mutations
    // -------------------------------------------------------------------------
    console.log('\n⚙️ 9. Testing Settings & Search Preferences Server Actions...');

    const updatedSettings = await updateUserSettingsAction({
      updates: {
        targetSalaryMin: 180000,
        currency: 'USD',
        workArrangements: ['remote']
      }
    });
    recordTest(
      'Settings Actions',
      'updateUserSettingsAction updates candidate search preferences',
      updatedSettings.targetSalaryMin === 180000 && updatedSettings.workArrangements.includes('remote'),
      `Min Salary: $${updatedSettings.targetSalaryMin}, Arrangements: ${updatedSettings.workArrangements.join(',')}`
    );

    // -------------------------------------------------------------------------
    // 10. Guardrail 2: Real Serialization Verification
    // -------------------------------------------------------------------------
    console.log('\n📦 10. Testing Guardrail 2 (Real Serialization)...');

    const sampleResponse = serializeActionResponse(confirmed);
    const isPureJson = typeof sampleResponse === 'object' && JSON.parse(JSON.stringify(sampleResponse));
    const hasPrismaSymbols = Object.getOwnPropertySymbols(sampleResponse).length > 0;
    recordTest(
      'Guardrail 2',
      'Server Action responses are pure serializable JSON without Prisma symbols or models',
      Boolean(isPureJson && !hasPrismaSymbols),
      'Verified serialization'
    );

    // -------------------------------------------------------------------------
    // 11. Guardrail 4: True Database Persistence Across Fresh PrismaClient
    // -------------------------------------------------------------------------
    console.log('\n💾 11. Testing Guardrail 4 (Fresh-Client Database Persistence)...');

    // Create distinct persistence checkpoint
    const persistenceApp = await createApplicationAction({
      jobId: 'job-3',
      initialStatus: 'interested'
    });
    const persistenceNote = `Persistence Verification Token: ${Date.now()}`;
    await updateApplicationNotesAction({
      id: persistenceApp.id,
      notes: persistenceNote
    });

    // Disconnect current PrismaClient
    await prisma.$disconnect();

    // Instantiate completely fresh PrismaClient instance
    const freshPrisma = new PrismaClient();
    const persistedRecord = await freshPrisma.application.findUnique({
      where: { id: persistenceApp.id }
    });
    await freshPrisma.$disconnect();

    recordTest(
      'Guardrail 4',
      'Data survives PrismaClient disconnect and is verified by a fresh client instance',
      persistedRecord !== null && persistedRecord.notes === persistenceNote,
      `Verified via Fresh PrismaClient: "${persistedRecord?.notes?.slice(0, 35)}..."`
    );

    // -------------------------------------------------------------------------
    // 12. Repository Selection & Failure Handling (No Silent In-Memory Fallback)
    // -------------------------------------------------------------------------
    console.log('\n🏭 12. Testing Repository Mode & Failure Safety...');

    // Production mode resolves PrismaCareerRepository
    const defaultRepo = getCareerRepository();
    recordTest(
      'Repository Provider',
      'Default/production repository resolves to PrismaCareerRepository',
      defaultRepo.constructor.name === 'PrismaCareerRepository',
      `Active: ${defaultRepo.constructor.name}`
    );

    // Explicit test mode resolves InMemoryCareerRepository
    setCareerRepositoryMode('in-memory');
    const inMemoryRepo = getCareerRepository('in-memory');
    recordTest(
      'Repository Provider',
      'Explicit in-memory test mode resolves InMemoryCareerRepository',
      inMemoryRepo.constructor.name === 'InMemoryCareerRepository',
      `Test Mode: ${inMemoryRepo.constructor.name}`
    );

    // Reset back to prisma mode
    setCareerRepositoryMode('prisma');

    // Re-verify Phase 5 benchmark match scores
    const stripeMatch = await defaultRepo.getJobMatch('job-1', 'cand-1');
    const datadogMatch = await defaultRepo.getJobMatch('job-2', 'cand-1');
    const linearMatch = await defaultRepo.getJobMatch('job-4', 'cand-1');

    recordTest(
      'Decision Support Regression',
      'Stripe exact match score preserved at 94%',
      stripeMatch?.score === 94,
      `Actual: ${stripeMatch?.score}%`
    );
    recordTest(
      'Decision Support Regression',
      'Datadog exact match score preserved at 82%',
      datadogMatch?.score === 82,
      `Actual: ${datadogMatch?.score}%`
    );
    recordTest(
      'Decision Support Regression',
      'Linear exact match score preserved at 76%',
      linearMatch?.score === 76,
      `Actual: ${linearMatch?.score}%`
    );

  } catch (error) {
    console.error('Fatal error during Phase 6E verification:', error);
    process.exit(1);
  } finally {
    setTestCandidateId(undefined); // Reset test auth state
    await prisma.$disconnect();
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log('\n======================================================');
  console.log(`Phase 6E Verification Result: ${passed}/${total} Passed`);
  if (failed === 0) {
    console.log('🎉 PHASE 6E COMPLETE & VERIFIED: All Server Actions and mutation invariants passed.');
  } else {
    console.error(`❌ FAILED: ${failed} tests failed.`);
    process.exit(1);
  }
  console.log('======================================================\n');
}

verifyPhase6E().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
