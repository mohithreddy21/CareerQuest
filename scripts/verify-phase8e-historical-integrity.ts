/* eslint-disable no-console */
import { careerRepository } from '../src/services/career-repository';
import { setCareerRepositoryMode } from '../src/services/repository-provider';
import {
  getPreparationMaterials,
  updateCoverLetterDraft,
  updateQuestionAnswer,
  confirmApplicationSubmission
} from '../src/features/preparation/api/service';
import { getApplicationHistoricalPackage } from '../src/features/applications/api/service';
import { LockedResumeVersionError, ConcurrencyError } from '../src/types/errors';
import { CandidateProfile, Job, ResumeVersion } from '../src/types/domain';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function runPhase8EVerification() {
  console.log('================================================================');
  console.log('🏛️  CAREERQUEST PHASE 8E: HISTORICAL APPLICATION INTEGRITY');
  console.log('================================================================\n');

  setCareerRepositoryMode('in-memory');

  const candidateId = 'cand-phase8e-maya';
  const attackerId = 'cand-phase8e-attacker';

  // Setup Candidate Profile
  const candidate: CandidateProfile = {
    id: candidateId,
    userId: `user-${candidateId}`,
    email: 'maya.lin@example.com',
    location: 'Seattle, WA',
    name: 'Maya Lin',
    targetRoles: ['Principal Platform Architect'],
    professionalSummary: 'Architect with 12+ years building resilient cloud foundations.',
    skills: {
      technical: ['Go', 'Rust', 'Kubernetes', 'Distributed Systems'],
      tools: ['Terraform', 'Prometheus', 'Envoy'],
      soft: ['Technical Leadership', 'Strategic Planning'],
      other: []
    },
    experience: [
      {
        id: 'exp-phase8e-1',
        employer: 'CloudNative Corp',
        role: 'Lead Architect',
        startDate: '2020-01-01',
        responsibilities: [
          'Led architecture for multi-region Kubernetes platform serving 50M requests/day.'
        ],
        achievements: [],
        isCurrent: true
      }
    ],
    education: [
      {
        id: 'edu-phase8e-1',
        institution: 'University of Washington',
        degree: 'BS Computer Science',
        fieldOfStudy: 'Computer Science',
        startDate: '2012',
        endDate: '2016'
      }
    ],
    projects: [],
    certifications: [],
    preferences: {
      targetRoles: ['Principal Platform Architect'],
      preferredLocations: ['Seattle, WA'],
      workArrangements: ['hybrid']
    },
    masterResumeId: 'res-master'
  };
  await careerRepository.updateCandidateProfile(candidate, candidateId);

  // Setup Job Posting
  const originalJob: Job = {
    id: 'job-phase8e-cloud-lead',
    title: 'Principal Platform Architect',
    company: 'HyperScale Systems',
    location: 'Seattle, WA',
    workArrangement: 'hybrid',
    description: 'Looking for a Principal Platform Architect to lead next-gen edge infrastructure.',
    responsibilities: [
      'Design fault-tolerant edge execution clusters',
      'Mentor senior engineering leads',
      'Spearhead multi-region reliability initiatives'
    ],
    requiredSkills: ['Kubernetes', 'Go', 'Distributed Systems'],
    preferredSkills: ['Rust', 'Envoy'],
    originalUrl: 'https://careers.hyperscale.internal/jobs/platform-arch',
    source: 'internal_portal',
    normalizedAt: new Date().toISOString(),
    jobStatus: 'active'
  };
  await careerRepository.addJob(originalJob, candidateId);

  // Setup Application
  const application = await careerRepository.createApplication(
    originalJob.id,
    'discovered',
    undefined,
    candidateId
  );

  // Setup Tailored Resume
  const tailoredResume: ResumeVersion = {
    id: 'resume-phase8e-hyperscale',
    candidateId,
    jobId: originalJob.id,
    targetCompany: 'HyperScale Systems',
    title: 'Tailored for HyperScale Systems',
    targetRole: 'Principal Platform Architect',
    summary: 'Tailored summary targeting edge execution clusters at HyperScale Systems.',
    skills: {
      technical: ['Go', 'Kubernetes', 'Distributed Systems', 'Rust'],
      tools: [],
      soft: [],
      other: []
    },
    experience: [
      {
        id: 'exp-phase8e-1',
        employer: 'CloudNative Corp',
        role: 'Lead Architect',
        startDate: '2020-01-01',
        responsibilities: [
          'Led architecture for multi-region Kubernetes platform with Go and Envoy.'
        ],
        achievements: [],
        isCurrent: true
      }
    ],
    education: candidate.education,
    projects: [],
    certifications: [],
    changes: [],
    approvalState: 'draft',
    isLocked: false,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await careerRepository.saveResumeVersion(tailoredResume, candidateId);

  // Link Tailored Resume and Template to Application
  await careerRepository.updateApplicationPreparation(
    application.id,
    {
      tailoredResumeVersionId: tailoredResume.id,
      selectedTemplateId: 'modern-v1',
      selectedTemplateVersion: '1.0'
    },
    candidateId
  );

  // Save initial match
  await careerRepository.saveJobMatch(
    {
      id: `match-${application.jobId}`,
      candidateId,
      jobId: application.jobId,
      score: 92,
      recommendation: 'strong',
      headline: 'Outstanding Match',
      reasoning: 'Matches architectural and Kubernetes requirements.',
      strongMatches: [],
      partialMatches: [],
      missingRequirements: [],
      supportingCandidateEvidence: []
    },
    candidateId
  );
  const initialPrep = await getPreparationMaterials(application.id, candidateId);

  await updateCoverLetterDraft(
    {
      applicationId: application.id,
      coverLetter: {
        ...initialPrep.coverLetter,
        body: 'Dear HyperScale Systems Team,\nI am thrilled to apply for the Principal Platform Architect position.'
      }
    },
    candidateId
  );

  const prepMaterials = await getPreparationMaterials(application.id, candidateId);
  const firstQuestion = prepMaterials.questions[0];
  await updateQuestionAnswer(
    {
      applicationId: application.id,
      question: {
        ...firstQuestion,
        candidateEditedAnswer:
          'I spearheaded multi-region Kubernetes deployments scaling to millions of transactions with zero downtime.'
      }
    },
    candidateId
  );

  // =================================================================
  // TC-01 to TC-06: Application Confirmation Freezes Package
  // =================================================================
  console.log('\n--- Section 1: Application Confirmation Freeze ---');

  const confirmedApp = await confirmApplicationSubmission(
    {
      applicationId: application.id,
      note: 'Submitted externally via HyperScale careers portal',
      templateId: 'modern-v1',
      templateVersion: '1.0'
    },
    candidateId
  );

  // TC-01: Application confirmation freezes resumeSnapshot
  assert(
    Boolean(confirmedApp.resumeSnapshot) &&
      (confirmedApp.resumeSnapshot as any)?.identity?.fullName === candidate.name &&
      (confirmedApp.resumeSnapshot as any)?.summary === tailoredResume.summary,
    'TC-01: Application confirmation freezes resumeSnapshot'
  );

  // TC-02: Application confirmation freezes applicationAnswers
  assert(
    Array.isArray(confirmedApp.applicationAnswers) &&
      confirmedApp.applicationAnswers.length > 0 &&
      confirmedApp.applicationAnswers.some((ans: any) =>
        ans.answer.includes('multi-region Kubernetes')
      ),
    'TC-02: Application confirmation freezes applicationAnswers'
  );

  // TC-03: Application confirmation freezes matchScoreAtApplication
  assert(
    typeof confirmedApp.matchScoreAtApplication === 'number' &&
      confirmedApp.matchScoreAtApplication > 0,
    'TC-03: Application confirmation freezes matchScoreAtApplication'
  );

  // TC-04: Application confirmation freezes selectedTemplateId
  assert(
    confirmedApp.selectedTemplateId === 'modern-v1',
    'TC-04: Application confirmation freezes selectedTemplateId'
  );

  // TC-05: Application confirmation freezes selectedTemplateVersion
  assert(
    confirmedApp.selectedTemplateVersion === '1.0',
    'TC-05: Application confirmation freezes selectedTemplateVersion'
  );

  // Retrieve Historical Package
  const historicalPkg = await getApplicationHistoricalPackage(application.id, candidateId);

  // TC-06: Application confirmation captures historical job snapshot
  assert(
    Boolean(historicalPkg?.jobSnapshot) &&
      historicalPkg?.jobSnapshot?.title === originalJob.title &&
      historicalPkg?.jobSnapshot?.company === originalJob.company &&
      historicalPkg?.jobSnapshot?.location === originalJob.location &&
      historicalPkg?.jobSnapshot?.workArrangement === originalJob.workArrangement &&
      historicalPkg?.jobSnapshot?.sourceUrl === originalJob.originalUrl &&
      historicalPkg?.jobSnapshot?.responsibilities?.length === 3 &&
      historicalPkg?.isHistoricalJobSnapshot === true,
    'TC-06: Application confirmation captures historical job snapshot'
  );

  // =================================================================
  // TC-07 & TC-08: Knowledge Bank & Master Resume Isolation
  // =================================================================
  console.log('\n--- Section 2: Knowledge Bank & Master Resume Changes Do Not Affect Snapshot ---');

  // Mutate Candidate Profile (Knowledge Bank source facts)
  await careerRepository.updateCandidateProfile(
    {
      ...candidate,
      name: 'Maya Lin, Ph.D.',
      targetRoles: ['Chief Technology Officer'],
      professionalSummary: 'RADICAL OVERHAUL: Candidate is now focused solely on C-suite advisory work.'
    },
    candidateId
  );

  // TC-07: Knowledge Bank changes do not affect resumeSnapshot
  const pkgAfterProfileEdit = await getApplicationHistoricalPackage(application.id, candidateId);
  assert(
    pkgAfterProfileEdit?.resumeSnapshot?.identity?.fullName === 'Maya Lin' &&
      pkgAfterProfileEdit?.resumeSnapshot?.summary === tailoredResume.summary,
    'TC-07: Knowledge Bank changes do not affect resumeSnapshot'
  );

  // Mutate Master Resume
  const master = await careerRepository.getMasterResume(candidateId);
  if (master) {
    await careerRepository.saveResumeVersion(
      {
        ...master,
        summary: 'Completely new master resume summary for executive leadership.'
      },
      candidateId
    );
  }

  // TC-08: Master Resume changes do not affect resumeSnapshot
  const pkgAfterMasterEdit = await getApplicationHistoricalPackage(application.id, candidateId);
  assert(
    pkgAfterMasterEdit?.resumeSnapshot?.summary === tailoredResume.summary,
    'TC-08: Master Resume changes do not affect resumeSnapshot'
  );

  // =================================================================
  // TC-09: Locked ResumeVersion Write Barrier
  // =================================================================
  console.log('\n--- Section 3: Locked ResumeVersion Write Barrier ---');

  let lockedMutationFailed = false;
  let lockedErrorMessage = '';
  try {
    await careerRepository.saveResumeVersion(
      {
        ...tailoredResume,
        isLocked: true,
        summary: 'ILLEGAL OVERWRITE: Attempting to modify locked resume version.'
      },
      candidateId
    );
  } catch (err) {
    if (err instanceof LockedResumeVersionError) {
      lockedMutationFailed = true;
      lockedErrorMessage = err.message;
    }
  }

  assert(
    lockedMutationFailed && lockedErrorMessage === 'Cannot modify locked resume version.',
    'TC-09: Direct saveResumeVersion on locked version throws LockedResumeVersionError'
  );

  // =================================================================
  // TC-10 to TC-12: Post-Application Immutability
  // =================================================================
  console.log('\n--- Section 4: Materials Immutability After Submission ---');

  // TC-10: Cover letter cannot be modified after application
  let coverLetterBlocked = false;
  try {
    await updateCoverLetterDraft(
      {
        applicationId: application.id,
        coverLetter: {
          ...initialPrep.coverLetter,
          body: 'ILLEGAL OVERWRITE: Trying to change cover letter after confirmation.'
        }
      },
      candidateId
    );
  } catch (err: any) {
    if (err.message.includes('locked') || err.message.includes('applied') || err.message.includes('frozen')) {
      coverLetterBlocked = true;
    }
  }
  assert(coverLetterBlocked, 'TC-10: Cover letter cannot be modified after application');

  // TC-11: Application answers cannot be modified after application
  let answerBlocked = false;
  try {
    await updateQuestionAnswer(
      {
        applicationId: application.id,
        question: {
          ...firstQuestion,
          candidateEditedAnswer: 'ILLEGAL OVERWRITE: Trying to rewrite submitted question answer.'
        }
      },
      candidateId
    );
  } catch (err: any) {
    if (err.message.includes('locked') || err.message.includes('applied') || err.message.includes('frozen')) {
      answerBlocked = true;
    }
  }
  assert(answerBlocked, 'TC-11: Application answers cannot be modified after application');

  // TC-12: Template cannot be changed after application
  await careerRepository.updateApplicationPreparation(
    application.id,
    { selectedTemplateId: 'compact-v1' },
    candidateId
  );
  const appAfterTemplateAttempt = await careerRepository.getApplicationById(application.id, candidateId);
  const templateBlocked = appAfterTemplateAttempt?.selectedTemplateId === 'modern-v1';
  assert(templateBlocked, 'TC-12: Template cannot be changed after application');

  // =================================================================
  // TC-13 & TC-14: Live Job & Match Changes Isolation
  // =================================================================
  console.log('\n--- Section 5: Current Live Job Changes Do Not Alter Historical Snapshot ---');

  // Live Job is updated / re-scraped / modified in external system
  await careerRepository.updateJob(originalJob.id, {
    title: 'Senior DevOps Specialist (Downgraded)',
    company: 'HyperScale Systems [Acquired]',
    location: 'Remote, Europe Only',
    workArrangement: 'remote',
    description: 'Completely rewritten job posting after acquisition.',
    responsibilities: ['Maintain legacy build scripts'],
    requiredSkills: ['Bash'],
    preferredSkills: []
  });

  // TC-13: Current Job changes do not alter historical job snapshot
  const pkgAfterJobChange = await getApplicationHistoricalPackage(application.id, candidateId);
  assert(
    pkgAfterJobChange?.jobSnapshot?.title === 'Principal Platform Architect' &&
      pkgAfterJobChange?.jobSnapshot?.company === 'HyperScale Systems' &&
      pkgAfterJobChange?.jobSnapshot?.location === 'Seattle, WA' &&
      pkgAfterJobChange?.jobSnapshot?.workArrangement === 'hybrid' &&
      pkgAfterJobChange?.jobSnapshot?.responsibilities?.[0] === 'Design fault-tolerant edge execution clusters',
    'TC-13: Current Job changes do not alter historical job snapshot'
  );

  // Mutate JobMatch score in active system
  await careerRepository.saveJobMatch(
    {
      id: `match-${application.jobId}`,
      candidateId,
      jobId: application.jobId,
      score: 12, // dropped from original high match
      recommendation: 'low',
      headline: 'Low Match',
      reasoning: 'Drastic downgrade',
      strongMatches: [],
      partialMatches: [],
      missingRequirements: [],
      supportingCandidateEvidence: []
    },
    candidateId
  );

  // TC-14: Current JobMatch changes do not alter matchScoreAtApplication
  const pkgAfterMatchChange = await getApplicationHistoricalPackage(application.id, candidateId);
  assert(
    pkgAfterMatchChange?.matchScoreAtApplication === confirmedApp.matchScoreAtApplication &&
      pkgAfterMatchChange?.matchScoreAtApplication !== 12,
    'TC-14: Current JobMatch changes do not alter matchScoreAtApplication'
  );

  // =================================================================
  // TC-15 & TC-16: Idempotency & Optimistic Concurrency
  // =================================================================
  console.log('\n--- Section 6: Idempotency & Optimistic Concurrency ---');

  // TC-15: Repeated confirmation is idempotent
  const repeatedConfirm = await confirmApplicationSubmission(
    {
      applicationId: application.id,
      note: 'Second confirmation attempt'
    },
    candidateId
  );
  assert(
    repeatedConfirm.status === 'applied' &&
      repeatedConfirm.dateApplied === confirmedApp.dateApplied &&
      repeatedConfirm.selectedTemplateId === confirmedApp.selectedTemplateId,
    'TC-15: Repeated confirmation is idempotent'
  );

  // TC-16: Optimistic concurrency still works on mutable tracking operations
  let concurrencyConflict = false;
  try {
    // Current application version is >= 2, trying to pass expectedVersion = 1
    await careerRepository.updateApplicationStatus(
      application.id,
      'interview',
      'Moved to interview',
      candidateId,
      1 // stale version
    );
  } catch (err) {
    if (err instanceof ConcurrencyError) {
      concurrencyConflict = true;
    }
  }
  assert(concurrencyConflict, 'TC-16: Optimistic concurrency still works');

  // =================================================================
  // TC-17: Authorization & Cross-Candidate Security
  // =================================================================
  console.log('\n--- Section 7: Authorization & Cross-Candidate Isolation ---');

  // TC-17: Cross-candidate historical package access is rejected
  const crossAccess = await getApplicationHistoricalPackage(application.id, attackerId);
  assert(crossAccess === null, 'TC-17: Cross-candidate historical package access is rejected');

  // =================================================================
  // TC-18: Archived Application Retains Historical Package
  // =================================================================
  console.log('\n--- Section 8: Lifecycle & Archiving ---');

  // Candidate archives application
  await careerRepository.updateApplicationArchiveStatus(application.id, true, candidateId);

  const archivedPkg = await getApplicationHistoricalPackage(application.id, candidateId);
  assert(
    Boolean(archivedPkg) &&
      archivedPkg?.jobSnapshot?.title === 'Principal Platform Architect' &&
      archivedPkg?.resumeSnapshot?.identity?.targetRole === 'Principal Platform Architect',
    'TC-18: Archived application retains historical package'
  );

  // =================================================================
  // TC-19: Account Deletion Compatibility
  // =================================================================
  console.log('\n--- Section 9: Account Deletion Compliance ---');

  // Execute Phase 6F Account Deletion
  const deletionResult = await careerRepository.deleteCandidateAccountData(candidateId);
  assert(deletionResult.databaseDeleted === true, 'TC-19a: Account deletion executed successfully');

  // Verify historical application package is purged along with candidate data
  const postDeletionPkg = await getApplicationHistoricalPackage(application.id, candidateId);
  assert(
    postDeletionPkg === null,
    'TC-19: Account deletion still removes candidate-owned historical data'
  );

  // =================================================================
  // TC-20: Historical Package Uses Frozen Data Rather Than Mutable
  // =================================================================
  console.log('\n--- Section 10: Historical vs Mutable Data Integrity ---');

  // Setup second candidate & application to test fresh fallback vs snapshot presentation
  const candidate2: CandidateProfile = {
    ...candidate,
    id: 'cand-phase8e-second',
    userId: 'user-cand-phase8e-second',
    masterResumeId: 'resume-cand2-master'
  };
  await careerRepository.updateCandidateProfile(candidate2, candidate2.id);

  const resume2: ResumeVersion = {
    ...tailoredResume,
    id: 'resume-cand2-master',
    candidateId: candidate2.id,
    isLocked: false
  };
  await careerRepository.saveResumeVersion(resume2, candidate2.id);

  const job2: Job = {
    ...originalJob,
    id: 'job-phase8e-cand2',
    company: 'NextGen Cloud Labs',
    title: 'Principal Systems Architect'
  };
  await careerRepository.addJob(job2, candidate2.id);

  const app2 = await careerRepository.createApplication(
    job2.id,
    'discovered',
    undefined,
    candidate2.id
  );

  await careerRepository.updateApplicationPreparation(
    app2.id,
    { tailoredResumeVersionId: resume2.id },
    candidate2.id
  );

  // Before confirmation, historical package is null (not applied)
  const unsubmittedPkg = await getApplicationHistoricalPackage(app2.id, candidate2.id);
  assert(unsubmittedPkg === null, 'TC-20a: Unsubmitted application returns null historical package');

  // Confirm submission
  await confirmApplicationSubmission(
    {
      applicationId: app2.id,
      templateId: 'compact-v1',
      templateVersion: '1.0'
    },
    candidate2.id
  );

  // Mutate live job again to prove submittedPkg2 uses the frozen snapshot rather than mutable job
  await careerRepository.updateJob(job2.id, {
    company: 'NextGen Cloud Labs [Liquidated]'
  });

  const submittedPkg2 = await getApplicationHistoricalPackage(app2.id, candidate2.id);
  assert(
    submittedPkg2 !== null &&
      submittedPkg2.isHistoricalJobSnapshot === true &&
      submittedPkg2.selectedTemplateId === 'compact-v1' &&
      submittedPkg2.jobSnapshot?.company === 'NextGen Cloud Labs' &&
      submittedPkg2.currentJob?.company === 'NextGen Cloud Labs [Liquidated]',
    'TC-20: Historical package viewer uses frozen data rather than current mutable data'
  );

  // =================================================================
  // Summary
  // =================================================================
  console.log('\n================================================================');
  console.log(`Phase 8E Verification Results: ${passedTests} / ${totalTests} Passed`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('🎉 ALL PHASE 8E HISTORICAL INTEGRITY TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    console.error(`💥 ${totalTests - passedTests} tests failed.`);
    process.exit(1);
  }
}

runPhase8EVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
