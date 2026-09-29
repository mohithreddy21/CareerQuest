import {
  KnowledgeItem,
  KnowledgeCategory,
  ExperienceKnowledgeContent,
  SkillKnowledgeContent,
  ProjectKnowledgeContent,
  EducationKnowledgeContent,
  CertificationKnowledgeContent,
  AchievementKnowledgeContent
} from '@/types/knowledge';

export type GroundingStatus = 'GROUNDED' | 'REQUIRES_REVIEW' | 'REJECTED';

export type UserFacingGroundingStatus =
  | 'Grounded in your Knowledge Bank'
  | 'Verified Knowledge'
  | 'Requires Candidate Review'
  | 'Missing Evidence';

export interface GroundingEvidenceTrace {
  knowledgeItemId: string;
  category: KnowledgeCategory;
  title: string;
  sourceLabel: string;
  verifiedFields: string[];
}

export interface GroundingValidationResult {
  isValid: boolean; // true if status !== 'REJECTED'
  status: GroundingStatus;
  userFacingStatus: UserFacingGroundingStatus;
  reasons: string[];
  traces: GroundingEvidenceTrace[];
  unsupportedClaims: {
    metrics: string[];
    unsupportedEntities: string[];
    missingEvidence: string[];
  };
}

export interface ValidateClaimParams {
  proposedText: string;
  originalText?: string;
  sourceKnowledgeItemIds: string[];
  candidateId: string;
  candidateApprovedKnowledge: KnowledgeItem[];
  contextLabel?: string;
  allowPersuasiveLanguage?: boolean;
}

