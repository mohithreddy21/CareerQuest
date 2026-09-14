import {
  CandidateProfile,
  Job,
  JobAnalysis,
  JobMatch,
  MatchPoint,
  CandidateEvidencePoint
} from '@/types/domain';
import { MatchProvider } from './match-service';

export class MockMatchProvider implements MatchProvider {
  async calculateMatch(
    job: Job,
    analysis: JobAnalysis,
    candidate: CandidateProfile
  ): Promise<JobMatch> {
    const strongMatches: MatchPoint[] = [];
    const partialMatches: MatchPoint[] = [];
    const missingRequirements: MatchPoint[] = [];
    const supportingCandidateEvidence: CandidateEvidencePoint[] = [];

    // Verified skills set (lowercase)
    const verifiedTechnical = new Set(
      (candidate.skills.technical || []).map((s) => s.toLowerCase())
    );
    const verifiedTools = new Set((candidate.skills.tools || []).map((s) => s.toLowerCase()));
    const verifiedSoft = new Set((candidate.skills.soft || []).map((s) => s.toLowerCase()));

    // Helper: Find verified candidate evidence snippet for a given skill or domain keyword
    const findVerifiedEvidence = (keyword: string): { source: string; snippet: string } | null => {
      const kw = keyword.toLowerCase();

      // Check experience at Veloce Labs (SSR, Next.js, App Router, latency, WebSocket, mentorship)
      const veloce = candidate.experience.find((e) => e.employer.toLowerCase().includes('veloce'));
      if (veloce) {
        if (/next\.?js|react|frontend|ssr|performance|latency|ui/i.test(kw)) {
          return {
            source: 'Veloce Labs (Senior Full-Stack Engineer)',
            snippet:
              'Led migration of legacy client application to Next.js App Router and React 19, reducing p95 initial page load from 2.4s to 420ms.'
          };
        }
        if (/real-?time|websocket|collaboration|sync/i.test(kw)) {
          return {
            source: 'Veloce Labs (Senior Full-Stack Engineer)',
            snippet:
              'Architected real-time collaboration engine using WebSocket pub/sub, decreasing state sync latency by 65%.'
          };
        }
        if (/mentor|lead|leadership|code review/i.test(kw)) {
          return {
            source: 'Veloce Labs (Senior Full-Stack Engineer)',
            snippet:
              'Mentored 4 mid-level engineers across frontend architecture, TypeScript conventions, and testing standards.'
          };
        }
      }

      // Check experience at Apex Cloud Systems (Billing, PostgreSQL, microservices, design system)
      const apex = candidate.experience.find((e) => e.employer.toLowerCase().includes('apex'));
      if (apex) {
        if (/design system|tailwind|css|tokens|components/i.test(kw)) {
          return {
            source: 'Apex Cloud Systems (Full-Stack Engineer)',
            snippet:
              'Designed and maintained central design system component library in TypeScript/Tailwind, adopted by 6 engineering teams.'
          };
        }
        if (/postgres|database|sql|billing|telemetry|microservice|transaction/i.test(kw)) {
          return {
            source: 'Apex Cloud Systems (Full-Stack Engineer)',
            snippet:
              'Engineered multi-tenant billing & usage telemetry pipelines processing over 4M transactional events daily with PostgreSQL.'
          };
        }
      }

      // Check projects (OpenMetric Dashboard)
      if (/observability|telemetry|open-?source|metrics|dashboard/i.test(kw)) {
        const proj = candidate.projects.find((p) => p.name.toLowerCase().includes('openmetric'));
        if (proj) {
          return {
            source: 'OpenMetric Dashboard (Open Source Project)',
            snippet:
              'Architected core telemetry ingestion engine and real-time visualization widgets in Next.js, TypeScript, and Tailwind CSS.'
          };
        }
      }

      // Check education (Berkeley - Distributed systems)
      if (/distributed systems|computer science/i.test(kw)) {
        const edu = candidate.education[0];
        if (edu) {
          return {
            source: `${edu.institution} (${edu.degree})`,
            snippet: `${edu.degree} in ${edu.fieldOfStudy}. ${edu.details}`
          };
        }
      }

      return null;
    };

    // Evaluate required skills
    for (const skill of job.requiredSkills) {
      const skillLower = skill.toLowerCase();
      const hasDirectSkill =
        verifiedTechnical.has(skillLower) ||
        verifiedTools.has(skillLower) ||
        verifiedSoft.has(skillLower) ||
        Array.from(verifiedTechnical).some((s) => s.includes(skillLower) || skillLower.includes(s));

      const evidence = findVerifiedEvidence(skill);

      if (hasDirectSkill) {
        const point: MatchPoint = {
          title: skill,
          detail: evidence
            ? `Demonstrated production proficiency backed by verified experience.`
            : `Verified skill in candidate master profile.`,
          evidenceSource: evidence?.source,
          evidenceSnippet: evidence?.snippet
        };
        strongMatches.push(point);

        if (evidence) {
          // Avoid duplicate evidence entries
          if (!supportingCandidateEvidence.some((e) => e.evidenceSnippet === evidence.snippet)) {
            supportingCandidateEvidence.push({
              requirementText: `Proficiency with ${skill}`,
              evidenceSource: evidence.source,
              evidenceSnippet: evidence.snippet
            });
          }
        }
      } else {
        // Check if candidate has related/partial skill
        const isPartial =
          (skillLower.includes('kafka') && verifiedTechnical.has('redis')) ||
          (skillLower.includes('go') && verifiedTechnical.has('node.js')) ||
          (skillLower.includes('real-time') && verifiedTechnical.has('websocket'));

        if (isPartial) {
          partialMatches.push({
            title: skill,
            detail: `Candidate demonstrates related experience, though dedicated hands-on specialization with ${skill} is not listed in profile.`
          });
        } else {
          missingRequirements.push({
            title: skill,
            detail: `No verified experience with ${skill} found in your current profile credentials.`
          });
        }
      }
    }

    // Evaluate experience & seniority alignment
    if (analysis.seniority === 'senior' || analysis.seniority === 'lead') {
      const totalYears = 7; // Alex Chen: 2019-06 to Present = ~7 years
      const expEvidence = findVerifiedEvidence('leadership');
      strongMatches.push({
        title: `${analysis.seniority.toUpperCase()} Seniority Level`,
        detail: `Candidate brings ~${totalYears} years of verified full-stack software engineering experience.`,
        evidenceSource: expEvidence?.source,
        evidenceSnippet: expEvidence?.snippet
      });
    }

    // Deterministic Score Calculation
    const totalPoints = strongMatches.length + partialMatches.length + missingRequirements.length;
    let rawScore = 90;
    if (totalPoints > 0) {
      const strongWeight = strongMatches.length * 1.0;
      const partialWeight = partialMatches.length * 0.5;
      const matchRatio = (strongWeight + partialWeight) / totalPoints;
      rawScore = Math.round(matchRatio * 100);
    }

    // Deduct penalty for missing required core skills
    if (missingRequirements.length > 0) {
      rawScore = Math.min(rawScore, 85 - (missingRequirements.length - 1) * 10);
    }
    const score = Math.max(45, Math.min(96, rawScore));

    // Recommendation mapping
    let recommendation: JobMatch['recommendation'] = 'strong';
    if (score >= 88) {
      recommendation = 'strong';
    } else if (score >= 80) {
      recommendation = 'good';
    } else if (score >= 65) {
      recommendation = 'moderate';
    } else {
      recommendation = 'low';
    }

    // Concise, decision-oriented reasoning narrative
    let headline = '';
    let reasoning = '';

    if (recommendation === 'strong') {
      headline = `Strong alignment — High overlap with your verified technical background.`;
      reasoning = `Your verified background with ${strongMatches
        .slice(0, 3)
        .map((m) => m.title)
        .join(
          ', '
        )} provides direct alignment with ${job.company}'s core stack. There are no major missing technical requirements.`;
    } else if (recommendation === 'good') {
      const missingList = missingRequirements.map((m) => m.title).join(', ');
      headline = `Good fit — Solid fundamentals with minor gaps to consider.`;
      reasoning = `You have strong verified proficiency in ${strongMatches
        .slice(0, 2)
        .map((m) => m.title)
        .join(
          ', '
        )}. The primary area lacking direct evidence is ${missingList || 'specialized tool requirements'}.`;
    } else if (recommendation === 'moderate') {
      const missingList = missingRequirements.map((m) => m.title).join(', ');
      headline = `Mixed fit — Review gaps before investing application time.`;
      reasoning = `While your core engineering background aligns with parts of this role, this position requires specific experience in ${missingList || 'domain technologies'} where no evidence is currently recorded in your profile.`;
    } else {
      headline = `Low alignment — Significant mismatch with your current profile.`;
      reasoning = `Several essential requirements for this position (${missingRequirements.map((m) => m.title).join(', ')}) do not match your recorded credentials. Applying may require substantial bridging.`;
    }

    return {
      id: `match-${job.id}`,
      jobId: job.id,
      candidateId: candidate.id,
      score,
      recommendation,
      headline,
      reasoning,
      strongMatches,
      partialMatches,
      missingRequirements,
      supportingCandidateEvidence
    };
  }
}

export const mockMatchProvider = new MockMatchProvider();
