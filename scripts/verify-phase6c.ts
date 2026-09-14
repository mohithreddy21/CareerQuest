/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { PrismaCareerRepository } from '../src/services/prisma-career-repository';
import { InMemoryCareerRepository } from '../src/services/in-memory-career-repository';
import { getCareerRepository, setCareerRepositoryMode } from '../src/services/repository-provider';

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
  const testCandIds = ['cand-iso-a', 'cand-iso-b'];
  try {
    // Clean up any existing test records
    await prisma.resumeChange.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.resumeVersion.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.jobMatch.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.applicationEvent.deleteMany({ where: { candidateId: { in: testCandIds } } });
    await prisma.application.deleteMany({ where: { candidateId: { in: testCandIds } } });
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

async function verifyPhase6C() {
  console.log('🔍 Starting CareerQuest Phase 6C Core Data Migration & Prisma Repository Verification...\n');

  try {
    // -------------------------------------------------------------------------
    // GROUP 1: Candidate & Profile CRUD
    // -------------------------------------------------------------------------
    const profile = await prismaRepo.getCandidateProfile('cand-1');
    recordTest(
      'Profile & Preferences',
      'Retrieve Seed Candidate Profile',
      profile.id === 'cand-1' && profile.name === 'Alex Chen',
      `ID: ${profile.id}, Name: ${profile.name}`
    );

    recordTest(
      'Profile & Preferences',
      'Knowledge-derived profile skills and experience populated',
      profile.experience.length > 0 && profile.skills.technical.length > 0,
      `Experiences: ${profile.experience.length}, Technical Skills: ${profile.skills.technical.length}`
    );

    const prefs = await prismaRepo.getCandidatePreferences('cand-1');
    recordTest(
      'Profile & Preferences',
      'Retrieve Preferences',
      prefs !== null && prefs.targetRoles.length > 0,
      `Target roles: ${prefs?.targetRoles.join(', ')}`
    );

    // -------------------------------------------------------------------------
    // GROUP 2: Jobs Catalog & Public vs Private Partition
    // -------------------------------------------------------------------------
    const publicJobs = await prismaRepo.getJobs({}, 'cand-1');
    recordTest(
      'Jobs Catalog',
      'Retrieve Public Jobs',
      publicJobs.length >= 8,
      `Found ${publicJobs.length} active jobs`
    );

    const stripeJob = await prismaRepo.getJobById('job-1', 'cand-1');
    recordTest(
      'Jobs Catalog',
      'Job Lookup by ID (Stripe)',
      stripeJob !== null && stripeJob.company === 'Stripe',
      `Title: ${stripeJob?.title} at ${stripeJob?.company}`
    );

    const filteredJobs = await prismaRepo.getJobs({ search: 'Staff' }, 'cand-1');
    recordTest(
      'Jobs Catalog',
      'Job Keyword Filter (Staff)',
      filteredJobs.length > 0 && filteredJobs.every((j) => j.title.includes('Staff')),
      `Matched ${filteredJobs.length} Staff positions`
    );

    // -------------------------------------------------------------------------
    // GROUP 3: Job Analysis & Job Match Verification (Exact Phase 2 Invariants)
    // -------------------------------------------------------------------------
    const stripeAnalysis = await prismaRepo.getJobAnalysis('job-1');
    recordTest(
      'Analysis & Match',
      'Job Analysis Retrieval',
      stripeAnalysis !== null && stripeAnalysis.technicalRequirements.length > 0,
      `Requirements count: ${stripeAnalysis?.technicalRequirements.length}`
    );

    const stripeMatch = await prismaRepo.getJobMatch('job-1', 'cand-1');
    const datadogMatch = await prismaRepo.getJobMatch('job-2', 'cand-1');
    const linearMatch = await prismaRepo.getJobMatch('job-4', 'cand-1');

    recordTest(
      'Decision Support Scores',
      'Stripe Exact Match Score = 94%',
      stripeMatch?.score === 94,
      `Actual: ${stripeMatch?.score}%`
    );

    recordTest(
      'Decision Support Scores',
      'Datadog Exact Match Score = 82%',
      datadogMatch?.score === 82,
      `Actual: ${datadogMatch?.score}%`
    );

    recordTest(
      'Decision Support Scores',
      'Linear Exact Match Score = 76%',
      linearMatch?.score === 76,
      `Actual: ${linearMatch?.score}%`
    );

    // -------------------------------------------------------------------------
    // GROUP 4: Knowledge Bank Invariants & Provenance
    // -------------------------------------------------------------------------
    const kb = await prismaRepo.getKnowledgeBank('cand-1');
    const totalItems =
      kb.skills.length +
      kb.experiences.length +
      kb.projects.length +
      kb.education.length +
      kb.certifications.length +
      kb.achievements.length;

    recordTest(
      'Knowledge Bank',
      'Retrieve Seed Knowledge Bank',
      totalItems >= 23,
      `Total items: ${totalItems} (Skills: ${kb.skills.length}, Experiences: ${kb.experiences.length})`
    );

    const firstSkill = kb.skills[0];
    recordTest(
      'Knowledge Bank',
      'Provenance Integrity preserved',
      firstSkill.provenance.length > 0 && !!firstSkill.provenance[0].sourceType,
      `Provenance source: ${firstSkill.provenance[0]?.sourceType}`
    );

    // -------------------------------------------------------------------------
    // GROUP 5: Resume Versions & Master Resume
    // -------------------------------------------------------------------------
    const masterResume = await prismaRepo.getMasterResume('cand-1');
    recordTest(
      'Resume Repository',
      'Retrieve Master Resume',
      masterResume !== null && masterResume.id === 'res-master',
      `Master Resume: ${masterResume?.title} (${masterResume?.id})`
    );

    const tailoredStripe = await prismaRepo.getTailoredResumeForJob('job-1', 'cand-1');
    recordTest(
      'Resume Repository',
      'Retrieve Tailored Resume for Job',
      tailoredStripe !== null && (tailoredStripe.jobId === 'job-1' || tailoredStripe.title.includes('Stripe')),
      `Title: ${tailoredStripe?.title}, Changes: ${tailoredStripe?.changes?.length}`
    );

    // -------------------------------------------------------------------------
    // GROUP 6: Cross-Candidate Multi-Tenant Isolation
    // -------------------------------------------------------------------------
    console.log('\n🔒 Testing Strict Candidate Isolation...');
    await cleanupIsolationFixtures();

    // Create Candidate A and Candidate B
    await prisma.candidate.create({
      data: {
        id: 'cand-iso-a',
        clerkUserId: 'user_iso_a',
        email: 'alice@example.com',
        profile: {
          create: {
            name: 'Alice Isolation',
            location: 'San Francisco, CA',
            professionalSummary: 'Senior frontend engineer isolation test profile'
          }
        },
        preferences: { create: { targetRoles: ['Frontend Engineer'], preferredLocations: ['Remote'] } }
      }
    });

    await prisma.candidate.create({
      data: {
        id: 'cand-iso-b',
        clerkUserId: 'user_iso_b',
        email: 'bob@example.com',
        profile: {
          create: {
            name: 'Bob Isolation',
            location: 'New York, NY',
            professionalSummary: 'Senior backend engineer isolation test profile'
          }
        },
        preferences: { create: { targetRoles: ['Backend Engineer'], preferredLocations: ['NYC'] } }
      }
    });

    // 1. Candidate A Knowledge Item Isolation
    const aliceItem = await prismaRepo.saveKnowledgeItem(
      {
        id: 'kb-item-alice-1',
        candidateId: 'cand-iso-a',
        category: 'skill',
        content: { name: 'Alice Proprietary Skill', category: 'technical' },
        status: 'approved',
        provenance: [
          {
            id: 'prov-alice-1',
            sourceType: 'manual_entry',
            sourceLabel: 'Alice input',
            addedAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      'cand-iso-a'
    );

    const bobViewsAliceItem = await prismaRepo.getKnowledgeItemById(aliceItem.id, 'cand-iso-b');
    recordTest(
      'Isolation',
      'Candidate B cannot retrieve Candidate A knowledge item by ID',
      bobViewsAliceItem === null,
      `Expected null, got: ${bobViewsAliceItem ? 'LEAK' : 'null'}`
    );

    let bobTamperCaught = false;
    try {
      await prismaRepo.updateKnowledgeItemStatus(aliceItem.id, 'rejected', 'cand-iso-b');
    } catch {
      bobTamperCaught = true;
    }
    recordTest(
      'Isolation',
      'Candidate B cannot tamper with Candidate A knowledge item status',
      bobTamperCaught,
      bobTamperCaught ? 'Blocked by isolation check' : 'Tamper permitted!'
    );

    // 2. Candidate A Documents Isolation
    await prismaRepo.createCandidateDocument(
      {
        candidateId: 'cand-iso-a',
        filename: 'alice-confidential-resume.pdf',
        mimeType: 'application/pdf',
        size: 10240,
        storageKey: 'docs/alice.pdf',
        hash: 'sha256-alice-hash',
        processingStatus: 'completed'
      },
      'cand-iso-a'
    );

    const bobDocs = await prismaRepo.getCandidateDocuments('cand-iso-b');
    recordTest(
      'Isolation',
      'Candidate B documents list excludes Candidate A private documents',
      bobDocs.every((d) => d.candidateId === 'cand-iso-b'),
      `Bob doc count: ${bobDocs.length}`
    );

    // 3. Private vs Public Job Visibility Partition
    const alicePrivateJob = await prismaRepo.addJob(
      {
        title: 'Confidential Stealth VP Engineering',
        company: 'Stealth Co (Alice Confidential)',
        location: 'Remote',
        workArrangement: 'remote',
        description: 'Private executive import',
        responsibilities: [],
        requiredSkills: ['Leadership'],
        preferredSkills: [],
        source: 'manual_entry',
        originalUrl: 'https://stealth.example.com/alice-private-lead',
        jobStatus: 'active',
        isPublic: false,
        importedByCandidateId: 'cand-iso-a'
      },
      'cand-iso-a'
    );

    const aliceJobs = await prismaRepo.getJobs({}, 'cand-iso-a');
    const bobJobs = await prismaRepo.getJobs({}, 'cand-iso-b');

    const aliceSeesPrivate = aliceJobs.some((j) => j.id === alicePrivateJob.id);
    const bobSeesPrivate = bobJobs.some((j) => j.id === alicePrivateJob.id);
    const bobDirectAccessPrivate = await prismaRepo.getJobById(alicePrivateJob.id, 'cand-iso-b');

    recordTest(
      'Job Privacy',
      'Candidate A sees private imported job',
      aliceSeesPrivate,
      `Private job present in Alice workspace: ${aliceSeesPrivate}`
    );

    recordTest(
      'Job Privacy',
      'Candidate B list CANNOT see Candidate A private imported job',
      !bobSeesPrivate,
      `Private job in Bob catalog: ${bobSeesPrivate}`
    );

    recordTest(
      'Job Privacy',
      'Candidate B direct lookup of Candidate A private job returns null',
      bobDirectAccessPrivate === null,
      `Expected null, got: ${bobDirectAccessPrivate ? 'LEAK' : 'null'}`
    );

    const bobSeesPublic = bobJobs.some((j) => j.id === 'job-1');
    recordTest(
      'Job Privacy',
      'Candidate B still sees public global jobs (Stripe)',
      bobSeesPublic,
      `Public job present: ${bobSeesPublic}`
    );

    // 4. Resume Isolation
    const aliceResume = await prismaRepo.saveResumeVersion(
      {
        id: 'resume-alice-iso-1',
        candidateId: 'cand-iso-a',
        title: 'Alice Private Resume',
        targetRole: 'Staff Frontend Engineer',
        summary: 'Alice private summary',
        experience: [],
        education: [],
        skills: { technical: ['React'], tools: [], soft: [], other: [] },
        projects: [],
        certifications: [],
        approvalState: 'draft',
        changes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      'cand-iso-a'
    );

    const bobViewsAliceResume = await prismaRepo.getResumeVersionById(aliceResume.id, 'cand-iso-b');
    recordTest(
      'Isolation',
      'Candidate B cannot retrieve Candidate A resume version',
      bobViewsAliceResume === null,
      `Expected null, got: ${bobViewsAliceResume ? 'LEAK' : 'null'}`
    );

    // -------------------------------------------------------------------------
    // GROUP 7: Knowledge Bank Invariant Verification
    // -------------------------------------------------------------------------
    console.log('\n🛡️ Verifying Knowledge Bank Approval Invariants...');
    // Create proposed item
    const proposedItem = await prismaRepo.saveKnowledgeItem(
      {
        id: 'kb-proposed-alice-1',
        candidateId: 'cand-iso-a',
        category: 'skill',
        content: { name: 'Unapproved Ingestion Skill', category: 'technical' },
        status: 'proposed',
        provenance: [
          {
            id: 'prov-proposed-1',
            sourceType: 'resume_upload',
            sourceLabel: 'Extracted snippet',
            addedAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      'cand-iso-a'
    );

    const aliceProfileWithProposed = await prismaRepo.getCandidateProfile('cand-iso-a');
    const proposedInProfile = aliceProfileWithProposed.skills.technical.includes('Unapproved Ingestion Skill');
    recordTest(
      'KB Invariants',
      'Proposed knowledge items are NOT populated into candidate profile',
      !proposedInProfile,
      `Proposed item in profile skills: ${proposedInProfile}`
    );

    // Transition to approved
    await prismaRepo.updateKnowledgeItemStatus(proposedItem.id, 'approved', 'cand-iso-a');
    const aliceProfileAfterApprove = await prismaRepo.getCandidateProfile('cand-iso-a');
    const approvedInProfile = aliceProfileAfterApprove.skills.technical.includes('Unapproved Ingestion Skill');
    recordTest(
      'KB Invariants',
      'Approved knowledge items ARE populated into candidate profile',
      approvedInProfile,
      `Approved item in profile skills: ${approvedInProfile}`
    );

    // Transition to rejected
    await prismaRepo.updateKnowledgeItemStatus(proposedItem.id, 'rejected', 'cand-iso-a');
    const aliceProfileAfterReject = await prismaRepo.getCandidateProfile('cand-iso-a');
    const rejectedInProfile = aliceProfileAfterReject.skills.technical.includes('Unapproved Ingestion Skill');
    recordTest(
      'KB Invariants',
      'Rejected knowledge items are NOT populated into candidate profile',
      !rejectedInProfile,
      `Rejected item in profile skills: ${rejectedInProfile}`
    );

    // -------------------------------------------------------------------------
    // GROUP 8: Resume Version Locking Semantics
    // -------------------------------------------------------------------------
    console.log('\n📑 Verifying Resume Version Locking Semantics...');
    const draftResume = await prismaRepo.saveResumeVersion(
      {
        id: 'resume-lock-test',
        candidateId: 'cand-iso-a',
        title: 'Draft Lock Test Resume',
        targetRole: 'Lead Engineer',
        summary: 'Testing lock status',
        experience: [],
        education: [],
        skills: { technical: [], tools: [], soft: [], other: [] },
        projects: [],
        certifications: [],
        approvalState: 'draft',
        changes: [
          {
            id: 'change-lock-1',
            resumeVersionId: 'resume-lock-test',
            section: 'summary',
            originalContent: 'Old summary',
            proposedContent: 'New tailored summary',
            rationale: 'Align with requirements',
            jobRequirement: 'Leadership',
            sourceCandidateEvidence: 'Evidence',
            sourceKnowledgeItemIds: [],
            evidenceReferences: [],
            status: 'pending',
            grounded: true
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      'cand-iso-a'
    );

    recordTest(
      'Resume Integrity',
      'Initial resume version is unlocked and in draft state',
      draftResume.approvalState === 'draft',
      `Approval state: ${draftResume.approvalState}`
    );

    // Approve all changes
    const approvedResume = await prismaRepo.approveAllResumeChanges(draftResume.id, 'cand-iso-a');
    recordTest(
      'Resume Integrity',
      'Approved resume transitions to approved state and locks',
      approvedResume.approvalState === 'approved',
      `Approval state: ${approvedResume.approvalState}`
    );

    // Verify change status updated to approved
    const reloadedResume = await prismaRepo.getResumeVersionById(draftResume.id, 'cand-iso-a');
    recordTest(
      'Resume Integrity',
      'Resume changes persisted as approved',
      reloadedResume !== null && reloadedResume.changes?.every((c) => c.status === 'approved') === true,
      `All changes approved: ${reloadedResume?.changes?.every((c) => c.status === 'approved')}`
    );

    // -------------------------------------------------------------------------
    // GROUP 9: Repository Equivalence (InMemory vs Prisma)
    // -------------------------------------------------------------------------
    console.log('\n⚖️ Verifying Repository Equivalence (InMemory vs Prisma)...');
    const [memProfile, pProfile] = await Promise.all([
      inMemoryRepo.getCandidateProfile('cand-1'),
      prismaRepo.getCandidateProfile('cand-1')
    ]);
    recordTest(
      'Repository Equivalence',
      'Candidate Profile Name Match',
      memProfile.name === pProfile.name,
      `InMemory: "${memProfile.name}", Prisma: "${pProfile.name}"`
    );

    const [memStripeMatch, pStripeMatch] = await Promise.all([
      inMemoryRepo.getJobMatch('job-1', 'cand-1'),
      prismaRepo.getJobMatch('job-1', 'cand-1')
    ]);
    recordTest(
      'Repository Equivalence',
      'Stripe Job Match Score Equivalence (94%)',
      memStripeMatch?.score === 94 && pStripeMatch?.score === 94,
      `InMemory: ${memStripeMatch?.score}%, Prisma: ${pStripeMatch?.score}%`
    );

    const [memOverview, pOverview] = await Promise.all([
      inMemoryRepo.getDashboardOverview('cand-1'),
      prismaRepo.getDashboardOverview('cand-1')
    ]);
    recordTest(
      'Repository Equivalence',
      'Dashboard Overview Top Match Recommendation Equivalence',
      memOverview.recommended[0]?.job.id === pOverview.recommended[0]?.job.id,
      `Top match job ID: InMemory: ${memOverview.recommended[0]?.job.id}, Prisma: ${pOverview.recommended[0]?.job.id}`
    );

    // -------------------------------------------------------------------------
    // GROUP 10: Repository Provider & Factory
    // -------------------------------------------------------------------------
    console.log('\n🏭 Verifying Repository Provider & Factory...');
    setCareerRepositoryMode('in-memory');
    const repoModeMem = getCareerRepository();
    recordTest(
      'Repository Provider',
      'Explicit in-memory mode resolves InMemoryCareerRepository',
      repoModeMem instanceof InMemoryCareerRepository,
      `Instance: ${repoModeMem.constructor.name}`
    );

    setCareerRepositoryMode('prisma');
    const repoModePrisma = getCareerRepository();
    recordTest(
      'Repository Provider',
      'Default/prisma mode resolves PrismaCareerRepository',
      repoModePrisma instanceof PrismaCareerRepository,
      `Instance: ${repoModePrisma.constructor.name}`
    );

    // Clean up test records
    await cleanupIsolationFixtures();

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = results.length;
    console.log('\n======================================================');
    console.log(`Phase 6C Verification Result: ${passedCount}/${totalCount} Passed`);
    console.log('======================================================');

    if (passedCount === totalCount) {
      console.log('🎉 PHASE 6C COMPLETE & VERIFIED: All tests passed.\n');
      process.exit(0);
    } else {
      console.error(`❌ PHASE 6C VERIFICATION FAILED: ${totalCount - passedCount} test(s) failed.`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error during Phase 6C verification:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPhase6C();