export class PositiveGroundingValidator {
  /**
   * Independently validates that a proposed factual statement is anchored
   * to candidate-owned, approved Knowledge Bank items.
   *
   * STRICT GROUNDING INVARIANTS:
   * 1. POSITIVE EVIDENCE ONLY: A claim must have supporting evidence in approved knowledge.
   *    Missing requirements are NEVER treated as forbidden terms or keyword blacklists.
   * 2. NON-CIRCULAR: The validator does not ask or trust the LLM to verify its own statements.
   * 3. CANDIDATE SCOPED: Knowledge items must belong to the authenticated candidateId.
   * 4. STATUS ENFORCEMENT: Only status === 'approved' knowledge items may be used.
   * 5. METRIC & ENTITY FIDELITY: Quantitative metrics and employers must match approved records.
   * 6. ZERO PERCENTAGE METRICS: Returns qualitative, actionable statuses instead of fake scores.
   */
  validateClaim({
    proposedText,
    originalText,
    sourceKnowledgeItemIds,
    candidateId,
    candidateApprovedKnowledge,
    contextLabel,
    allowPersuasiveLanguage
  }: ValidateClaimParams): GroundingValidationResult {
    const reasons: string[] = [];
    const traces: GroundingEvidenceTrace[] = [];
    const unsupportedClaims = {
      metrics: [] as string[],
      unsupportedEntities: [] as string[],
      missingEvidence: [] as string[]
    };

    // 1. CANDIDATE SCOPING & APPROVED STATUS CHECK
    if (!candidateId || typeof candidateId !== 'string') {
      return {
        isValid: false,
        status: 'REJECTED',
        userFacingStatus: 'Requires Candidate Review',
        reasons: ['Candidate identity is invalid or missing.'],
        traces: [],
        unsupportedClaims
      };
    }

    if (!proposedText || proposedText.trim().length === 0) {
      return {
        isValid: false,
        status: 'REJECTED',
        userFacingStatus: 'Missing Evidence',
        reasons: ['Proposed content is empty.'],
        traces: [],
        unsupportedClaims
      };
    }

    // Index candidate's approved items
    const approvedMap = new Map<string, KnowledgeItem>();
    for (const item of candidateApprovedKnowledge) {
      if (item.candidateId === candidateId && item.status === 'approved') {
        approvedMap.set(item.id, item);
      }
    }

    // Check if sourceKnowledgeItemIds were provided
    if (!sourceKnowledgeItemIds || sourceKnowledgeItemIds.length === 0) {
      // If proposed text is identical to original text, it's an unmutated baseline
      if (originalText && proposedText.trim() === originalText.trim()) {
        return {
          isValid: true,
          status: 'GROUNDED',
          userFacingStatus: 'Verified Knowledge',
          reasons: ['Content preserves verified master baseline.'],
          traces: [],
          unsupportedClaims
        };
      }

      // If persuasive language is permitted (e.g. cover letter opening/closing expressions)
      if (allowPersuasiveLanguage) {
        const hasFactual = this.detectFactualClaims(proposedText);
        if (!hasFactual) {
          return {
            isValid: true,
            status: 'GROUNDED',
            userFacingStatus: 'Verified Knowledge',
            reasons: ['Candidate expressive statement without unverified factual claims.'],
            traces: [],
            unsupportedClaims
          };
        }
      }

      // If text makes factual claims without any citations, require review
      unsupportedClaims.missingEvidence.push('No supporting knowledge item references cited.');
      return {
        isValid: true,
        status: 'REQUIRES_REVIEW',
        userFacingStatus: 'Missing Evidence',
        reasons: [
          `Proposed content${contextLabel ? ` in ${contextLabel}` : ''} makes claims without citing supporting Knowledge Bank evidence.`
        ],
        traces: [],
        unsupportedClaims
      };
    }

    // Verify each cited knowledge item ID
    const citedItems: KnowledgeItem[] = [];
    for (const id of sourceKnowledgeItemIds) {
      // Check if item exists in approved knowledge
      const item = approvedMap.get(id);

      if (!item) {
        // Find if it exists in candidate's non-approved items or belongs to another candidate
        const unapprovedMatch = candidateApprovedKnowledge.find((k) => k.id === id);

        if (unapprovedMatch) {
          if (unapprovedMatch.candidateId !== candidateId) {
            // CROSS-CANDIDATE CONTAMINATION DETECTED
            return {
              isValid: false,
              status: 'REJECTED',
              userFacingStatus: 'Requires Candidate Review',
              reasons: [
                `SECURITY VIOLATION: Referenced knowledge item '${id}' belongs to another candidate.`
              ],
              traces: [],
              unsupportedClaims
            };
          }

          if (unapprovedMatch.status !== 'approved') {
            return {
              isValid: false,
              status: 'REJECTED',
              userFacingStatus: 'Requires Candidate Review',
              reasons: [
                `Referenced knowledge item '${id}' is not approved (current status: '${unapprovedMatch.status}'). Only approved Knowledge Bank items can be cited.`
              ],
              traces: [],
              unsupportedClaims
            };
          }
        }

        return {
          isValid: false,
          status: 'REJECTED',
          userFacingStatus: 'Requires Candidate Review',
          reasons: [
            `Referenced knowledge item '${id}' does not exist in the candidate's approved Knowledge Bank.`
          ],
          traces: [],
          unsupportedClaims
        };
      }

      citedItems.push(item);
    }

    // 2. EXTRACT STRUCTURED EVIDENCE FROM CITED ITEMS
    const verifiedContentTexts: string[] = [];
    const verifiedMetrics = new Set<string>();
    const verifiedEmployers = new Set<string>();
    const verifiedSkills = new Set<string>();
    const verifiedProjects = new Set<string>();
    const verifiedDates = new Set<string>();

    for (const item of citedItems) {
      const verifiedFields: string[] = [];
      let itemTitle = 'Knowledge Item';

      const content = item.content as Record<string, unknown> | null;
      if (content) {
        switch (item.category) {
          case 'experience': {
            const exp = content as unknown as ExperienceKnowledgeContent;
            if (exp.employer) {
              verifiedEmployers.add(exp.employer.toLowerCase().trim());
              verifiedContentTexts.push(exp.employer.toLowerCase().trim());
              verifiedFields.push(`Employer: ${exp.employer}`);
            }
            if (exp.role) {
              verifiedContentTexts.push(exp.role.toLowerCase().trim());
              verifiedFields.push(`Role: ${exp.role}`);
            }
            if (exp.startDate) {
              verifiedDates.add(exp.startDate.toLowerCase().trim());
              const yearMatch = exp.startDate.match(/\b(19\d\d|20\d\d)\b/);
              if (yearMatch) verifiedDates.add(yearMatch[1]);
            }
            if (exp.endDate) {
              verifiedDates.add(exp.endDate.toLowerCase().trim());
              const yearMatch = exp.endDate.match(/\b(19\d\d|20\d\d)\b/);
              if (yearMatch) verifiedDates.add(yearMatch[1]);
            }
            if (Array.isArray(exp.responsibilities)) {
              for (const r of exp.responsibilities) {
                verifiedContentTexts.push(r.toLowerCase());
                this.extractMetricsFromText(r).forEach((m) => verifiedMetrics.add(m));
                this.extractTechnologiesFromText(r).forEach((t) => verifiedSkills.add(t));
              }
              verifiedFields.push('Responsibilities');
            }
            if (Array.isArray(exp.achievements)) {
              for (const a of exp.achievements) {
                verifiedContentTexts.push(a.toLowerCase());
                this.extractMetricsFromText(a).forEach((m) => verifiedMetrics.add(m));
                this.extractTechnologiesFromText(a).forEach((t) => verifiedSkills.add(t));
              }
              verifiedFields.push('Achievements');
            }
            itemTitle = `${exp.role || 'Role'} at ${exp.employer || 'Company'}`;
            break;
          }

          case 'skill': {
            const skill = content as unknown as SkillKnowledgeContent;
            if (skill.name) {
              verifiedSkills.add(skill.name.toLowerCase().trim());
              verifiedContentTexts.push(skill.name.toLowerCase().trim());
              verifiedFields.push(`Skill: ${skill.name}`);
              itemTitle = skill.name;
            }
            if (skill.yearsOfExperience) {
              verifiedMetrics.add(`${skill.yearsOfExperience} years`);
              verifiedContentTexts.push(`${skill.yearsOfExperience} years`);
              verifiedContentTexts.push(`${skill.yearsOfExperience} years of experience`);
            }
            break;
          }

          case 'project': {
            const proj = content as unknown as ProjectKnowledgeContent;
            if (proj.name) {
              verifiedProjects.add(proj.name.toLowerCase().trim());
              verifiedContentTexts.push(proj.name.toLowerCase().trim());
              verifiedFields.push(`Project: ${proj.name}`);
              itemTitle = proj.name;
            }
            if (Array.isArray(proj.technologies)) {
              for (const t of proj.technologies) {
                verifiedSkills.add(t.toLowerCase().trim());
                verifiedContentTexts.push(t.toLowerCase().trim());
              }
            }
            if (proj.description) {
              verifiedContentTexts.push(proj.description.toLowerCase());
              this.extractTechnologiesFromText(proj.description).forEach((t) =>
                verifiedSkills.add(t)
              );
            }
            if (proj.contributions) {
              verifiedContentTexts.push(proj.contributions.toLowerCase());
              this.extractTechnologiesFromText(proj.contributions).forEach((t) =>
                verifiedSkills.add(t)
              );
            }
            if (proj.outcomes) {
              verifiedContentTexts.push(proj.outcomes.toLowerCase());
              this.extractMetricsFromText(proj.outcomes).forEach((m) => verifiedMetrics.add(m));
            }
            break;
          }

          case 'education': {
            const edu = content as unknown as EducationKnowledgeContent;
            if (edu.institution) {
              verifiedEmployers.add(edu.institution.toLowerCase().trim());
              verifiedFields.push(`Institution: ${edu.institution}`);
              itemTitle = `${edu.degree || 'Degree'} - ${edu.institution}`;
            }
            if (edu.startDate) {
              const yearMatch = edu.startDate.match(/\b(19\d\d|20\d\d)\b/);
              if (yearMatch) verifiedDates.add(yearMatch[1]);
            }
            if (edu.endDate) {
              const yearMatch = edu.endDate.match(/\b(19\d\d|20\d\d)\b/);
              if (yearMatch) verifiedDates.add(yearMatch[1]);
            }
            break;
          }

          case 'certification': {
            const cert = content as unknown as CertificationKnowledgeContent;
            if (cert.name) {
              verifiedFields.push(`Certification: ${cert.name}`);
              itemTitle = cert.name;
            }
            break;
          }

          case 'achievement': {
            const ach = content as unknown as AchievementKnowledgeContent;
            if (ach.title) {
              verifiedFields.push(`Achievement: ${ach.title}`);
              itemTitle = ach.title;
            }
            if (ach.description) {
              verifiedContentTexts.push(ach.description.toLowerCase());
            }
            if (ach.metric) {
              verifiedMetrics.add(ach.metric.toLowerCase().trim());
              verifiedFields.push(`Metric: ${ach.metric}`);
            }
            break;
          }
        }
      }

      // Check provenance label
      const provenanceLabel = item.provenance?.[0]?.sourceLabel || 'Candidate Knowledge Bank';

      traces.push({
        knowledgeItemId: item.id,
        category: item.category,
        title: itemTitle,
        sourceLabel: provenanceLabel,
        verifiedFields
      });
    }

    // Index all candidate approved skills and employers across entire Knowledge Bank
    const allCandidateSkills = new Set<string>();
    const allCandidateEmployers = new Set<string>();
    const allCandidateYears = new Set<string>();

    for (const k of candidateApprovedKnowledge) {
      if (k.candidateId === candidateId && k.status === 'approved') {
        const c = k.content as Record<string, unknown> | null;
        if (!c) continue;
        if (k.category === 'skill') {
          const s = c as unknown as SkillKnowledgeContent;
          if (s.name) allCandidateSkills.add(s.name.toLowerCase().trim());
        } else if (k.category === 'project') {
          const p = c as unknown as ProjectKnowledgeContent;
          if (Array.isArray(p.technologies)) {
            p.technologies.forEach((t) => allCandidateSkills.add(t.toLowerCase().trim()));
          }
        } else if (k.category === 'experience') {
          const e = c as unknown as ExperienceKnowledgeContent;
          if (e.employer) allCandidateEmployers.add(e.employer.toLowerCase().trim());
          if (e.startDate) {
            const ym = e.startDate.match(/\b(19\d\d|20\d\d)\b/);
            if (ym) allCandidateYears.add(ym[1]);
          }
          if (e.endDate) {
            const ym = e.endDate.match(/\b(19\d\d|20\d\d)\b/);
            if (ym) allCandidateYears.add(ym[1]);
          }
        }
      }
    }

    // 3. POSITIVE EVIDENCE VALIDATION CHECKS

    // A. Check for quantitative metrics in proposed text
    const proposedMetrics = this.extractMetricsFromText(proposedText);
    for (const metric of proposedMetrics) {
      const metricLower = metric.toLowerCase().trim();
      let matched = verifiedMetrics.has(metricLower);

      if (!matched) {
        matched = verifiedContentTexts.some((text) => text.includes(metricLower));
      }

      if (!matched) {
        unsupportedClaims.metrics.push(metric);
        reasons.push(
          `Proposed text introduces quantitative metric '${metric}' not found in cited approved knowledge.`
        );
      }
    }

    // B. Check for unsupported leadership / team size claims
    const leadershipTeamMatch = proposedText.match(
      /\b(?:led|managed|directed|supervised|headed)\s+(?:a\s+)?team\s+of\s+(\d+)\b|\bteam\s+of\s+(\d+)\s+(?:engineers|developers|designers|members|people)\b/i
    );
    if (leadershipTeamMatch) {
      const teamSize = leadershipTeamMatch[1] || leadershipTeamMatch[2];
      const verifiedLeadershipClaim = verifiedContentTexts.some(
        (t) => t.includes(`team of ${teamSize}`) || t.includes(`team of ${teamSize} `)
      );

      if (!verifiedLeadershipClaim) {
        unsupportedClaims.unsupportedEntities.push(`team size ${teamSize}`);
        reasons.push(
          `Proposed text claims leadership of a team of ${teamSize}, which is not supported by candidate's verified evidence.`
        );
      }
    }

    // C. Check for unsupported employer claims
    const employerClaimMatch = proposedText.match(
      /\b(?:at|for)\s+([A-Z][a-zA-Z0-9\s]{2,25}?)(?:,|\.|\s+(?:developed|led|built|spearheaded|architected|engineered|worked|scaled|managed|served|contributed))/i
    );
    if (employerClaimMatch) {
      const claimedEmployer = employerClaimMatch[1].trim().toLowerCase();
      const isKnownEmployer =
        verifiedEmployers.has(claimedEmployer) ||
        allCandidateEmployers.has(claimedEmployer) ||
        (contextLabel && contextLabel.toLowerCase().includes(claimedEmployer));

      // Check common non-employer capitalized words
      const nonEmployers = new Set([
        'the',
        'our',
        'my',
        'various',
        'several',
        'each',
        'all',
        'high',
        'multiple'
      ]);
      if (!isKnownEmployer && !nonEmployers.has(claimedEmployer) && claimedEmployer.length > 3) {
        unsupportedClaims.unsupportedEntities.push(`Employer: ${employerClaimMatch[1].trim()}`);
        reasons.push(
          `Proposed text references employer '${employerClaimMatch[1].trim()}' not present in candidate's approved work history.`
        );
        return {
          isValid: false,
          status: 'REJECTED',
          userFacingStatus: 'Requires Candidate Review',
          reasons,
          traces,
          unsupportedClaims
        };
      }
    }

    // D. Check for unsupported date range claims (e.g. "2022–2025" when candidate only worked from 2024)
    const dateRangeMatch = proposedText.match(/\b(20\d\d)\s*[-–—]\s*(20\d\d)\b/);
    if (dateRangeMatch) {
      const startYear = dateRangeMatch[1];
      const endYear = dateRangeMatch[2];
      const hasStartYear = allCandidateYears.has(startYear);
      const hasEndYear = allCandidateYears.has(endYear) || endYear === '2026';

      if ((!hasStartYear || !hasEndYear) && allCandidateYears.size > 0) {
        unsupportedClaims.unsupportedEntities.push(`Year range ${startYear}–${endYear}`);
        reasons.push(
          `Proposed text claims date range '${startYear}–${endYear}' not matching candidate's verified employment dates.`
        );
      }
    }

    // E. Check for claimed technologies that do not exist in candidate Knowledge Bank
    const techPattern =
      /\b(?:using|with|in|via)\s+([A-Z][a-zA-Z0-9.#+]+(?:\s+[A-Z][a-zA-Z0-9.#+]+)?)\b/g;
    let match: RegExpExecArray | null;
    while ((match = techPattern.exec(proposedText)) !== null) {
      const candidateTech = match[1].toLowerCase().trim();
      const commonWords = new Set([
        'the',
        'a',
        'an',
        'high',
        'low',
        'deep',
        'full',
        'end',
        'real',
        'best',
        'agile',
        'clean',
        'scalable',
        'modern',
        'cross',
        'fast',
        'great',
        'our',
        'team',
        'proven'
      ]);
      if (commonWords.has(candidateTech) || candidateTech.length < 3) continue;

      // Check if this technical term exists in candidate's skills or projects
      const isKnownSkill =
        verifiedSkills.has(candidateTech) ||
        allCandidateSkills.has(candidateTech) ||
        verifiedContentTexts.some((t) => t.includes(candidateTech));

      if (!isKnownSkill) {
        // Check if candidate actually lacks this technology
        unsupportedClaims.unsupportedEntities.push(`Technology: ${match[1].trim()}`);
        reasons.push(
          `Proposed text claims usage of '${match[1].trim()}', which is not present in candidate's approved Knowledge Bank.`
        );
      }
    }

    // F. Also check standard technologies identified by extractTechnologiesFromText
    const extractedTechs = this.extractTechnologiesFromText(proposedText);
    for (const tech of extractedTechs) {
      const techLower = tech.toLowerCase().trim();
      const isKnown =
        verifiedSkills.has(techLower) ||
        allCandidateSkills.has(techLower) ||
        verifiedContentTexts.some((t) => t.includes(techLower));

      if (
        !isKnown &&
        !unsupportedClaims.unsupportedEntities.some((e) => e.toLowerCase().includes(techLower))
      ) {
        unsupportedClaims.unsupportedEntities.push(`Technology: ${tech}`);
        reasons.push(
          `Proposed text claims usage of '${tech}', which is not present in candidate's approved Knowledge Bank.`
        );
      }
    }

    // 4. DETERMINE OVERALL STATUS (NON-CIRCULAR)
    if (unsupportedClaims.metrics.length > 0 || unsupportedClaims.unsupportedEntities.length > 0) {
      return {
        isValid: true, // Flagged for human review, not silently approved
        status: 'REQUIRES_REVIEW',
        userFacingStatus: 'Requires Candidate Review',
        reasons,
        traces,
        unsupportedClaims
      };
    }

    return {
      isValid: true,
      status: 'GROUNDED',
      userFacingStatus: 'Grounded in your Knowledge Bank',
      reasons:
        reasons.length > 0 ? reasons : ['All claims verified against approved candidate evidence.'],
      traces,
      unsupportedClaims
    };
  }

  /**
   * Helper to validate a batch of proposed resume changes.
   */
  validateResumeChanges(
    changes: Array<{
      id?: string;
      originalContent: string;
      proposedContent: string;
      sourceKnowledgeItemIds: string[];
      section: string;
    }>,
    candidateId: string,
    candidateApprovedKnowledge: KnowledgeItem[]
  ): Array<{
    changeId?: string;
    validation: GroundingValidationResult;
  }> {
    return changes.map((c) => ({
      changeId: c.id,
      validation: this.validateClaim({
        proposedText: c.proposedContent,
        originalText: c.originalContent,
        sourceKnowledgeItemIds: c.sourceKnowledgeItemIds,
        candidateId,
        candidateApprovedKnowledge,
        contextLabel: `section: ${c.section}`
      })
    }));
  }

  /**
   * Extracts quantitative metric patterns (percentages, multipliers, scale, latencies)
   */
  private extractMetricsFromText(text: string): string[] {
    if (!text) return [];
    const metrics: string[] = [];

    // 1. Percentages (e.g. "82%", "40.5%")
    const percentageMatches = text.match(/\b\d+(?:\.\d+)?%/g);
    if (percentageMatches) {
      metrics.push(...percentageMatches);
    }

    // 2. Multipliers (e.g. "3x", "10x")
    const multiplierMatches = text.match(/\b\d+(?:\.\d+)?x\b/gi);
    if (multiplierMatches) {
      metrics.push(...multiplierMatches);
    }

    // 3. Durations with numbers (e.g. "420ms", "5 years", "10 months")
    const durationMatches = text.match(
      /\b\d+\s*(?:ms|seconds|minutes|hours|days|weeks|months|years)\b/gi
    );
    if (durationMatches) {
      metrics.push(...durationMatches);
    }

    // 4. Quantified scale / users (e.g. "120k", "10M", "500K")
    const scaleMatches = text.match(/\b\d+\s*(?:k|m|million|billion)\b/gi);
    if (scaleMatches) {
      metrics.push(...scaleMatches);
    }

    return Array.from(new Set(metrics));
  }

  /**
   * Extracts technologies and tools from text snippet
   */
  private extractTechnologiesFromText(text: string): string[] {
    if (!text) return [];
    const techMatches = text.match(
      /\b(?:python|postgres|postgresql|node(?:\.js)?|react(?:\.js)?|next(?:\.js)?|typescript|javascript|docker|kafka|aws|gcp|azure|sql|redis|graphql|rest|ci\/cd|kubernetes|golang|rust|java|c\+\+|ruby|rails|django|fastapi|flask|linux|git)\b/gi
    );

    const found = new Set<string>();
    if (techMatches) {
      techMatches.forEach((t) => found.add(t.toLowerCase().trim()));
    }

    return Array.from(found);
  }

  /**
   * Helper to determine if a text snippet makes concrete factual assertions
   * (e.g. specific employers, metrics, dates, or technical building claims)
   * requiring explicit Knowledge Bank evidence.
   */
  detectFactualClaims(text: string): boolean {
    if (!text) return false;

    // 1. Quantitative metrics (percentages, multipliers, scale)
    if (this.extractMetricsFromText(text).length > 0) return true;

    // 2. Team sizes or numerical leadership claims
    if (/\b(?:team\s+of\s+\d+|led\s+\d+)\b/i.test(text)) return true;

    // 3. Employer claims ("at Microsoft", "for Stripe", etc.)
    if (
      /\b(?:at|for)\s+([A-Z][a-zA-Z0-9\s]{2,25}?)(?:,|\.|\s+(?:developed|led|built|spearheaded|architected|engineered|worked|scaled|managed|served|contributed))/i.test(
        text
      )
    ) {
      return true;
    }

    // 4. Date ranges ("2022-2025")
    if (/\b(19\d\d|20\d\d)\s*[-–—]\s*(19\d\d|20\d\d)\b/.test(text)) return true;

    // 5. Concrete technology implementations ("built ... with Kubernetes", "using Python", etc.)
    const techMatches = this.extractTechnologiesFromText(text);
    const implementationVerbs =
      /\b(?:built|engineered|developed|architected|deployed|created|implemented|maintained|scaled)\b/i;
    if (techMatches.length > 0 && implementationVerbs.test(text)) {
      return true;
    }

    return false;
  }
}

export const positiveGroundingValidator = new PositiveGroundingValidator();
