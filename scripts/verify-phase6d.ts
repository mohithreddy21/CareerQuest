/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { PrismaCareerRepository } from '../src/services/prisma-career-repository';
import { InMemoryCareerRepository } from '../src/services/in-memory-career-repository';
import { ConcurrencyError } from '../src/types/errors';
import { NextActionsService } from '../src/features/overview/services/next-actions-service';
import { SearchAnalyticsService } from '../src/features/analytics/services/analytics-service';

const prisma = new PrismaClient();
const prismaRepo = new PrismaCareerRepository();
const inMemoryRepo = new InMemoryCareerRepository();

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

async function cleanupIsolationFixtures() {
  const testCandIds = ['cand-iso-a', 'cand-iso-b', 'cand-rollback-test'];
  try {
    await prisma.resumeExportRecord.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.applicationContact.deleteMany({
      where: { application: { candidateId: { in: testCandIds } } }
    });
    await prisma.interviewStage.deleteMany({
      where: { application: { candidateId: { in: testCandIds } } }
    });
    await prisma.applicationEvent.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.application.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.resumeChange.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.resumeVersion.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.jobMatch.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.job.deleteMany({ where: { importedByCandidateId: { in: testCandIds } } });
    await prisma.knowledgeProvenance.deleteMany({
      where: { knowledgeItem: { candidateId: { in: testCandIds } } }
    });
    await prisma.knowledgeItem.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.candidateDocument.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.resumeIngestionBatch.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.candidateProfile.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.candidatePreferences.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.candidate.deleteMany({ where: { id: { in: testCandIds } } });
  } catch (err) {
    console.warn('Cleanup warning:', err);
  }
}

