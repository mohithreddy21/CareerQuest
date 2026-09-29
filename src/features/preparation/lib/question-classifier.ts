import { ApplicationQuestionCategory } from '@/types/preparation';

/**
 * CareerQuest Question Classifier
 *
 * Classifies an application question into the canonical Phase 8A 7-item taxonomy:
 * - 'behavioral'
 * - 'technical'
 * - 'motivation'
 * - 'logistics'
 * - 'compensation'
 * - 'eligibility'
 * - 'other'
 *
 * Uses semantic phrase patterns, question stems, and domain keyword rules.
 */
export function classifyQuestionCategory(questionText: string): ApplicationQuestionCategory {
  if (!questionText || typeof questionText !== 'string') {
    return 'other';
  }

  const q = questionText.toLowerCase().trim();

  // 1. COMPENSATION
  // Explicit questions about salary, rates, earnings, expectations
  const compensationPatterns = [
    /\bsalary\b/,
    /\bcompensation\b/,
    /\bpay\s*(?:rate|scale|range|expectation)?\b/,
    /\bhourly\s*rate\b/,
    /\bexpected\s*(?:earnings|remuneration|salary|pay|compensation)\b/,
    /\btarget\s*salary\b/,
    /\bwhat\s*(?:is|are)\s*your\s*(?:salary|compensation|rate)\b/,
    /\bwhat\s*salary\s*are\s*you\s*expecting\b/,
    /\bannual\s*compensation\b/
  ];
  if (compensationPatterns.some((pattern) => pattern.test(q))) {
    return 'compensation';
  }

  // 2. ELIGIBILITY
  // Work authorization, visas, legal eligibility, sponsorship
  const eligibilityPatterns = [
    /\bauthorized\s*to\s*work\b/,
    /\bwork\s*authorization\b/,
    /\bvisa\s*sponsorship\b/,
    /\brequire\s*(?:visa|sponsorship)\b/,
    /\blegal(?:ly)?\s*(?:eligible|authorized|permitted)\b/,
    /\bright\s*to\s*work\b/,
    /\bbackground\s*check\b/,
    /\bsecurity\s*clearance\b/,
    /\bare\s*you\s*authorized\b/,
    /\bwill\s*you\s*(?:now|in\s*the\s*future)\s*require\s*sponsorship\b/,
    /\beligible\s*to\s*work\b/
  ];
  if (eligibilityPatterns.some((pattern) => pattern.test(q))) {
    return 'eligibility';
  }

  // 3. LOGISTICS
  // Start dates, relocation, remote/onsite/hybrid, work schedules, commute
  const logisticsPatterns = [
    /\bwhen\s*can\s*you\s*start\b/,
    /\bavailable\s*to\s*start\b/,
    /\bstart\s*date\b/,
    /\bstart\s*in\s*(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/,
    /\bnotice\s*period\b/,
    /\bwilling\s*to\s*relocate\b/,
    /\brelocation\b/,
    /\bcommute\b/,
    /\btime\s*zone\b/,
    /\bwork\s*(?:remotely|on-site|onsite|hybrid)\b/,
    /\bworking\s*hours\b/,
    /\bhow\s*soon\s*can\s*you\b/
  ];
  if (logisticsPatterns.some((pattern) => pattern.test(q))) {
    return 'logistics';
  }

  // 4. MOTIVATION
  // Why this company, why this role, what excites you, alignment with mission
  const motivationPatterns = [
    /\bwhy\s*do\s*you\s*want\s*to\s*(?:work|join|apply|be)\b/,
    /\bwhy\s*(?:this|our)\s*(?:company|team|role|position|organization)\b/,
    /\bwhy\s*join\s*(?:our|this|us)\b/,
    /\bwhat\s*(?:interests|excites|attracts)\s*you\b/,
    /\bwhat\s*draws\s*you\s*to\b/,
    /\bwhat\s*do\s*you\s*know\s*about\s*(?:us|our\s*company)\b/,
    /\bwhere\s*do\s*you\s*see\s*yourself\b/,
    /\bcareer\s*goals\b/,
    /\bwhy\s*are\s*you\s*interested\b/,
    /\bwhat\s*motivates\s*you\b/
  ];
  if (motivationPatterns.some((pattern) => pattern.test(q))) {
    return 'motivation';
  }

  // 5. BEHAVIORAL
  // Situational, storytelling, past challenges, teamwork, conflict, STAR prompts
  const behavioralPatterns = [
    /\btell\s*(?:me|us)\s*about\s*a\s*(?:time|project|situation|challenge|conflict|problem)\b/,
    /\bdescribe\s*a\s*(?:time|situation|project|challenge|conflict|difficult)\b/,
    /\bgive\s*(?:an|a)\s*example\s*of\b/,
    /\bhow\s*did\s*you\s*(?:handle|resolve|solve|overcome|manage|deal\s*with)\b/,
    /\bwalk\s*(?:me|us)\s*through\s*(?:a|how\s*you)\b/,
    /\bshare\s*an\s*experience\b/,
    /\btime\s*you\s*(?:solved|failed|disagreed|faced)\b/,
    /\bcollaborate\s*across\s*disciplines\b/,
    /\bhow\s*do\s*you\s*(?:handle\s*conflict|manage\s*stress|prioritize)\b/,
    /\bdifficult\s*(?:problem|colleague|decision|situation)\b/
  ];
  if (behavioralPatterns.some((pattern) => pattern.test(q))) {
    return 'behavioral';
  }

  // 6. TECHNICAL
  // Specific technologies, architectures, coding, systems, database queries, tooling
  const technicalPatterns = [
    /\bexperience\s*with\s+[a-z0-9.#+]+\b/,
    /\bdescribe\s*your\s*experience\s*with\b/,
    /\bhow\s*(?:would|do)\s*you\s*(?:architect|design|implement|debug|scale|optimize|deploy)\b/,
    /\bexplain\s*how\s*.*\s*works\b/,
    /\b(?:postgresql|postgres|mysql|mongodb|redis|dynamodb|cassandra)\b/,
    /\b(?:python|javascript|typescript|golang|rust|java|c\+\+|ruby)\b/,
    /\b(?:react|next\.?js|node\.?js|vue|angular|svelte|graphql|rest|grpc)\b/,
    /\b(?:docker|kubernetes|k8s|kafka|aws|gcp|azure|terraform|ci\/cd)\b/,
    /\b(?:data\s*structures|algorithms|concurrency|multithreading|sharding|indexing)\b/,
    /\btechnical\s*(?:challenge|background|stack|skills|question)\b/,
    /\barchitecture\b/,
    /\bcode\b/,
    /\bdatabase\b/
  ];
  if (technicalPatterns.some((pattern) => pattern.test(q))) {
    return 'technical';
  }

  // 7. OTHER (Fallback for ambiguous/unrecognized questions)
  return 'other';
}
