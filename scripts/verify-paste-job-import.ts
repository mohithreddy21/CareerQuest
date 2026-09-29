import { ingestJobFromManualText } from '../src/features/jobs/lib/importer/job-ingestion.service';
import { careerRepository, setCareerRepositoryMode } from '../src/services/career-repository';

async function runPasteTests() {
  console.log('--- Testing Paste Job Description Ingestion ---\n');
  setCareerRepositoryMode('in-memory');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   Details: ${details}`);
    }
  }

  // 1. Valid pasted job description with company, title, requirements, responsibilities
  const validPastedText = `
Software Engineer, Platform Infrastructure
Datadog - New York, NY (Hybrid)

About the Team:
The Platform Infrastructure team designs and operates the core computing and storage primitives powering Datadog.

What You'll Do:
- Architect, build, and maintain multi-region Kubernetes clusters.
- Build high-throughput event ingestion pipelines in Go and Kafka.
- Improve observability, monitoring, and automated failover systems.

Requirements:
- 4+ years software engineering experience with Go, Python, or C++.
- Deep experience with Linux networking, Kubernetes, and AWS infrastructure.
- Familiarity with distributed storage systems and infrastructure-as-code (Terraform).

Compensation:
$170,000 - $210,000 per year + equity + benefits.
`;

  // Test service level
  const res1 = await ingestJobFromManualText({
    text: validPastedText,
    title: 'Software Engineer, Platform Infrastructure',
    company: 'Datadog'
  });

  assert(!res1.error && res1.data !== undefined, 'Valid pasted job succeeds at ingestion service', JSON.stringify(res1));
  assert(res1.data?.source === 'manual', 'Ingested data source is marked as manual', res1.data?.source);
  assert(res1.data?.company === 'Datadog', 'Ingested data company is parsed correctly', res1.data?.company);
  assert(res1.data?.title.includes('Software Engineer') ?? false, 'Job title is extracted correctly', res1.data?.title);
  assert(
    (res1.data?.requiredSkills?.length ?? 0) > 0 || (res1.data?.responsibilities?.length ?? 0) > 0,
    'Requirements or responsibilities extracted from text',
    `skills: ${res1.data?.requiredSkills}, resp: ${res1.data?.responsibilities}`
  );
  assert(
    res1.data?.extractionQuality === 'reliable' || res1.data?.extractionQuality === 'partial',
    'Pasted job extraction quality is reliable or partial',
    res1.data?.extractionQuality
  );

  // Test repository level (full pipeline to canonical domain Job)
  const repoRes = await careerRepository.importJobFromText(
    validPastedText,
    'Software Engineer, Platform Infrastructure',
    'Datadog'
  );
  assert(repoRes.success && repoRes.job !== undefined, 'Repository imports pasted job into canonical Job model', JSON.stringify(repoRes));
  assert(repoRes.job?.source === 'manual', 'Canonical Job source is manual', repoRes.job?.source);
  assert(repoRes.job?.extractionQuality !== undefined, 'Canonical Job tracks extractionQuality', repoRes.job?.extractionQuality);

  // 2. Missing company in input -> extracts from body or falls back gracefully without hallucinating
  const noCompanyText = `
Senior Cloud Architect
Remote (US)

Responsibilities:
- Lead the architecture of cloud migration strategies.
- Manage IAM policies, security guardrails, and VPC topologies.

Requirements:
- 8+ years designing scalable AWS or GCP architectures.
- Expert knowledge of Terraform, CI/CD, and zero-trust security.
`;

  const res2 = await ingestJobFromManualText({
    text: noCompanyText
  });
  assert(!res2.error && res2.data !== undefined, 'Job without explicit company succeeds', JSON.stringify(res2));
  assert(res2.data?.company !== undefined && res2.data.company.length > 0, 'Company field is populated gracefully', res2.data?.company);

  // 3. Missing salary -> does not invent salary
  const noSalaryText = `
Frontend Developer at DesignWorks
Austin, TX

We are seeking a Frontend Developer proficient in React, Tailwind CSS, and Next.js.
You will build accessible components and design systems.
Requirements:
- 3+ years experience with modern React.
- Strong CSS and HTML skills.
`;
  const res3 = await ingestJobFromManualText({
    text: noSalaryText
  });
  assert(!res3.error && res3.data !== undefined, 'Job without salary succeeds', JSON.stringify(res3));
  assert(res3.data?.salaryMin === null || res3.data?.salaryMin === undefined, 'Salary is not invented when omitted from text', JSON.stringify(res3.data?.salaryMin));

  // 4. Incomplete / tiny pasted text (< 20 characters)
  const tinyText = 'Hiring devs now.';
  const res4 = await ingestJobFromManualText({
    text: tinyText
  });
  assert(res4.error !== undefined, 'Tiny pasted text is rejected as insufficient', res4.error);

  // 5. Oversized text (> 50,000 characters)
  const hugeText = 'A'.repeat(50005);
  const res5 = await ingestJobFromManualText({
    text: hugeText
  });
  assert(res5.error !== undefined, 'Oversized text is rejected', res5.error);

  // 6. Multi-source convergence: verify canonical Job fields are identical to URL import shape
  assert(repoRes.job?.id !== undefined, 'Job has canonical ID');
  assert(Array.isArray(repoRes.job?.requiredSkills), 'Job has requiredSkills array');
  assert(Array.isArray(repoRes.job?.preferredSkills), 'Job has preferredSkills array');
  assert(Array.isArray(repoRes.job?.responsibilities), 'Job has responsibilities array');

  console.log(`\nPaste Ingestion Results: ${passed} / ${total} tests passed.\n`);
  if (passed !== total) process.exit(1);
}

runPasteTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
