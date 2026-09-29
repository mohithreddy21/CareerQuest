import { evaluateJobExtractionQuality } from '../src/features/jobs/lib/importer/job-extraction-quality';
import { RawJobExtraction } from '../src/features/jobs/lib/importer/types';

function runTests() {
  console.log('--- Testing Job Extraction Quality Gate ---\n');

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

  // 1. Clean Greenhouse job -> reliable
  const greenhouseJob: RawJobExtraction = {
    title: 'Senior Distributed Systems Engineer',
    company: 'Stripe',
    location: 'San Francisco, CA (Remote)',
    workArrangement: 'remote',
    description: `About the Role:
We are looking for a Senior Distributed Systems Engineer to scale our core payment infrastructure.
Responsibilities:
- Design and build fault-tolerant high-throughput transaction processing systems.
- Improve system reliability, latency, and observability across microservices.
- Partner with security and compliance teams to ensure rock-solid data protection.
Requirements:
- 5+ years building backend systems in Go, Java, or Rust.
- Strong knowledge of distributed consensus (Raft, Paxos), Kafka, and PostgreSQL.
- Experience operating production systems at scale.
Benefits:
- Competitive salary, equity, 401(k) matching, comprehensive health coverage.`,
    requiredSkills: ['Go', 'Distributed Systems', 'Kafka', 'PostgreSQL'],
    preferredSkills: ['Rust', 'Raft'],
    responsibilities: [
      'Design and build fault-tolerant high-throughput transaction processing systems',
      'Improve system reliability, latency, and observability across microservices'
    ],
    salaryMin: 180000,
    salaryMax: 240000,
    salaryCurrency: 'USD',
    salaryInterval: 'yearly',
    source: 'greenhouse',
    sourceUrl: 'https://boards.greenhouse.io/stripe/jobs/12345'
  };
  const q1 = evaluateJobExtractionQuality(greenhouseJob);
  assert(q1.state === 'reliable', 'Greenhouse structured extraction is reliable', JSON.stringify(q1));

  // 2. Clean Lever job -> reliable
  const leverJob: RawJobExtraction = {
    title: 'Full Stack Engineer',
    company: 'Figma',
    location: 'New York, NY',
    workArrangement: 'hybrid',
    description: `Figma is looking for a Full Stack Engineer to join our Collaboration team.
In this role, you will build real-time collaborative web tools.
Qualifications:
- TypeScript, React, WebSockets, and WebGL.
- Passion for great design and user experience.
Responsibilities:
- Build high-performance frontend interfaces.
- Maintain robust server endpoints.`,
    requiredSkills: ['TypeScript', 'React', 'WebSockets'],
    preferredSkills: ['WebGL'],
    responsibilities: ['Build high-performance frontend interfaces'],
    source: 'lever',
    sourceUrl: 'https://jobs.lever.co/figma/67890'
  };
  const q2 = evaluateJobExtractionQuality(leverJob);
  assert(q2.state === 'reliable', 'Lever structured extraction is reliable', JSON.stringify(q2));

  // 3. Schema.org / clean career page without salary -> reliable (missing salary must NOT fail)
  const noSalaryJob: RawJobExtraction = {
    title: 'Security Operations Analyst',
    company: 'Datadog',
    location: 'Boston, MA',
    workArrangement: 'onsite',
    description: `Overview:
Datadog is looking for a Security Operations Analyst to protect our cloud infrastructure.
Key Responsibilities:
- Monitor SIEM alerts and respond to security incidents.
- Conduct threat hunting and vulnerability assessments.
- Automate incident response runbooks using Python.
Requirements:
- 3+ years in security operations or SOC environment.
- Familiarity with AWS security, Linux internals, and network protocols.`,
    requiredSkills: ['SIEM', 'Incident Response', 'Python', 'AWS'],
    preferredSkills: [],
    responsibilities: ['Monitor SIEM alerts and respond to security incidents'],
    source: 'generic',
    sourceUrl: 'https://careers.datadog.com/jobs/sec-ops'
  };
  const q3 = evaluateJobExtractionQuality(noSalaryJob);
  assert(q3.state === 'reliable', 'Missing salary does NOT fail extraction (stays reliable)', JSON.stringify(q3));

  // 4. Clean job missing preferred skills -> reliable (missing preferred skills must NOT fail)
  const noPreferredSkillsJob: RawJobExtraction = {
    ...noSalaryJob,
    preferredSkills: []
  };
  const q4 = evaluateJobExtractionQuality(noPreferredSkillsJob);
  assert(q4.state === 'reliable', 'Missing preferred skills does NOT fail extraction', JSON.stringify(q4));

  // 5. Search portal page instead of a job page -> insufficient
  const searchPageExtraction: RawJobExtraction = {
    title: 'Search Jobs | Careers at MegaCorp',
    company: 'MegaCorp',
    location: 'Global',
    workArrangement: 'unknown',
    description: 'Find jobs by keyword, category, or location. Showing 1 - 25 of 1,420 jobs matching your search criteria. Filter by department or country.',
    requiredSkills: [],
    preferredSkills: [],
    responsibilities: [],
    source: 'generic',
    sourceUrl: 'https://careers.megacorp.com/search'
  };
  const q5 = evaluateJobExtractionQuality(searchPageExtraction);
  assert(q5.state === 'insufficient', 'Search portal page is identified as insufficient', JSON.stringify(q5));

  // 6. Page dominated by recommendation lists / multiple jobs -> insufficient
  const multiJobRecommendationPage: RawJobExtraction = {
    title: 'Recommended Jobs For You - Job Alerts',
    company: 'JobAggregator',
    location: 'Various',
    workArrangement: 'unknown',
    description: `Recommended jobs for you:
1. Senior React Engineer at Company A - Apply now
2. Product Designer at Company B - View job
3. DevOps Lead at Company C - Easy Apply
4. Full Stack Developer at Company D - Save job
5. Backend Architect at Company E - Apply with LinkedIn
Sign in to create a job alert and see personalized recommendations.`,
    requiredSkills: [],
    preferredSkills: [],
    responsibilities: [],
    source: 'generic',
    sourceUrl: 'https://jobaggregator.com/recommended'
  };
  const q6 = evaluateJobExtractionQuality(multiJobRecommendationPage);
  assert(q6.state === 'insufficient', 'Page dominated by recommendation cards is insufficient', JSON.stringify(q6));

  // 7. Very short content / login wall -> insufficient
  const loginWallExtraction: RawJobExtraction = {
    title: 'Sign In to Apply | LinkedIn',
    company: 'Unknown',
    location: 'Unknown',
    workArrangement: 'unknown',
    description: 'Please sign in or create an account to view full job details.',
    requiredSkills: [],
    preferredSkills: [],
    responsibilities: [],
    source: 'linkedin',
    sourceUrl: 'https://www.linkedin.com/jobs/view/112233'
  };
  const q7 = evaluateJobExtractionQuality(loginWallExtraction);
  assert(q7.state === 'insufficient', 'Login wall / tiny stub is insufficient', JSON.stringify(q7));

  // 8. Excessive navigation boilerplate without real job body -> insufficient
  const navBoilerplateExtraction: RawJobExtraction = {
    title: 'Careers Portal',
    company: 'Acme',
    location: 'Unknown',
    workArrangement: 'unknown',
    description: 'Home About Us Contact Products Solutions Privacy Policy Terms of Service Cookie Settings All Rights Reserved Copyright 2026. Back to top. Sitemap. Follow us on Twitter Facebook LinkedIn.',
    requiredSkills: [],
    preferredSkills: [],
    responsibilities: [],
    source: 'generic',
    sourceUrl: 'https://careers.acme.com/footer'
  };
  const q8 = evaluateJobExtractionQuality(navBoilerplateExtraction);
  assert(q8.state === 'insufficient', 'Navigation boilerplate is insufficient', JSON.stringify(q8));

  // 9. Partial job: real job description but sparse skills parsed -> partial
  const partialJob: RawJobExtraction = {
    title: 'Junior Web Assistant',
    company: 'Local Studio',
    location: 'San Jose, CA',
    workArrangement: 'onsite',
    description: 'We are seeking an assistant to help update company websites and upload weekly blog articles. The ideal candidate has basic computer literacy, good communication skills, and willingness to learn on the job.',
    requiredSkills: [],
    preferredSkills: [],
    responsibilities: ['Help update company websites', 'Upload weekly blog articles'],
    source: 'generic',
    sourceUrl: 'https://localstudio.com/jobs/assistant'
  };
  const q9 = evaluateJobExtractionQuality(partialJob);
  assert(q9.state === 'partial', 'Real but sparse job is classified as partial', JSON.stringify(q9));

  console.log(`\nQuality Gate Results: ${passed} / ${total} tests passed.\n`);
  if (passed !== total) process.exit(1);
}

runTests();
