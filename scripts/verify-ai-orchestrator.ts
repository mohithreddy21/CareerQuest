import * as fs from 'fs';
import * as path from 'path';

// Load .env.local if present
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { aiOrchestrator } from '../src/lib/ai/ai-orchestrator';
import { aiUsageRecorder } from '../src/lib/ai/usage-recorder';
import { JobExtractOutputSchema } from '../src/lib/ai/task-types';
import { mockMatchProvider } from '../src/features/jobs/services/mock-match-provider';
import { Job, JobAnalysis, CandidateProfile } from '../src/types/domain';

async function runAIOrchestratorTests() {
  console.log('--- Testing AI Orchestrator & Matching Safeguards ---\n');

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

  // 1. JOB_EXTRACT dispatch through AI Orchestrator
  const sampleJobText = `
Staff Backend Engineer
Vercel - Remote (US)
Requirements:
- 7+ years of experience with Node.js, Next.js, and TypeScript.
- Strong knowledge of serverless architecture and edge computing.
Responsibilities:
- Build high-scale deployment infrastructure.
- Optimize build pipelines and edge routing.
`;

  const aiResult = await aiOrchestrator.dispatch('JOB_EXTRACT', {
    text: sampleJobText
  });

  assert(aiResult.data !== undefined, 'AI Orchestrator returns structured data');
  assert(
    aiResult.metadata?.taskType === 'JOB_EXTRACT',
    'AI metadata records taskType',
    aiResult.metadata?.taskType
  );
  assert(
    aiResult.metadata?.provider === 'gemini',
    'Configured AI provider is gemini',
    aiResult.metadata?.provider
  );
  assert(
    aiResult.metadata?.latencyMs !== undefined && aiResult.metadata.latencyMs >= 0,
    'AI metadata tracks execution latency',
    `${aiResult.metadata?.latencyMs}ms`
  );

  // 2. Structured schema validation
  const validationResult = JobExtractOutputSchema.safeParse(aiResult.data);
  assert(validationResult.success, 'AI structured output matches JobExtractOutputSchema');

  // 3. Telemetry recording boundary
  const usageHistory = aiUsageRecorder.getRecentRecords();
  const extractRecord = usageHistory.find((r) => r.taskType === 'JOB_EXTRACT');
  assert(extractRecord !== undefined, 'Usage recorder captures JOB_EXTRACT telemetry event');
  assert(extractRecord?.status === 'success', 'Usage recorder records success status');

  // Candidate Profile for Match tests
  const mockCandidate: CandidateProfile = {
    id: 'cand-test-1',
    userId: 'user-test-1',
    name: 'Alex Johnson',
    email: 'alex@example.com',
    location: 'Remote',
    professionalSummary: 'Senior full-stack engineer with 6 years experience in React, TypeScript, and Node.js.',
    targetRoles: ['Senior Frontend Engineer', 'Full Stack Engineer'],
    experience: [
      {
        id: 'exp-1',
        employer: 'Veloce Labs',
        role: 'Senior Full-Stack Engineer',
        startDate: '2021-01',
        isCurrent: true,
        responsibilities: [
          'Led migration of client app to Next.js App Router and React 19',
          'Reduced p95 initial page load from 2.4s to 420ms'
        ],
        achievements: []
      }
    ],
    education: [
      {
        id: 'edu-1',
        institution: 'University of Washington',
        degree: 'B.S. in Computer Science',
        fieldOfStudy: 'Computer Science',
        startDate: '2015-09',
        endDate: '2019-06'
      }
    ],
    skills: {
      technical: ['React', 'TypeScript', 'Node.js', 'Next.js', 'Tailwind CSS'],
      tools: ['Git', 'Docker', 'Vercel'],
      soft: ['Mentorship', 'Communication'],
      other: []
    },
    projects: [],
    certifications: [],
    masterResumeId: 'res-1',
    preferences: {
      targetRoles: ['Senior Frontend Engineer', 'Full Stack Engineer'],
      preferredLocations: ['Remote'],
      workArrangements: ['remote'],
      targetSalaryMin: 150000,
      currency: 'USD'
    }
  };

  // 4. Critical Matching Safeguard: Insufficient extraction quality MUST NOT yield normal match
  const insufficientJob: Job = {
    id: 'job-insufficient-123',
    title: 'Search Jobs - Acme Portal',
    company: 'Acme',
    location: 'Unknown',
    workArrangement: 'remote',
    description: 'Search for jobs across all departments. Sign in to create job alert.',
    requiredSkills: [],
    preferredSkills: [],
    responsibilities: [],
    source: 'generic',
    originalUrl: 'https://careers.acme.com/search',
    normalizedAt: new Date().toISOString(),
    jobStatus: 'active',
    extractionQuality: 'insufficient',
    extractionQualityReasons: ['Page appears to be a search or listing portal rather than a single job posting.']
  };

  const insufficientAnalysis: JobAnalysis = {
    id: 'analysis-insufficient-123',
    jobId: insufficientJob.id,
    seniority: 'mid',
    roleCategory: 'Engineering',
    technicalRequirements: [],
    softSkills: [],
    importantKeywords: [],
    extractedRequirements: [],
    analysisStatus: 'error'
  };

  const matchResult = await mockMatchProvider.calculateMatch(insufficientJob, insufficientAnalysis, mockCandidate);
  assert(
    matchResult.recommendation === 'unavailable',
    'Critical safeguard: Insufficient job returns recommendation = "unavailable"',
    matchResult.recommendation
  );
  assert(
    matchResult.matchUnavailable === true,
    'Critical safeguard: matchUnavailable flag is true',
    String(matchResult.matchUnavailable)
  );
  assert(
    matchResult.unavailableReason !== undefined && matchResult.unavailableReason.length > 0,
    'Critical safeguard: Clear reason provided explaining why match is unavailable',
    matchResult.unavailableReason
  );

  // 5. Critical Matching Safeguard: Reliable extraction produces normal match
  const reliableJob: Job = {
    id: 'job-reliable-456',
    title: 'Senior Frontend Engineer',
    company: 'Stripe',
    location: 'Remote',
    workArrangement: 'remote',
    description: 'We are seeking a senior frontend engineer with React and TypeScript experience.',
    requiredSkills: ['React', 'TypeScript', 'Next.js'],
    preferredSkills: ['Tailwind CSS'],
    responsibilities: ['Build dashboard features'],
    source: 'greenhouse',
    originalUrl: 'https://boards.greenhouse.io/stripe/jobs/123',
    normalizedAt: new Date().toISOString(),
    jobStatus: 'active',
    extractionQuality: 'reliable'
  };

  const reliableAnalysis: JobAnalysis = {
    id: 'analysis-reliable-456',
    jobId: reliableJob.id,
    seniority: 'senior',
    roleCategory: 'Engineering',
    technicalRequirements: ['React', 'TypeScript', 'Next.js'],
    softSkills: ['Communication'],
    importantKeywords: ['React', 'TypeScript', 'Next.js'],
    extractedRequirements: [
      { id: 'req-1', text: 'Proficiency in React and TypeScript', category: 'required', priority: 'high' }
    ],
    analysisStatus: 'success'
  };

  const reliableMatch = await mockMatchProvider.calculateMatch(reliableJob, reliableAnalysis, mockCandidate);
  assert(
    reliableMatch.recommendation !== 'unavailable',
    'Reliable job produces standard match recommendation',
    reliableMatch.recommendation
  );
  assert(
    typeof reliableMatch.score === 'number' && reliableMatch.score > 0,
    'Reliable job produces numerical score',
    `${reliableMatch.score}%`
  );

  console.log(`\nAI Orchestrator & Safeguards: ${passed} / ${total} tests passed.\n`);
  if (passed !== total) process.exit(1);
}

runAIOrchestratorTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
