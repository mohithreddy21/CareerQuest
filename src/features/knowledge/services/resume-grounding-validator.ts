import {
  StructuredResumeExtraction,
  ExtractedSkillClaim,
  ExtractedExperienceClaim,
  ExtractedProjectClaim,
  ExtractedEducationClaim,
  ExtractedCertificationClaim,
  ExtractedAchievementClaim
} from './schemas/resume-extraction-schema';

export interface GroundingRejection {
  category: string;
  identifier: string;
  reason: string;
}

export interface GroundingValidationResult {
  groundedExtraction: StructuredResumeExtraction;
  rejectedCount: number;
  rejections: GroundingRejection[];
}

/**
 * Common skill aliases and token patterns for robust matching
 */
const CANONICAL_ALIASES: Record<string, string[]> = {
  python: ['python', 'py'],
  typescript: ['typescript', 'ts'],
  javascript: ['javascript', 'js', 'es6', 'esnext'],
  'react.js': ['react', 'react.js', 'reactjs'],
  react: ['react', 'react.js', 'reactjs'],
  'next.js': ['next', 'next.js', 'nextjs'],
  'node.js': ['node', 'node.js', 'nodejs'],
  go: ['go', 'golang'],
  rust: ['rust'],
  'c++': ['c++', 'cpp'],
  'c#': ['c#', 'c-sharp', 'csharp'],
  postgresql: ['postgresql', 'postgres', 'psql'],
  postgres: ['postgresql', 'postgres', 'psql'],
  kubernetes: ['kubernetes', 'k8s'],
  docker: ['docker'],
  aws: ['aws', 'amazon web services'],
  gcp: ['gcp', 'google cloud', 'google cloud platform'],
  azure: ['azure', 'microsoft azure'],
  'tailwind css': ['tailwind', 'tailwind css', 'tailwindcss']
};

/**
 * Signatures of adversarial prompt injection attempts in resume texts
 */
const INJECTION_SIGNATURES = [
  /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
  /system\s+prompt/i,
  /you\s+must\s+(?:output|add|say)/i,
  /override\s+(?:all\s+)?instructions/i,
  /developer\s+mode/i,
  /assistant\s*:\s*/i,
  /new\s+instructions/i
];

/**
 * Normalizes text by converting to lowercase, normalizing unicode punctuation and collapsing whitespace
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-') // Normalize dashes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // Normalize single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // Normalize double quotes
    .replace(/[•·*]/g, ' ') // Strip bullet points
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if candidate token exists in normalized text with word/token boundaries
 */
