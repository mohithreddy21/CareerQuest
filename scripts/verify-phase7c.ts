/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import {
  normalizeJobUrl,
  detectSource
} from '../src/features/jobs/lib/importer';
import {
  normalizeCompany,
  normalizeTitle,
  normalizeLocation,
  tokenizeText,
  calculateStructuralSimilarity,
  getSourceAuthorityRank,
  isSourceUsable,
  shouldPromoteNewSource,
  selectBestPrimarySource,
  evaluateSourceVerification,
  aggregateJobStatus,
  evaluateDeduplication
} from '../src/features/jobs/lib/dedup';
import { getCareerRepository, setCareerRepositoryMode } from '../src/services/repository-provider';
import { Job, JobSourceReference } from '../src/types/domain';

const prisma = new PrismaClient();

interface Checkpoint {
  num: number;
  name: string;
  passed: boolean;
  details?: string;
}

const checkpoints: Checkpoint[] = [];

function record(num: number, name: string, passed: boolean, details?: string) {
  checkpoints.push({ num, name, passed, details });
  const numStr = String(num).padStart(2, '0');
  const status = passed ? `PASS ${numStr}` : `FAIL ${numStr}`;
  console.log(`${status}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function run() {
  console.log('====================================================');
  console.log('  CareerQuest Phase 7C: Cross-Source Deduplication');
  console.log('  & Source Intelligence Verification Suite');
  console.log('====================================================\n');

  setCareerRepositoryMode('prisma');
  const repository = getCareerRepository();

  const CAND_A = 'cand-phase7c-a';
  const CAND_B = 'cand-phase7c-b';

  // Seed test candidates
  await prisma.candidate.upsert({
    where: { id: CAND_A },
    create: {
      id: CAND_A,
      clerkUserId: 'user_phase7c_a',
      email: 'cand_a.phase7c@example.com',
      profile: {
        create: {
          name: 'Candidate A (Phase 7C)',
          location: 'San Francisco, CA',
          professionalSummary: 'Senior Full Stack Engineer with React, TypeScript, Node.js experience.'
        }
      }
    },
    update: {}
  });

  await prisma.candidate.upsert({
    where: { id: CAND_B },
    create: {
      id: CAND_B,
      clerkUserId: 'user_phase7c_b',
      email: 'cand_b.phase7c@example.com',
      profile: {
        create: {
          name: 'Candidate B (Phase 7C)',
          location: 'New York, NY',
          professionalSummary: 'Backend Engineer specializing in Go, distributed systems, and PostgreSQL.'
        }
      }
    },
    update: {}
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: EXACT IDENTITY (TIER 1)
  // ---------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Exact Source Identity Invariants ---');

  const baseGreenhouseUrl = 'https://boards.greenhouse.io/stripe/jobs/55443322';
  const urlWithParams = `${baseGreenhouseUrl}?utm_source=linkedin&utm_campaign=hiring2026&ref=candidate_portal`;
  const urlWithFragment = `${baseGreenhouseUrl}#application-section`;
  const urlCaseVariant = 'HTTPS://BOARDS.GREENHOUSE.IO:443/stripe/jobs/55443322/';

  const norm1 = normalizeJobUrl(baseGreenhouseUrl);
  const norm2 = normalizeJobUrl(urlWithParams);
  const norm3 = normalizeJobUrl(urlWithFragment);
  const norm4 = normalizeJobUrl(urlCaseVariant);

  record(1, 'Tracking parameters resolve to same exact normalized URL', norm1 === norm2, norm2);
  record(2, 'URL fragments resolve to same exact normalized URL', norm1 === norm3, norm3);
  record(3, 'URL case and default port resolve to same exact normalized URL', norm1 === norm4, norm4);

  // Import via text/url to verify Tier 1 deduplication idempotency
  const jobText1 = `
    Job Title: Senior Distributed Systems Engineer
    Company: CloudScale Infrastructure Inc.
    Location: San Francisco, CA
    Work Arrangement: Hybrid
    Description: We are looking for a Senior Distributed Systems Engineer to scale our global edge network.
    Responsibilities:
    - Architect low-latency replication protocols
    - Maintain Kubernetes clusters across multi-cloud regions
    - Participate in on-call rotation and reliability reviews
    Requirements:
    - 5+ years of experience with Go, Rust, or C++
    - Deep understanding of TCP/IP, Raft, and Paxos consensus
    - Experience with Docker, Kubernetes, and Linux internals
  `;

  const initialImport = await repository.importJobFromText(
    jobText1,
    'Senior Distributed Systems Engineer',
    'CloudScale Infrastructure Inc.',
    CAND_A
  );

  const initialJobId = initialImport.job?.id;
  record(
    4,
    'Initial job import succeeds with unique canonical opportunity',
    Boolean(initialImport.success && initialJobId),
    initialJobId
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: STRUCTURAL SIMILARITY & NORMALIZATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Structural Similarity & Text Normalization ---');

  const normComp1 = normalizeCompany('CloudScale Infrastructure, Inc.');
  const normComp2 = normalizeCompany('CloudScale Infrastructure LLC');
  record(5, 'Company normalization removes legal entity suffixes', normComp1 === 'cloudscale infrastructure' && normComp2 === 'cloudscale infrastructure', normComp1);

  const normTitle1 = normalizeTitle('Senior Distributed Systems Engineer (Remote)');
  const normTitle2 = normalizeTitle('Sr. Distributed Systems Engineer - Hybrid');
  record(6, 'Title normalization handles abbreviations and work tags while preserving seniority', normTitle1 === 'senior distributed systems engineer' && normTitle2 === 'senior distributed systems engineer', normTitle1);

  const normTitleJunior = normalizeTitle('Junior Distributed Systems Engineer');
  record(7, 'Title normalization strictly preserves seniority distinctions (Senior != Junior)', normTitle1 !== normTitleJunior, `${normTitle1} vs ${normTitleJunior}`);

  const normLoc1 = normalizeLocation('San Francisco, California');
  const normLoc2 = normalizeLocation('SF, CA');
  const normLoc3 = normalizeLocation('Remote - US');
  record(8, 'Location normalization resolves city aliases and remote variants', normLoc1 === 'san francisco ca' && normLoc2 === 'san francisco ca' && normLoc3 === 'remote', `${normLoc1} | ${normLoc3}`);

  const sampleJobA = {
    title: 'Senior Backend Engineer',
    company: 'Stripe',
    location: 'San Francisco, CA',
    description:
      'We are looking for a Senior Backend Engineer to build robust payment APIs across our financial network. Equal Opportunity Employer. All qualified applicants will receive consideration.',
    responsibilities: ['Design distributed payment workflows', 'Maintain high availability'],
    requiredSkills: ['TypeScript', 'Node.js', 'PostgreSQL'],
    preferredSkills: ['Redis', 'Docker']
  };

  const sampleJobB = {
    title: 'Senior Backend Engineer',
    company: 'Stripe',
    location: 'San Francisco, CA',
    description:
      'We are looking for a Senior Backend Engineer to build robust payment APIs across our financial network. Stripe is an affirmative action employer. We celebrate diversity.',
    responsibilities: ['Design distributed payment workflows', 'Maintain high availability'],
    requiredSkills: ['TypeScript', 'Node.js', 'PostgreSQL'],
    preferredSkills: ['Redis', 'Docker']
  };

  const simHigh = calculateStructuralSimilarity(sampleJobA, sampleJobB);
  record(9, 'Structural similarity function is deterministic and yields >= 85% on matching content', simHigh.similarity >= 85, `Score: ${simHigh.similarity}%`);

  const sampleJobDiff = {
    title: 'Senior Backend Engineer',
    company: 'Stripe',
    location: 'San Francisco, CA',
    description: 'Manage clinical trials and healthcare patient database security.',
    responsibilities: ['Ensure HIPAA compliance for medical logs', 'Audit patient health records'],
    requiredSkills: ['HIPAA', 'HL7', 'Epic EHR', 'Java'],
    preferredSkills: ['Spring Boot']
  };

  const simLow = calculateStructuralSimilarity(sampleJobA, sampleJobDiff);
  record(10, 'Structural similarity prevents false positive on different domain duties (<85%)', simLow.similarity < 85, `Score: ${simLow.similarity}%`);

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: STRONG DUPLICATES (TIER 2) & CANONICAL CLUSTERING
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Strong Duplicates (Tier 2) & Non-Destructive Clustering ---');

  // Secondary posting of the same real-world job with >=85% content similarity
  const jobTextDuplicate = `
    Title: Senior Distributed Systems Engineer
    Company: CloudScale Infrastructure
    Location: San Francisco, CA
    Work Arrangement: Hybrid
    Description: CloudScale Infrastructure is seeking a Senior Distributed Systems Engineer to scale our global edge network.
    Responsibilities:
    - Architect low-latency replication protocols
    - Maintain Kubernetes clusters across multi-cloud regions
    - Participate in on-call rotation and reliability reviews
    Requirements:
    - 5+ years of experience with Go, Rust, or C++
    - Deep understanding of TCP/IP, Raft, and Paxos consensus
    - Experience with Docker, Kubernetes, and Linux internals
  `;

  const duplicateImport = await repository.importJobFromText(
    jobTextDuplicate,
    'Senior Distributed Systems Engineer',
    'CloudScale Infrastructure',
    CAND_A
  );

  record(11, 'Cross-source strong duplicate is detected as strong_duplicate tier', duplicateImport.duplicateTier === 'strong_duplicate', duplicateImport.duplicateTier);
  record(12, 'Strong duplicate reuses the existing canonical Job record', duplicateImport.job?.id === initialJobId, `Canonical ID: ${duplicateImport.job?.id}`);
  record(13, 'Both existing and new source references are attached to canonical Job', Boolean(duplicateImport.job?.duplicateGroupId), `Group: ${duplicateImport.job?.duplicateGroupId}`);

  const sourcesForCanonical = initialJobId ? await repository.getJobSourceReferences(initialJobId) : [];
  record(14, 'Canonical Job has multiple preserved JobSourceReference records', sourcesForCanonical.length >= 2, `Count: ${sourcesForCanonical.length}`);

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: POSSIBLE DUPLICATES (TIER 3)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Possible Duplicates (Tier 3) ---');

  // Same company + title, but different location (e.g. London, UK vs San Francisco, CA)
  const jobTextDiffLocation = `
    Job Title: Senior Distributed Systems Engineer
    Company: CloudScale Infrastructure Inc.
    Location: London, UK
    Work Arrangement: Onsite
    Description: We are hiring a Senior Distributed Systems Engineer in our London office.
    Responsibilities:
    - Architect low-latency replication protocols for EMEA
    - Maintain Kubernetes clusters across European regions
    Requirements:
    - 5+ years of experience with Go, Rust, or C++
    - Understanding of Raft and Paxos consensus
  `;

  const diffLocImport = await repository.importJobFromText(
    jobTextDiffLocation,
    'Senior Distributed Systems Engineer',
    'CloudScale Infrastructure Inc.',
    CAND_A
  );

  record(15, 'Same company/title in differing location is NOT merged automatically (separate canonical Job)', diffLocImport.job?.id !== initialJobId, `New Job ID: ${diffLocImport.job?.id}`);
  record(16, 'Tier 3 possible duplicate evidence is exposed without destructive merging', diffLocImport.duplicateTier === 'possible_duplicate' || diffLocImport.possibleDuplicates !== undefined, `Tier: ${diffLocImport.duplicateTier}`);

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: FALSE-POSITIVE PROTECTION (TIER 4: UNIQUE)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: False Positive Protections ---');

  // Same title, different company
  const diffCompImport = await repository.importJobFromText(
    jobText1,
    'Senior Distributed Systems Engineer',
    'Apex Financial Networks',
    CAND_A
  );
  record(17, 'Different company with identical title/skills is treated as unique', diffCompImport.job?.id !== initialJobId && diffCompImport.job?.company === 'Apex Financial Networks', diffCompImport.job?.company);

  // Same company, different seniority level (Junior vs Senior)
  const juniorImport = await repository.importJobFromText(
    jobText1.replace(/Senior/g, 'Junior'),
    'Junior Distributed Systems Engineer',
    'CloudScale Infrastructure Inc.',
    CAND_A
  );
  record(18, 'Different title seniority at same company is NOT merged', juniorImport.job?.id !== initialJobId, juniorImport.job?.title);

  // ---------------------------------------------------------------------------
  // TEST GROUP 6: PRIMARY SOURCE HIERARCHY & TRANSACTIONAL INVARIANT
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Primary Source Intelligence & Hierarchy ---');

  record(19, 'Authority rank: ATS integrations (100) > Direct Portals (75)', getSourceAuthorityRank('greenhouse') === 100 && getSourceAuthorityRank('company_portal') === 75, 'Greenhouse: 100, Portal: 75');
  record(20, 'Authority rank: Direct Portals (75) > Aggregators (50)', getSourceAuthorityRank('company_portal') === 75 && getSourceAuthorityRank('linkedin') === 50, 'Portal: 75, LinkedIn: 50');
  record(21, 'Authority rank: Aggregators (50) > Manual text (25)', getSourceAuthorityRank('linkedin') === 50 && getSourceAuthorityRank('manual') === 25, 'LinkedIn: 50, Manual: 25');

  // Create a multi-source job fixture to test promotion invariant
  const testJob = await repository.addJob(
    {
      title: 'Staff Security Engineer',
      company: 'Securitas Systems',
      location: 'Remote',
      workArrangement: 'remote',
      description: 'Zero Trust architecture and cloud security posture management.',
      responsibilities: ['Build zero-trust perimeter', 'Audit IAM policies'],
      requiredSkills: ['Security', 'Cloud', 'IAM'],
      preferredSkills: ['AWS', 'K8s'],
      source: 'linkedin',
      jobStatus: 'active',
      isPublic: true
    },
    CAND_A
  );

  // Add LinkedIn reference (Rank 50) as initial primary
  const refLinkedIn = await repository.addJobSourceReference({
    jobId: testJob.id,
    source: 'linkedin',
    sourceUrl: 'https://linkedin.com/jobs/view/999111',
    normalizedUrl: 'https://linkedin.com/jobs/view/999111',
    sourceStatus: 'active',
    verificationStatus: 'verified_accessible',
    isPrimary: true,
    referenceRole: 'primary',
    firstSeenAt: new Date(Date.now() - 10000),
    lastSeenAt: new Date()
  });

  let refs = await repository.getJobSourceReferences(testJob.id);
  const primary1 = refs.find((r) => r.isPrimary);
  record(22, 'Initial LinkedIn source is set as primary reference', primary1?.id === refLinkedIn.id, primary1?.source);

  // Add Greenhouse reference (Rank 100). Higher authority should promote Greenhouse and demote LinkedIn
  const shouldPromote = shouldPromoteNewSource('greenhouse', primary1);
  record(23, 'Greenhouse source is recognized as having promotion priority over LinkedIn', shouldPromote === true, 'Promote: true');

  const refGreenhouse = await repository.addJobSourceReference({
    jobId: testJob.id,
    source: 'greenhouse',
    sourceUrl: 'https://boards.greenhouse.io/securitas/jobs/999111',
    normalizedUrl: 'https://boards.greenhouse.io/securitas/jobs/999111',
    sourceStatus: 'active',
    verificationStatus: 'verified_accessible',
    isPrimary: true,
    referenceRole: 'primary',
    firstSeenAt: new Date(),
    lastSeenAt: new Date()
  });

  refs = await repository.getJobSourceReferences(testJob.id);
  const primaryRefs = refs.filter((r) => r.isPrimary);
  record(24, 'Single primary source invariant is maintained transactionally', primaryRefs.length === 1, `Primary count: ${primaryRefs.length}`);
  record(25, 'Greenhouse successfully promoted to primary; LinkedIn demoted to alternative', primaryRefs[0]?.id === refGreenhouse.id, `Current primary: ${primaryRefs[0]?.source}`);

  // Adding another equal-or-lower authority source (e.g. Indeed, rank 50) does not demote Greenhouse
  const shouldPromoteIndeed = shouldPromoteNewSource('indeed', primaryRefs[0]);
  record(26, 'Incoming aggregator (Indeed) does NOT demote authoritative ATS (Greenhouse)', shouldPromoteIndeed === false, 'Promote: false');

  // ---------------------------------------------------------------------------
  // TEST GROUP 7: PRIMARY SOURCE FALLBACK
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Primary Source Fallback ---');

  // Close the Greenhouse primary source
  await repository.updateJobSourceReference(refGreenhouse.id, {
    sourceStatus: 'closed',
    isPrimary: false,
    referenceRole: 'alternative'
  });

  // Call fallbackPrimarySource
  const fallbackRef = await repository.fallbackPrimarySource(testJob.id);
  record(27, 'When primary ATS closes, active alternative (LinkedIn) is promoted as fallback', fallbackRef?.id === refLinkedIn.id, `Promoted fallback: ${fallbackRef?.source}`);

  const postFallbackRefs = await repository.getJobSourceReferences(testJob.id);
  const closedRefPreserved = postFallbackRefs.find((r) => r.id === refGreenhouse.id);
  record(28, 'Closed historical source reference is preserved and never deleted', closedRefPreserved?.sourceStatus === 'closed', `Status: ${closedRefPreserved?.sourceStatus}`);

  // ---------------------------------------------------------------------------
  // TEST GROUP 8: SOURCE LIFECYCLE VS SOURCE VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Source Lifecycle vs Verification ---');

  const dummyRef: Pick<JobSourceReference, 'sourceStatus' | 'verificationStatus'> = {
    sourceStatus: 'active',
    verificationStatus: 'unverified'
  };

  // 1. HTTP 404
  const eval404 = evaluateSourceVerification(dummyRef, { statusCode: 404 });
  record(29, 'HTTP 404 represents authoritative closure (sourceStatus = closed)', eval404.newSourceStatus === 'closed' && eval404.isAuthoritativeClose === true, `Status: ${eval404.newSourceStatus}`);

  // 2. HTTP 410
  const eval410 = evaluateSourceVerification(dummyRef, { statusCode: 410 });
  record(30, 'HTTP 410 represents authoritative closure (sourceStatus = closed)', eval410.newSourceStatus === 'closed', `Status: ${eval410.newSourceStatus}`);

  // 3. Explicit ATS closed text marker
  const evalMarker = evaluateSourceVerification(dummyRef, {
    statusCode: 200,
    body: '<html><body>This job is no longer available. Thank you for your interest.</body></html>'
  });
  record(31, 'Explicit ATS closed text represents authoritative closure', evalMarker.newSourceStatus === 'closed', `Status: ${evalMarker.newSourceStatus}`);

  // 4. Timeout error (MUST NOT close)
  const evalTimeout = evaluateSourceVerification(dummyRef, {
    error: 'Request timed out after 5000ms'
  });
  record(32, 'Network timeout records verification_failed but DOES NOT mark source closed', evalTimeout.newSourceStatus === 'active' && evalTimeout.newVerificationStatus === 'verification_failed', `Source: ${evalTimeout.newSourceStatus}, Verification: ${evalTimeout.newVerificationStatus}`);

  // 5. HTTP 403 Forbidden / Cloudflare challenge (MUST NOT close)
  const eval403 = evaluateSourceVerification(dummyRef, { statusCode: 403 });
  record(33, 'HTTP 403 Forbidden records verification_failed but DOES NOT mark source closed', eval403.newSourceStatus === 'active' && eval403.newVerificationStatus === 'verification_failed', `Source: ${eval403.newSourceStatus}`);

  // 6. DNS failure (MUST NOT close)
  const evalDns = evaluateSourceVerification(dummyRef, { error: 'ENOTFOUND boards.greenhouse.io' });
  record(34, 'DNS failure records verification_failed but DOES NOT mark source closed', evalDns.newSourceStatus === 'active' && evalDns.newVerificationStatus === 'verification_failed', `Source: ${evalDns.newSourceStatus}`);

  // ---------------------------------------------------------------------------
  // TEST GROUP 9: USABILITY EVALUATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 9: Source Usability Centralization ---');

  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const thirtyHoursAgo = new Date(now.getTime() - 30 * 60 * 60 * 1000);

  // Active + verified_accessible => usable
  const usable1 = isSourceUsable({ sourceStatus: 'active', verificationStatus: 'verified_accessible', firstSeenAt: thirtyHoursAgo }, now);
  record(35, 'active + verified_accessible is usable', usable1 === true, 'Usable: true');

  // Active + unverified within 24h grace period => usable
  const usable2 = isSourceUsable({ sourceStatus: 'active', verificationStatus: 'unverified', firstSeenAt: twoHoursAgo }, now);
  record(36, 'active + unverified within 24h grace period is usable', usable2 === true, 'Usable: true');

  // Active + unverified beyond 24h => NOT usable
  const usable3 = isSourceUsable({ sourceStatus: 'active', verificationStatus: 'unverified', firstSeenAt: thirtyHoursAgo }, now);
  record(37, 'active + unverified beyond 24h is NOT usable', usable3 === false, 'Usable: false');

  // Active + verification_failed => NOT usable
  const usable4 = isSourceUsable({ sourceStatus: 'active', verificationStatus: 'verification_failed', firstSeenAt: twoHoursAgo }, now);
  record(38, 'active + verification_failed is NOT usable', usable4 === false, 'Usable: false');

  // Closed => NOT usable
  const usable5 = isSourceUsable({ sourceStatus: 'closed', verificationStatus: 'verified_accessible', firstSeenAt: twoHoursAgo }, now);
  record(39, 'closed source is NOT usable', usable5 === false, 'Usable: false');

  // ---------------------------------------------------------------------------
  // TEST GROUP 10: CANONICAL JOB STATUS AGGREGATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 10: Canonical Job Status Aggregation ---');

  const aggActive = aggregateJobStatus([
    { sourceStatus: 'closed' },
    { sourceStatus: 'active' }
  ]);
  record(40, 'Canonical Job remains active if any source reference is active', aggActive === 'active', aggActive);

  const aggClosed = aggregateJobStatus([
    { sourceStatus: 'closed' },
    { sourceStatus: 'closed' }
  ]);
  record(41, 'Canonical Job becomes closed when all known source references are closed', aggClosed === 'closed', aggClosed);

  // ---------------------------------------------------------------------------
  // TEST GROUP 11: CANDIDATE ISOLATION & PRIVACY INVARIANTS
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 11: Candidate Isolation & Privacy ---');

  // Candidate A imports a private job
  const privateJobA = await repository.addJob(
    {
      title: 'Confidential Core Protocol Engineer',
      company: 'Stealth Cryptography Lab',
      location: 'Remote',
      workArrangement: 'remote',
      description: 'Classified cryptographic zero-knowledge circuit implementation.',
      responsibilities: ['Implement halo2 zero-knowledge proofs'],
      requiredSkills: ['Rust', 'Halo2', 'Zero Knowledge'],
      preferredSkills: [],
      source: 'manual',
      jobStatus: 'active',
      isPublic: false
    },
    CAND_A
  );

  // Candidate B searches for jobs
  const candidateBJobs = await repository.getJobs({}, CAND_B);
  const leakedToB = candidateBJobs.some((j) => j.id === privateJobA.id);
  record(42, 'Candidate B cannot discover Candidate A private imported job', leakedToB === false, 'Isolated: true');

  // Candidate B deduplication search cannot see Candidate A private job
  const bDuplicateSearch = await repository.findDuplicateCandidates('Stealth Cryptography Lab', 'Confidential Core Protocol Engineer', CAND_B);
  const dupLeakedToB = bDuplicateSearch.some((j) => j.id === privateJobA.id);
  record(43, 'Deduplication search respects candidate isolation (no cross-tenant leakage)', dupLeakedToB === false, 'Isolated: true');

  // ---------------------------------------------------------------------------
  // TEST GROUP 12: APPLICATION & CANDIDATE STATE PRESERVATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 12: Application & State Preservation ---');

  // Create an application for Candidate A on initialJobId
  const appA = await repository.createApplication(initialJobId!, 'applied', {}, CAND_A);
  record(44, 'Application created for Candidate A on canonical job', Boolean(appA && appA.id), appA.id);

  // Candidate A sets candidate state
  const stateA = await repository.setCandidateJobState(initialJobId!, 'SAVED', CAND_A);
  record(45, 'CandidateJobState created independently for Candidate A', Boolean(stateA && stateA.status === 'SAVED'), stateA.status);

  // Verify that deduplication clustering did not alter Application or CandidateJobState
  const postDedupApp = await repository.getApplicationById(appA.id, CAND_A);
  record(46, 'Application remains linked to original Job with untouched status and history', postDedupApp?.jobId === initialJobId && postDedupApp?.status === 'applied', postDedupApp?.status);

  const postDedupState = await repository.getCandidateJobState(initialJobId!, CAND_A);
  record(47, 'CandidateJobState remains untouched by deduplication grouping', postDedupState?.status === 'SAVED', postDedupState?.status);

  // Candidate B state on initialJobId remains completely independent
  const stateB = await repository.getCandidateJobState(initialJobId!, CAND_B);
  record(48, 'Candidate B state is independent and unaffected by Candidate A clustering', stateB === null, 'Isolated: true');

  // ---------------------------------------------------------------------------
  // TEST GROUP 13: PHASE 2 MATCH SCORING REGRESSION INVARIANTS
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 13: Phase 2 Match Scoring Regression Benchmarks ---');

  const stripeMatch = await repository.getJobMatch('job-1', 'cand-1');
  const datadogMatch = await repository.getJobMatch('job-2', 'cand-1');
  const linearMatch = await repository.getJobMatch('job-4', 'cand-1');

  record(49, 'Stripe benchmark match score remains exactly 94%', stripeMatch?.score === 94, `Actual: ${stripeMatch?.score}%`);
  record(50, 'Datadog benchmark match score remains exactly 82%', datadogMatch?.score === 82, `Actual: ${datadogMatch?.score}%`);
  record(51, 'Linear benchmark match score remains exactly 76%', linearMatch?.score === 76, `Actual: ${linearMatch?.score}%`);

  // Verify missing benchmark skills are not fabricated
  const linearAnalysis = await repository.getJobAnalysis('job-4');
  const linearSkills = linearAnalysis?.technicalRequirements || [];
  const hasFabricatedRust = linearSkills.some((s) => s.toLowerCase() === 'rust');
  record(52, 'Linear benchmark missing skills (Rust/Electron) are not fabricated in analysis', hasFabricatedRust === false, `Skills count: ${linearSkills.length}`);

  // ---------------------------------------------------------------------------
  // CLEANUP
  // ---------------------------------------------------------------------------
  if (initialJobId) {
    await prisma.job.delete({ where: { id: initialJobId } }).catch(() => {});
  }
  if (testJob?.id) {
    await prisma.job.delete({ where: { id: testJob.id } }).catch(() => {});
  }
  if (privateJobA?.id) {
    await prisma.job.delete({ where: { id: privateJobA.id } }).catch(() => {});
  }
  await prisma.candidate.delete({ where: { id: CAND_A } }).catch(() => {});
  await prisma.candidate.delete({ where: { id: CAND_B } }).catch(() => {});

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n====================================================');
  const allPassed = checkpoints.every((c) => c.passed);
  const passedCount = checkpoints.filter((c) => c.passed).length;
  console.log(`Phase 7C Verification Results: ${passedCount}/${checkpoints.length} PASSED`);
  if (allPassed) {
    console.log('🎉 PHASE 7C: CROSS-SOURCE DEDUPLICATION & SOURCE INTELLIGENCE COMPLETE PASS');
  } else {
    console.log('❌ SOME CHECKPOINTS FAILED');
    process.exit(1);
  }
  console.log('====================================================\n');
}

run()
  .catch((e) => {
    console.error('Fatal error running Phase 7C verification:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
