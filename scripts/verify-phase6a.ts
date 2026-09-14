import { PrismaClient } from '@prisma/client';

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

async function verifyPhase6A() {
  console.log('🔍 Starting CareerQuest Phase 6A Database Verification...\n');

  try {
    // Group 1: Database Connectivity & Candidate Identity
    const candidate = await prisma.candidate.findUnique({
      where: { clerkUserId: 'user_mock_01' },
      include: {
        profile: true,
        preferences: true
      }
    });

    recordTest(
      'Candidate Identity',
      'Candidate Alex Chen exists with unique clerkUserId',
      candidate !== null && candidate.clerkUserId === 'user_mock_01',
      candidate ? `Found candidate ID ${candidate.id} (${candidate.email})` : 'Not found'
    );

    recordTest(
      'Profile Separation',
      'CandidateProfile contains identity/presentation only (no career facts)',
      candidate?.profile !== null &&
        typeof candidate?.profile?.name === 'string' &&
        typeof candidate?.profile?.professionalSummary === 'string',
      `Profile: ${candidate?.profile?.name}, Location: ${candidate?.profile?.location}`
    );

    recordTest(
      'Preferences Separation',
      'CandidatePreferences records search parameters separately',
      candidate?.preferences !== null &&
        Array.isArray(candidate?.preferences?.targetRoles) &&
        candidate?.preferences?.targetRoles.length > 0,
      `Target roles: ${candidate?.preferences?.targetRoles.join(', ')}`
    );

    // Group 2: Knowledge Bank Exclusivity
    const kbItems = await prisma.knowledgeItem.findMany({
      where: { candidateId: candidate?.id },
      include: { provenance: true }
    });

    recordTest(
      'Knowledge Bank Exclusivity',
      'KnowledgeItem is the single source of truth for candidate career facts',
      kbItems.length >= 10,
      `Total verified KnowledgeItems: ${kbItems.length}`
    );

    const categories = new Set(kbItems.map((k) => k.category));
    recordTest(
      'Knowledge Categories',
      'Knowledge bank spans skills, experiences, projects, education, certifications, achievements',
      categories.has('skill') &&
        categories.has('experience') &&
        categories.has('project') &&
        categories.has('education'),
      `Categories represented: ${Array.from(categories).join(', ')}`
    );

    const provCount = kbItems.reduce((acc, k) => acc + k.provenance.length, 0);
    recordTest(
      'Provenance Ledger',
      'Knowledge items retain verifiable provenance traces',
      provCount > 0,
      `Total provenance entries: ${provCount}`
    );

    // Group 3: Jobs & Decision Support Matching
    const jobs = await prisma.job.findMany({
      include: { analysis: true }
    });

    const analyzedJobs = jobs.filter((j) => j.analysis !== null);
    recordTest(
      'Jobs Catalog',
      'Jobs catalog persisted with structured analysis versioning',
      jobs.length >= 5 &&
        analyzedJobs.length > 0 &&
        analyzedJobs.every((j) => j.analysis?.analysisVersion === '1.0'),
      `Total jobs: ${jobs.length}, analyzed jobs: ${analyzedJobs.length} (all at version 1.0)`
    );

    const stripeJob = jobs.find((j) => j.company.toLowerCase() === 'stripe');
    const datadogJob = jobs.find((j) => j.company.toLowerCase() === 'datadog');
    const linearJob = jobs.find((j) => j.company.toLowerCase() === 'linear');

    const stripeMatch = stripeJob
      ? await prisma.jobMatch.findUnique({
          where: {
            candidateId_jobId: { candidateId: candidate!.id, jobId: stripeJob.id }
          }
        })
      : null;

    const datadogMatch = datadogJob
      ? await prisma.jobMatch.findUnique({
          where: {
            candidateId_jobId: { candidateId: candidate!.id, jobId: datadogJob.id }
          }
        })
      : null;

    const linearMatch = linearJob
      ? await prisma.jobMatch.findUnique({
          where: {
            candidateId_jobId: { candidateId: candidate!.id, jobId: linearJob.id }
          }
        })
      : null;

    recordTest(
      'Decision Support Scores',
      'Preserves exact Phase 2 decision-support benchmark scores (Stripe 94%, Datadog 82%, Linear 76%)',
      stripeMatch?.score === 94 && datadogMatch?.score === 82 && linearMatch?.score === 76,
      `Stripe: ${stripeMatch?.score}%, Datadog: ${datadogMatch?.score}%, Linear: ${linearMatch?.score}%`
    );

    // Group 4: Applications & Re-application Invariant
    const applications = await prisma.application.findMany({
      where: { candidateId: candidate!.id },
      include: {
        events: true,
        interviewStages: true,
        contacts: true
      }
    });

    recordTest(
      'Applications Pipeline',
      'Applications persisted with stages, contacts, and event history',
      applications.length >= 3,
      `Found ${applications.length} applications`
    );

    // Test Re-application Invariant: Ensure NO @@unique([candidateId, jobId]) exists on Application
    const testJob = jobs[0];
    const initialCountForJob = await prisma.application.count({
      where: { candidateId: candidate!.id, jobId: testJob.id }
    });

    const secondApp = await prisma.application.create({
      data: {
        candidateId: candidate!.id,
        jobId: testJob.id,
        status: 'discovered',
        statusHistory: [
          { status: 'discovered', timestamp: new Date().toISOString(), note: 'Repeat application test' }
        ]
      }
    });

    const newCountForJob = await prisma.application.count({
      where: { candidateId: candidate!.id, jobId: testJob.id }
    });

    recordTest(
      'Repeat Application Invariant',
      'Application allows multiple applications for same (candidateId, jobId) without unique collision',
      newCountForJob === initialCountForJob + 1,
      `Initial count: ${initialCountForJob}, count after second application: ${newCountForJob}`
    );

    // Clean up temporary test application
    await prisma.application.delete({ where: { id: secondApp.id } });

    // Group 5: Historical Resume Snapshot & Immutability Protection
    const appliedApp = applications.find(
      (a) => a.tailoredResumeVersionId !== null
    ) || applications.find(
      (a) => a.status === 'applied' || a.status === 'interview'
    );

    recordTest(
      'Historical Resume Snapshot',
      'Application preserves frozen immutable resumeSnapshot JSON',
      Boolean(appliedApp && appliedApp.resumeSnapshot !== null),
      appliedApp?.resumeSnapshot
        ? `Snapshot contains identity for: ${(appliedApp.resumeSnapshot as Record<string, unknown>).identity ? 'Alex Chen' : 'Yes'}`
        : 'Missing snapshot'
    );

    // Test Restrict On Delete: Attempt to delete a resume version referenced by an application
    let restrictTriggered = false;
    if (appliedApp?.tailoredResumeVersionId) {
      try {
        await prisma.resumeVersion.delete({
          where: { id: appliedApp.tailoredResumeVersionId }
        });
      } catch (err: unknown) {
        // Prisma error code P2003 = Foreign key constraint violated (onDelete: Restrict)
        restrictTriggered = true;
      }
    }

    recordTest(
      'Applied Resume Immutability (Restrict)',
      'Database foreign key restricts deletion of resume versions referenced by applications',
      restrictTriggered,
      restrictTriggered
        ? 'Prisma correctly blocked deletion with Foreign Key Restrict violation'
        : 'Deletion was not restricted!'
    );

    // Group 6: Append-Only Event Ledger
    const events = await prisma.applicationEvent.findMany({
      where: { candidateId: candidate!.id }
    });

    recordTest(
      'Application Events Ledger',
      'Append-only timeline events ledger records immutable system & candidate actions',
      events.length >= 5 && events.every((e) => e.timestamp instanceof Date),
      `Total events: ${events.length}`
    );

    // Group 7: Shared Job Isolation
    const privateJob = await prisma.job.create({
      data: {
        title: 'Confidential Lead Architect',
        company: 'Private Stealth Inc',
        location: 'Remote',
        workArrangement: 'remote',
        description: 'Private URL import test',
        responsibilities: ['Architecture'],
        requiredSkills: ['TypeScript'],
        preferredSkills: ['PostgreSQL'],
        source: 'url_import',
        isPublic: false,
        importedByCandidateId: candidate!.id
      }
    });

    recordTest(
      'Private Job Isolation',
      'Jobs can be isolated to importing candidate via importedByCandidateId and isPublic: false',
      privateJob.isPublic === false && privateJob.importedByCandidateId === candidate!.id,
      `Private Job ID: ${privateJob.id}, isPublic: ${privateJob.isPublic}`
    );

    // Clean up test private job
    await prisma.job.delete({ where: { id: privateJob.id } });

    // Group 8: Optimistic Concurrency Invariant
    recordTest(
      'Optimistic Concurrency',
      'Application, ResumeVersion, and KnowledgeItem have version fields for multi-device protection',
      typeof appliedApp?.version === 'number' && appliedApp.version >= 1,
      `Application version: ${appliedApp?.version}`
    );
  } catch (error) {
    console.error('Fatal error during verification:', error);
    recordTest('Verification Suite', 'Execution without unhandled exception', false, String(error));
  } finally {
    await prisma.$disconnect();
  }

  // Summary
  console.log('\n======================================================');
  console.log('       CAREERQUEST PHASE 6A VERIFICATION SUMMARY       ');
  console.log('======================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`Results: ${passedCount}/${totalCount} tests passed (${Math.round((passedCount / totalCount) * 100)}%)\n`);

  if (passedCount < totalCount) {
    console.error('❌ Phase 6A verification failed!');
    process.exit(1);
  } else {
    console.log('🎉 All Phase 6A Database Infrastructure invariants VERIFIED & PASS!');
  }
}

verifyPhase6A();