export function hasBoundedToken(text: string, token: string): boolean {
  const normText = normalizeText(text);
  const normToken = normalizeText(token);

  if (!normText || !normToken) return false;

  // Escape regex special chars except + and # which are part of C++, C#
  const escaped = normToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:^|[^a-z0-9+#])${escaped}(?:$|[^a-z0-9+#])`, 'i');
  return pattern.test(normText);
}

/**
 * Checks if an entity matches directly or through recognized aliases
 */
export function matchesSkillEntity(quote: string, skillName: string): boolean {
  const normSkill = normalizeText(skillName);
  if (hasBoundedToken(quote, normSkill)) return true;

  const aliases = CANONICAL_ALIASES[normSkill];
  if (aliases) {
    for (const alias of aliases) {
      if (hasBoundedToken(quote, alias)) return true;
    }
  }

  // Also check if words in multi-word skill exist (e.g. "Continuous Integration")
  const words = normSkill.split(' ').filter((w) => w.length > 2);
  if (words.length > 1) {
    const allWordsPresent = words.every((w) => hasBoundedToken(quote, w));
    if (allWordsPresent) return true;
  }

  return false;
}

/**
 * Checks if significant words of an entity name exist in the quote
 */
export function matchesSubstantialEntity(quote: string, entityName: string): boolean {
  const normQuote = normalizeText(quote);
  const normEntity = normalizeText(entityName);

  if (normQuote.includes(normEntity)) return true;

  // Check substantial words (length > 2, excluding common corp suffixes)
  const stopWords = new Set([
    'inc',
    'llc',
    'corp',
    'corporation',
    'ltd',
    'company',
    'the',
    'and',
    'of',
    'at'
  ]);
  const words = normEntity.split(' ').filter((w) => w.length > 2 && !stopWords.has(w));

  if (words.length === 0) {
    return normQuote.includes(normEntity);
  }

  return words.some((w) => normQuote.includes(w));
}

/**
 * CareerQuest Resume Grounding Validator
 *
 * Verifies that all LLM-extracted claims are strictly grounded in verifiable,
 * unadulterated evidence quotes found within the raw extracted resume text.
 */
export const ResumeGroundingValidator = {
  /**
   * Validates structured extraction against raw resume text
   */
  validate(rawText: string, extraction: StructuredResumeExtraction): GroundingValidationResult {
    const normRawText = normalizeText(rawText);
    const rejections: GroundingRejection[] = [];

    // Helper to check evidence quote existence & prompt injection
    const verifyQuote = (exactQuote: string, category: string, identifier: string): boolean => {
      if (!exactQuote || exactQuote.trim().length === 0) {
        rejections.push({
          category,
          identifier,
          reason: 'Missing evidence exactQuote'
        });
        return false;
      }

      const normQuote = normalizeText(exactQuote);

      // 1. Evidence must exist in raw document text
      if (!normRawText.includes(normQuote)) {
        rejections.push({
          category,
          identifier,
          reason: `Evidence quote not found in source resume text: "${exactQuote.slice(0, 60)}..."`
        });
        return false;
      }

      // 2. Reject prompt injection signatures in evidence quote
      for (const sig of INJECTION_SIGNATURES) {
        if (sig.test(exactQuote)) {
          rejections.push({
            category,
            identifier,
            reason: 'Evidence quote contains prompt injection signature'
          });
          return false;
        }
      }

      return true;
    };

    // 1. Validate Skills
    const validSkills: ExtractedSkillClaim[] = [];
    for (const skill of extraction.skills) {
      if (!verifyQuote(skill.evidence.exactQuote, 'skill', skill.name)) {
        continue;
      }

      if (!matchesSkillEntity(skill.evidence.exactQuote, skill.name)) {
        rejections.push({
          category: 'skill',
          identifier: skill.name,
          reason: `Skill "${skill.name}" is not substantiated in cited quote: "${skill.evidence.exactQuote}"`
        });
        continue;
      }

      // Verify yearsOfExperience if claimed
      if (skill.yearsOfExperience !== undefined) {
        const quote = normalizeText(skill.evidence.exactQuote);
        const yearNumberStr = skill.yearsOfExperience.toString();
        const hasNumber = quote.includes(yearNumberStr);
        const hasYearToken = /\b\d{4}\b/.test(quote) || /years?|yrs?/i.test(quote);

        if (!hasNumber && !hasYearToken) {
          // Remove ungrounded yearsOfExperience rather than dropping the whole skill
          skill.yearsOfExperience = undefined;
        }
      }

      validSkills.push(skill);
    }

    // 2. Validate Experience
    const validExperience: ExtractedExperienceClaim[] = [];
    for (const exp of extraction.experience) {
      const id = `${exp.role} at ${exp.employer}`;
      if (!verifyQuote(exp.evidence.exactQuote, 'experience', id)) {
        continue;
      }

      // Employer must be substantiated
      if (!matchesSubstantialEntity(exp.evidence.exactQuote, exp.employer)) {
        rejections.push({
          category: 'experience',
          identifier: id,
          reason: `Employer "${exp.employer}" is not substantiated in cited quote`
        });
        continue;
      }

      // Role must be substantiated
      if (!matchesSubstantialEntity(exp.evidence.exactQuote, exp.role)) {
        rejections.push({
          category: 'experience',
          identifier: id,
          reason: `Role "${exp.role}" is not substantiated in cited quote`
        });
        continue;
      }

      // Verify date if provided
      const startYear = exp.startDate.slice(0, 4);
      if (startYear && !normalizeText(exp.evidence.exactQuote).includes(startYear)) {
        // Date not in quote: check if it's anywhere in document
        if (!normRawText.includes(startYear)) {
          rejections.push({
            category: 'experience',
            identifier: id,
            reason: `Start date year "${startYear}" not found in resume text`
          });
          continue;
        }
      }

      validExperience.push(exp);
    }

    // 3. Validate Projects
    const validProjects: ExtractedProjectClaim[] = [];
    for (const proj of extraction.projects) {
      if (!verifyQuote(proj.evidence.exactQuote, 'project', proj.name)) {
        continue;
      }

      if (!matchesSubstantialEntity(proj.evidence.exactQuote, proj.name)) {
        rejections.push({
          category: 'project',
          identifier: proj.name,
          reason: `Project name "${proj.name}" is not substantiated in cited quote`
        });
        continue;
      }

      // Filter technologies: only retain technologies supported by evidence or description
      const quoteAndDesc = `${proj.evidence.exactQuote} ${proj.description}`;
      proj.technologies = proj.technologies.filter((tech) =>
        matchesSkillEntity(quoteAndDesc, tech)
      );

      validProjects.push(proj);
    }

    // 4. Validate Education
    const validEducation: ExtractedEducationClaim[] = [];
    for (const edu of extraction.education) {
      const id = `${edu.degree} in ${edu.fieldOfStudy} at ${edu.institution}`;
      if (!verifyQuote(edu.evidence.exactQuote, 'education', id)) {
        continue;
      }

      if (!matchesSubstantialEntity(edu.evidence.exactQuote, edu.institution)) {
        rejections.push({
          category: 'education',
          identifier: id,
          reason: `Institution "${edu.institution}" is not substantiated in cited quote`
        });
        continue;
      }

      validEducation.push(edu);
    }

    // 5. Validate Certifications
    const validCertifications: ExtractedCertificationClaim[] = [];
    for (const cert of extraction.certifications) {
      if (!verifyQuote(cert.evidence.exactQuote, 'certification', cert.name)) {
        continue;
      }

      if (!matchesSubstantialEntity(cert.evidence.exactQuote, cert.name)) {
        rejections.push({
          category: 'certification',
          identifier: cert.name,
          reason: `Certification name "${cert.name}" is not substantiated in cited quote`
        });
        continue;
      }

      validCertifications.push(cert);
    }

    // 6. Validate Achievements
    const validAchievements: ExtractedAchievementClaim[] = [];
    for (const ach of extraction.achievements) {
      if (!verifyQuote(ach.evidence.exactQuote, 'achievement', ach.title)) {
        continue;
      }

      // If metric is claimed, verify metric characters exist in quote
      if (ach.metric) {
        const quote = normalizeText(ach.evidence.exactQuote);
        const normMetric = normalizeText(ach.metric);
        // Check if digits from metric appear in quote
        const digits = normMetric.match(/\d+/g);
        const allDigitsPresent = digits ? digits.every((d) => quote.includes(d)) : false;

        if (!quote.includes(normMetric) && !allDigitsPresent) {
          ach.metric = undefined; // Drop unverified metric rather than dropping achievement
        }
      }

      validAchievements.push(ach);
    }

    return {
      groundedExtraction: {
        skills: validSkills,
        experience: validExperience,
        projects: validProjects,
        education: validEducation,
        certifications: validCertifications,
        achievements: validAchievements
      },
      rejectedCount: rejections.length,
      rejections
    };
  }
};