async function verifyPhase6D() {
  console.log('🔍 Starting CareerQuest Phase 6D Application Tracking Persistence Verification...\n');

  try {
    await cleanupIsolationFixtures();

    // -------------------------------------------------------------------------
    // GROUP 1: Application CRUD & Queries
    // -------------------------------------------------------------------------
    console.log('📋 1. Testing Application CRUD & Queries...');
    const seedApps = await prismaRepo.getApplications({ includeArchived: true }, 'cand-1');
    recordTest(
      'Application CRUD',
      'Retrieve Seed Applications list for candidate',
      seedApps.length >= 3,
      `Found ${seedApps.length} applications`
    );

    const stripeApp = seedApps.find((a) => a.id === 'app-1') || seedApps.find((a) => a.job.company === 'Stripe');
    recordTest(
      'Application CRUD',
      'Stripe Application Present',
      Boolean(stripeApp),
      `ID: ${stripeApp?.id}, Status: ${stripeApp?.status}`
    );

    if (stripeApp) {
      const detail = await prismaRepo.getApplicationById(stripeApp.id, 'cand-1');
      recordTest(
        'Application CRUD',
        'Retrieve Application Detail with Relations',
        Boolean(detail && detail.job && detail.events && detail.statusHistory),
        `Events: ${detail?.events?.length || 0}, Stages: ${detail?.interviewStages?.length || 0}`
      );

      const byJob = await prismaRepo.getApplicationByJobId(stripeApp.jobId, 'cand-1');
      recordTest(
        'Application CRUD',
        'Retrieve Application by JobId',
        Boolean(byJob && (byJob.id === stripeApp.id || byJob.jobId === stripeApp.jobId)),
        `Found Application ID: ${byJob?.id}`
      );
    }

    // -------------------------------------------------------------------------
    // GROUP 2: Lifecycle Transitions & Date Management
    // -------------------------------------------------------------------------
    console.log('\n🔄 2. Testing Lifecycle Transitions & Reopening...');
    const testJob = await prisma.job.findFirst({ where: { isPublic: true } });
    if (!testJob) throw new Error('No public job available for lifecycle test');

    const createdApp = await prismaRepo.createApplication(
      testJob.id,
      'interested',
      { allowDuplicate: true },
      'cand-1'
    );
    recordTest(
      'Lifecycle Transitions',
      'Create Application with initial status',
      createdApp.status === 'interested',
      `ID: ${createdApp.id}, Status: ${createdApp.status}`
    );

    // Transition interested -> preparing
    const prepApp = await prismaRepo.updateApplicationStatus(
      createdApp.id,
      'preparing',
      'Starting preparation',
      'cand-1'
    );
    recordTest(
      'Lifecycle Transitions',
      'Transition interested -> preparing',
      prepApp.status === 'preparing' && !prepApp.dateClosed,
      `Status: ${prepApp.status}`
    );

    // Transition preparing -> rejected (closed)
    const rejectedApp = await prismaRepo.updateApplicationStatus(
      createdApp.id,
      'rejected',
      'Company filled role',
      'cand-1'
    );
    recordTest(
      'Lifecycle Transitions',
      'Closing status sets dateClosed',
      rejectedApp.status === 'rejected' && Boolean(rejectedApp.dateClosed),
      `dateClosed: ${rejectedApp.dateClosed}`
    );

    // Reopen rejected -> preparing (clears dateClosed and appends reopened event)
    const reopenedApp = await prismaRepo.updateApplicationStatus(
      createdApp.id,
      'preparing',
      'Reopening application for new department opening',
      'cand-1'
    );
    recordTest(
      'Reopen Behavior',
      'Reopening clears dateClosed',
      reopenedApp.status === 'preparing' && !reopenedApp.dateClosed,
      `dateClosed is cleared: ${!reopenedApp.dateClosed}`
    );

    const appEvents = await prismaRepo.getApplicationEvents(createdApp.id, 'cand-1');
    const hasReopenedEvent = appEvents.some((e) => e.type === 'reopened');
    recordTest(
      'Reopen Behavior',
      'Reopening appends "reopened" ApplicationEvent to history',
      hasReopenedEvent,
      `Total events: ${appEvents.length}, hasReopenedEvent: ${hasReopenedEvent}`
    );

    // -------------------------------------------------------------------------
    // GROUP 3: Append-Only Immutable Event Ledger
    // -------------------------------------------------------------------------
    console.log('\n📜 3. Testing Append-Only Application Events...');
    const manualEvent = await prismaRepo.recordApplicationEvent(
      {
        applicationId: createdApp.id,
        jobId: testJob.id,
        type: 'note_added',
        title: 'Recruiter Follow-up Note',
        description: 'Candidate followed up on LinkedIn',
        isAutomated: false
      },
      'cand-1'
    );
    recordTest(
      'Append-Only Events',
      'Record new ApplicationEvent',
      Boolean(manualEvent.id && manualEvent.timestamp),
      `Event ID: ${manualEvent.id}`
    );

    const eventsAfter = await prismaRepo.getApplicationEvents(createdApp.id, 'cand-1');
    recordTest(
      'Append-Only Events',
      'Events retrieved in descending chronological order',
      eventsAfter.length >= 3 && new Date(eventsAfter[0].timestamp).getTime() >= new Date(eventsAfter[1].timestamp).getTime(),
      `Top event: ${eventsAfter[0].title}`
    );

    // -------------------------------------------------------------------------
    // GROUP 4: Atomic Application Confirmation Transaction & Immutability
    // -------------------------------------------------------------------------
    console.log('\n🔒 4. Testing Atomic Application Confirmation Transaction...');
    // Create new application attached to a tailored resume
    const tailoredResume = await prisma.resumeVersion.findFirst({
      where: { candidateId: 'cand-1', approvalState: 'draft' }
    });
    const resumeToUse = tailoredResume || (await prisma.resumeVersion.findFirst({ where: { candidateId: 'cand-1' } }));
    if (!resumeToUse) throw new Error('No candidate resume version found for test');

    const unappliedApp = await prismaRepo.createApplication(
      testJob.id,
      'preparing',
      { allowDuplicate: true },
      'cand-1'
    );
    await prismaRepo.updateApplicationPreparation(
      unappliedApp.id,
      {
        tailoredResumeVersionId: resumeToUse.id,
        selectedTemplateId: 'modern-v1',
        selectedTemplateVersion: '1.0'
      },
      'cand-1'
    );

    const confirmedApp = await prismaRepo.confirmApplicationSubmission(
      {
        applicationId: unappliedApp.id,
        note: 'Submitted application via company career portal with tailored resume',
        templateId: 'modern-v1',
        templateVersion: '1.0'
      },
      'cand-1'
    );

    recordTest(
      'Confirmation Transaction',
      'Application status transitions to applied and dateApplied is set',
      confirmedApp.status === 'applied' && Boolean(confirmedApp.dateApplied),
      `dateApplied: ${confirmedApp.dateApplied}`
    );

    recordTest(
      'Confirmation Transaction',
      'Structured resumeSnapshot JSON is frozen',
      Boolean(confirmedApp.resumeSnapshot && confirmedApp.resumeSnapshot.identity?.fullName && confirmedApp.resumeSnapshot.summary),
      `Snapshot candidate: ${confirmedApp.resumeSnapshot?.identity?.fullName}`
    );

    recordTest(
      'Confirmation Transaction',
      'matchScoreAtApplication is frozen',
      confirmedApp.matchScoreAtApplication !== undefined,
      `Frozen match score: ${confirmedApp.matchScoreAtApplication}%`
    );

    // Verify referenced resume is locked
    const lockedResume = await prisma.resumeVersion.findUnique({
      where: { id: resumeToUse.id }
    });
    recordTest(
      'Resume Version Locking',
      'Referenced ResumeVersion is locked and approved upon confirmation',
      lockedResume?.isLocked === true && lockedResume?.approvalState === 'approved',
      `isLocked: ${lockedResume?.isLocked}, approvalState: ${lockedResume?.approvalState}`
    );

    // Verify confirmation event was created in transaction
    const confirmationEvents = await prismaRepo.getApplicationEvents(unappliedApp.id, 'cand-1');
    const confirmEvent = confirmationEvents.find((e) => e.type === 'applied_confirmed');
    recordTest(
      'Confirmation Transaction',
      'applied_confirmed event persisted in atomic transaction',
      Boolean(confirmEvent),
      `Event: ${confirmEvent?.title}`
    );

    // -------------------------------------------------------------------------
    // GROUP 5: Historical Resume Integrity
    // -------------------------------------------------------------------------
    console.log('\n🛡️ 5. Testing Historical Resume Integrity...');
    // Attempt to mutate template/resume on an applied application via updateApplicationPreparation
    const updateAttempt = await prismaRepo.updateApplicationPreparation(
      unappliedApp.id,
      {
        selectedTemplateId: 'compact-v1',
        selectedTemplateVersion: '9.9',
        coverLetter: 'Updated cover letter after applying'
      },
      'cand-1'
    );

    recordTest(
      'Historical Integrity',
      'Attempt to alter selectedTemplateId on applied application is safely ignored',
      updateAttempt.selectedTemplateId === 'modern-v1',
      `Preserved templateId: ${updateAttempt.selectedTemplateId}`
    );

    recordTest(
      'Historical Integrity',
      'resumeSnapshot remains immutable after confirmation',
      Boolean(updateAttempt.resumeSnapshot && updateAttempt.resumeSnapshot.identity?.fullName === confirmedApp.resumeSnapshot?.identity?.fullName),
      `Snapshot intact: ${Boolean(updateAttempt.resumeSnapshot)}`
    );

    // -------------------------------------------------------------------------
    // GROUP 6: Strict Clarification #2 — No Arbitrary Resume Fallback
    // -------------------------------------------------------------------------
    console.log('\n🛑 6. Testing Clarification #2 (No Arbitrary Resume Fallback)...');
    // Create application for isolated candidate without any resume
    const isolatedCand = await prisma.candidate.create({
      data: {
        id: 'cand-no-resume',
        clerkUserId: 'user-no-resume',
        email: 'no-resume@example.com',
        profile: {
          create: {
            name: 'No Resume User',
            location: 'Remote',
            professionalSummary: 'New user without resumes'
          }
        }
      }
    });

    const appNoResume = await prismaRepo.createApplication(
      testJob.id,
      'preparing',
      { allowDuplicate: true },
      isolatedCand.id
    );

    let failedAsExpected = false;
    try {
      await prismaRepo.confirmApplicationSubmission(
        { applicationId: appNoResume.id, note: 'Trying to confirm without resume' },
        isolatedCand.id
      );
    } catch (err: unknown) {
      failedAsExpected = true;
      console.log(`   Captured expected rejection: ${(err as Error).message}`);
    }

    recordTest(
      'Clarification #2',
      'Application confirmation fails if no valid resume source exists (no silent arbitrary fallback)',
      failedAsExpected,
      'Failed cleanly as required'
    );

    // Clean up temporary candidate
    await prisma.applicationEvent.deleteMany({ where: { candidateId: isolatedCand.id } });
    await prisma.application.deleteMany({ where: { candidateId: isolatedCand.id } });
    await prisma.candidateProfile.deleteMany({ where: { candidateId: isolatedCand.id } });
    await prisma.candidate.delete({ where: { id: isolatedCand.id } });

    // -------------------------------------------------------------------------
    // GROUP 7: Optimistic Concurrency Control
    // -------------------------------------------------------------------------
    console.log('\n⚡ 7. Testing Optimistic Concurrency Control...');
    const appForConcurrency = await prismaRepo.getApplicationById(createdApp.id, 'cand-1');
    const currentVersion = appForConcurrency?.version || 1;

    let concurrencyFailed = false;
    try {
      // Stale update: expectedVersion = currentVersion - 1
      await prismaRepo.updateApplicationNotes(
        createdApp.id,
        'Stale update attempt',
        'cand-1',
        currentVersion - 1
      );
    } catch (err: unknown) {
      if (err instanceof ConcurrencyError) {
        concurrencyFailed = true;
      }
    }
    recordTest(
      'Optimistic Concurrency',
      'Stale update with incorrect expectedVersion throws ConcurrencyError',
      concurrencyFailed,
      `Expected version ${currentVersion - 1} vs DB version ${currentVersion}`
    );

    // Valid update with correct expectedVersion
    const validUpdate = await prismaRepo.updateApplicationNotes(
      createdApp.id,
      'Fresh update with correct version',
      'cand-1',
      currentVersion
    );
    recordTest(
      'Optimistic Concurrency',
      'Update with correct expectedVersion succeeds and increments version',
      (validUpdate.version || 0) === currentVersion + 1,
      `New version: ${validUpdate.version}`
    );

    // -------------------------------------------------------------------------
    // GROUP 8: Duplicate Applications (No Unique Constraint)
    // -------------------------------------------------------------------------
    console.log('\n👯 8. Testing Duplicate Applications Support...');
    const dup1 = await prismaRepo.createApplication(testJob.id, 'interested', { allowDuplicate: true }, 'cand-1');
    const dup2 = await prismaRepo.createApplication(testJob.id, 'interested', { allowDuplicate: true }, 'cand-1');
    recordTest(
      'Duplicate Applications',
      'Multiple applications for same (candidateId, jobId) succeed without DB constraint violation',
      dup1.id !== dup2.id && dup1.jobId === dup2.jobId,
      `App1 ID: ${dup1.id}, App2 ID: ${dup2.id}`
    );

    // -------------------------------------------------------------------------
    // GROUP 9: Interview Stages Persistence
    // -------------------------------------------------------------------------
    console.log('\n🎤 9. Testing Interview Stages Persistence...');
    const appWithInterview = await prismaRepo.addInterviewStage(
      createdApp.id,
      {
        stageName: 'Technical Screen',
        scheduledDate: new Date('2026-09-20T10:00:00Z').toISOString(),
        interviewerNames: ['Jane Doe (Lead Eng)', 'John Smith (Staff Eng)'],
        location: 'Zoom',
        notes: 'Coding and system architecture discussion',
        status: 'scheduled'
      },
      'cand-1'
    );

    const addedStage = appWithInterview.interviewStages?.find((s) => s.stageName === 'Technical Screen');
    recordTest(
      'Interview Tracking',
      'Add interview stage and persist details',
      Boolean(addedStage && addedStage.interviewerNames?.length === 2),
      `Stage ID: ${addedStage?.id}, Interviewers: ${addedStage?.interviewerNames?.join(', ')}`
    );

    if (addedStage) {
      const updatedAppWithInterview = await prismaRepo.updateInterviewStage(
        createdApp.id,
        {
          ...addedStage,
          status: 'completed',
          outcome: 'passed',
          feedback: 'Strong problem solving and algorithm communication'
        },
        'cand-1'
      );
      const stageUpdated = updatedAppWithInterview.interviewStages?.find((s) => s.id === addedStage.id);
      recordTest(
        'Interview Tracking',
        'Update interview stage status and outcome',
        stageUpdated?.status === 'completed' && stageUpdated?.outcome === 'passed',
        `Outcome: ${stageUpdated?.outcome}, Status: ${stageUpdated?.status}`
      );
    }

    // -------------------------------------------------------------------------
    // GROUP 10: Application Contacts Persistence
    // -------------------------------------------------------------------------
    console.log('\n👤 10. Testing Application Contacts Persistence...');
    const appWithContact = await prismaRepo.addApplicationContact(
      createdApp.id,
      {
        name: 'Sarah Connor',
        role: 'Technical Recruiter',
        email: 'sarah@example.com',
        phone: '+1-555-0199',
        notes: 'Primary recruiting coordinator'
      },
      'cand-1'
    );

    const addedContact = appWithContact.contacts?.find((c) => c.name === 'Sarah Connor');
    recordTest(
      'Application Contacts',
      'Add application contact and persist details',
      Boolean(addedContact && addedContact.email === 'sarah@example.com'),
      `Contact ID: ${addedContact?.id}, Role: ${addedContact?.role}`
    );

    if (addedContact) {
      const appWithUpdatedContact = await prismaRepo.updateApplicationContact(
        createdApp.id,
        addedContact.id,
        { notes: 'Scheduled round 2 on Monday' },
        'cand-1'
      );
      const contactUpdated = appWithUpdatedContact.contacts?.find((c) => c.id === addedContact.id);
      recordTest(
        'Application Contacts',
        'Update application contact notes',
        contactUpdated?.notes === 'Scheduled round 2 on Monday',
        `Notes: ${contactUpdated?.notes}`
      );
    }

    // -------------------------------------------------------------------------
    // GROUP 11: Follow-Up History & Active State
    // -------------------------------------------------------------------------
    console.log('\n⏰ 11. Testing Follow-up History...');
    const followUpApp = await prismaRepo.updateApplicationFollowUp(
      createdApp.id,
      {
        followUpDate: '2026-09-25',
        followUpStatus: 'snoozed',
        followUpNote: 'Check in with recruiter after hiring manager sync'
      },
      'cand-1'
    );

    recordTest(
      'Follow-Up History',
      'Update active follow-up state',
      followUpApp.followUpStatus === 'snoozed' && followUpApp.followUpDate === '2026-09-25',
      `Status: ${followUpApp.followUpStatus}, Date: ${followUpApp.followUpDate}`
    );

    const followUpEvents = await prismaRepo.getApplicationEvents(createdApp.id, 'cand-1');
    const snoozedEvent = followUpEvents.find((e) => e.type === 'follow_up_snoozed');
    recordTest(
      'Follow-Up History',
      'Snoozed follow-up appends historical event',
      Boolean(snoozedEvent),
      `Event Title: ${snoozedEvent?.title}`
    );

    // -------------------------------------------------------------------------
    // GROUP 12: Archive Semantics
    // -------------------------------------------------------------------------
    console.log('\n🗄️ 12. Testing Archive Semantics...');
    const archivedApp = await prismaRepo.updateApplicationArchiveStatus(createdApp.id, true, 'cand-1');
    recordTest(
      'Archive Semantics',
      'Archive application sets isArchived to true',
      archivedApp.isArchived === true,
      `isArchived: ${archivedApp.isArchived}`
    );

    const defaultList = await prismaRepo.getApplications({}, 'cand-1');
    const isExcludedByDefault = !defaultList.some((a) => a.id === createdApp.id);
    recordTest(
      'Archive Semantics',
      'Default applications list excludes archived applications',
      isExcludedByDefault,
      `Excluded from active pipeline view: ${isExcludedByDefault}`
    );

    const includeArchivedList = await prismaRepo.getApplications({ includeArchived: true }, 'cand-1');
    const isIncludedWithFilter = includeArchivedList.some((a) => a.id === createdApp.id);
    recordTest(
      'Archive Semantics',
      'List with includeArchived: true includes archived application',
      isIncludedWithFilter,
      `Included when requested: ${isIncludedWithFilter}`
    );

    // Unarchive
    const unarchivedApp = await prismaRepo.updateApplicationArchiveStatus(createdApp.id, false, 'cand-1');
    recordTest(
      'Archive Semantics',
      'Unarchive application restores isArchived to false',
      unarchivedApp.isArchived === false,
      `isArchived: ${unarchivedApp.isArchived}`
    );

    // -------------------------------------------------------------------------
    // GROUP 13: Strict Candidate Isolation
    // -------------------------------------------------------------------------
    console.log('\n🔒 13. Testing Strict Candidate Isolation...');
    // Create Alice and Bob
    const alice = await prisma.candidate.create({
      data: {
        id: 'cand-iso-a',
        clerkUserId: 'user-iso-a',
        email: 'alice@example.com',
        profile: { create: { name: 'Alice Candidate', location: 'SF', professionalSummary: 'Alice summary' } }
      }
    });

    const bob = await prisma.candidate.create({
      data: {
        id: 'cand-iso-b',
        clerkUserId: 'user-iso-b',
        email: 'bob@example.com',
        profile: { create: { name: 'Bob Candidate', location: 'NY', professionalSummary: 'Bob summary' } }
      }
    });

    const aliceApp = await prismaRepo.createApplication(testJob.id, 'preparing', { allowDuplicate: true }, alice.id);
    await prismaRepo.addApplicationContact(
      aliceApp.id,
      { name: 'Alice Contact', role: 'Recruiter', email: 'contact@alice.com' },
      alice.id
    );

    // Bob tries to read Alice's application
    const bobReadAttempt = await prismaRepo.getApplicationById(aliceApp.id, bob.id);
    recordTest(
      'Candidate Isolation',
      'Candidate B cannot read Candidate A application detail (returns null)',
      bobReadAttempt === null,
      `Result: ${bobReadAttempt}`
    );

    // Bob tries to list applications
    const bobList = await prismaRepo.getApplications({ includeArchived: true }, bob.id);
    const hasAliceApp = bobList.some((a) => a.id === aliceApp.id);
    recordTest(
      'Candidate Isolation',
      'Candidate B list does not include Candidate A applications',
      !hasAliceApp,
      `Bob application count: ${bobList.length}`
    );

    // Bob tries to update Alice's application status
    let bobStatusTamperBlocked = false;
    try {
      await prismaRepo.updateApplicationStatus(aliceApp.id, 'offer', 'Tamper attempt', bob.id);
    } catch {
      bobStatusTamperBlocked = true;
    }
    recordTest(
      'Candidate Isolation',
      'Candidate B cannot mutate Candidate A application status',
      bobStatusTamperBlocked,
      'Tamper attempt threw error'
    );

    // Bob tries to read Alice's events
    const bobEvents = await prismaRepo.getApplicationEvents(aliceApp.id, bob.id);
    recordTest(
      'Candidate Isolation',
      'Candidate B cannot read Candidate A application events (returns empty)',
      bobEvents.length === 0,
      `Events count: ${bobEvents.length}`
    );

    // -------------------------------------------------------------------------
    // GROUP 14: Transaction Rollback Verification
    // -------------------------------------------------------------------------
    console.log('\n💥 14. Testing Transaction Rollback on Failure...');
    const rollbackCand = await prisma.candidate.create({
      data: {
        id: 'cand-rollback-test',
        clerkUserId: 'user-rollback',
        email: 'rollback@example.com',
        profile: { create: { name: 'Rollback Tester', location: 'SF', professionalSummary: 'Testing rollback' } }
      }
    });

    const rollbackApp = await prismaRepo.createApplication(testJob.id, 'preparing', { allowDuplicate: true }, rollbackCand.id);
    const preRollbackVersion = rollbackApp.version || 1;

    let rollbackTriggered = false;
    try {
      // Pass invalid templateId that triggers error or invalid payload
      await prismaRepo.confirmApplicationSubmission(
        {
          applicationId: rollbackApp.id,
          note: 'Confirm with non-existent resume'
        },
        rollbackCand.id
      );
    } catch (err: unknown) {
      rollbackTriggered = true;
      console.log(`   Captured expected transaction failure: ${(err as Error).message}`);
    }

    // Verify application was NOT modified (rolled back cleanly)
    const postRollbackApp = await prisma.application.findUnique({ where: { id: rollbackApp.id } });
    recordTest(
      'Transaction Rollback',
      'Application status remained preparing after failed confirmation',
      postRollbackApp?.status === 'preparing' && postRollbackApp?.dateApplied === null,
      `Status: ${postRollbackApp?.status}, dateApplied: ${postRollbackApp?.dateApplied}`
    );

    recordTest(
      'Transaction Rollback',
      'No partial application events persisted during failed transaction',
      (await prisma.applicationEvent.count({ where: { applicationId: rollbackApp.id } })) === 0,
      'Event count is 0'
    );

    // -------------------------------------------------------------------------
    // GROUP 15: InMemory vs Prisma Parity (Clarification #1: Domain Parity)
    // -------------------------------------------------------------------------
    console.log('\n⚖️ 15. Testing InMemory vs Prisma Domain Parity...');
    // Create equivalent applications in both repositories
    const inMemCreated = await inMemoryRepo.createApplication('job-1', 'preparing');
    const prismaCreated = await prismaRepo.createApplication('job-1', 'preparing', { allowDuplicate: true }, 'cand-1');

    recordTest(
      'Repository Parity',
      'Initial status parity',
      inMemCreated.status === prismaCreated.status && inMemCreated.status === 'preparing',
      `Both status: ${inMemCreated.status}`
    );

    // Transition both to applied
    const inMemUpdated = await inMemoryRepo.updateApplicationStatus(inMemCreated.id, 'applied', 'Applied note');
    const prismaUpdated = await prismaRepo.updateApplicationStatus(prismaCreated.id, 'applied', 'Applied note', 'cand-1');

    recordTest(
      'Repository Parity',
      'Status transition and dateApplied parity',
      inMemUpdated.status === prismaUpdated.status && Boolean(inMemUpdated.dateApplied) && Boolean(prismaUpdated.dateApplied),
      `Both applied with dateApplied populated`
    );

    // Transition both to rejected
    const inMemClosed = await inMemoryRepo.updateApplicationStatus(inMemCreated.id, 'rejected', 'Closed note');
    const prismaClosed = await prismaRepo.updateApplicationStatus(prismaCreated.id, 'rejected', 'Closed note', 'cand-1');

    recordTest(
      'Repository Parity',
      'Closing status dateClosed parity',
      Boolean(inMemClosed.dateClosed) && Boolean(prismaClosed.dateClosed),
      `Both have dateClosed populated`
    );

    // Reopen both
    const inMemReopened = await inMemoryRepo.updateApplicationStatus(inMemCreated.id, 'preparing', 'Reopen note');
    const prismaReopened = await prismaRepo.updateApplicationStatus(prismaCreated.id, 'preparing', 'Reopen note', 'cand-1');

    recordTest(
      'Repository Parity',
      'Reopen clears dateClosed parity',
      inMemReopened.dateClosed === undefined && prismaReopened.dateClosed === undefined,
      `Both have dateClosed cleared`
    );

    // -------------------------------------------------------------------------
    // GROUP 16: Next Actions & Analytics Regression
    // -------------------------------------------------------------------------
    console.log('\n📊 16. Testing Next Actions & Search Analytics Regression...');
    const candApps = await prismaRepo.getApplications({ includeArchived: true }, 'cand-1');
    const candEvents = await prismaRepo.getApplicationEvents(undefined, 'cand-1');

    const nextActions = NextActionsService.computeNextActions(candApps, candEvents);
    recordTest(
      'Next Actions Regression',
      'NextActionsService derives actions over persisted applications',
      Array.isArray(nextActions) && nextActions.length > 0,
      `Derived ${nextActions.length} next actions`
    );

    const analytics = SearchAnalyticsService.computeAnalytics(candApps, candEvents);
    recordTest(
      'Analytics Regression',
      'SearchAnalyticsService computes funnel metrics over persisted applications',
      Boolean(analytics && analytics.funnel && analytics.funnel.totalDiscovered > 0),
      `Discovered: ${analytics.funnel.totalDiscovered}, Applied: ${analytics.funnel.totalApplied}`
    );

    // Clean up temporary isolation records
    await cleanupIsolationFixtures();

  } catch (error) {
    console.error('Fatal error during Phase 6D verification:', error);
    recordTest('Verification Suite', 'Execution Error', false, String(error));
  } finally {
    await prisma.$disconnect();
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log('\n======================================================');
  console.log(`Phase 6D Verification Result: ${passed}/${total} Passed`);
  if (failed > 0) {
    console.log(`❌ FAILED: ${failed} tests failed.`);
    process.exit(1);
  } else {
    console.log('🎉 PHASE 6D COMPLETE & VERIFIED: All persistence checkpoints passed.');
  }
  console.log('======================================================\n');
}

verifyPhase6D();
