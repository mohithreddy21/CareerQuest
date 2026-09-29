import { careerRepository } from '@/services/career-repository';
import { Job, CandidateProfile, CandidatePreferences } from '@/types/domain';
import { KnowledgeItem } from '@/types/knowledge';
import { RetrievedCandidateKnowledge } from '@/types/tailoring';
import { ApplicationQuestionCategory } from '@/types/preparation';
import { KnowledgeRetrievalProvider } from './providers/knowledge-retrieval-provider';
import { MockKnowledgeRetrievalProvider } from './providers/mock-knowledge-retrieval-provider';

export class KnowledgeRetrievalService {
  constructor(
    private provider: KnowledgeRetrievalProvider = new MockKnowledgeRetrievalProvider()
  ) {}

  async retrieveKnowledgeForJob(
    jobId: string,
    candidateId: string
  ): Promise<RetrievedCandidateKnowledge> {
    const job = await careerRepository.getJobById(jobId, candidateId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const analysis = await careerRepository.getJobAnalysis(jobId);
    if (!analysis) throw new Error(`Job analysis not found for job: ${jobId}`);

    const bank = await careerRepository.getKnowledgeBank(candidateId);

    // 1. COLLECT ALL KNOWLEDGE ASSETS
    const allItems: KnowledgeItem[] = [
      ...bank.skills,
      ...bank.experiences,
      ...bank.projects,
      ...bank.education,
      ...bank.certifications,
      ...bank.achievements
    ];

    // 2. CRITICAL SAFETY INVARIANT: ONLY APPROVED KNOWLEDGE IS PERMITTED
    // Rejected, archived, deleted, or proposed claims are strictly excluded.
    const approvedItems = allItems.filter(
      (item) => item.status === 'approved' && item.candidateId === candidateId
    );

    // 3. CALL RETRIEVAL PROVIDER
    const retrievalResult = await this.provider.retrieveRelevantKnowledge(
      job,
      analysis,
      approvedItems
    );

    // 4. DOMAIN LEVEL SAFETY VALIDATION
    // The provider is NEVER trusted implicitly. Ensure every returned item references
    // an actual approved item in the candidate's Knowledge Bank.
    const approvedIdSet = new Set(approvedItems.map((i) => i.id));
    const validatedItems = retrievalResult.items.filter((retItem) => {
      const isApproved = approvedIdSet.has(retItem.knowledgeItemId);
      if (!isApproved) {
        // eslint-disable-next-line no-console
        console.warn(
          `[KnowledgeRetrievalService] Dropped unapproved knowledge item reference: ${retItem.knowledgeItemId}`
        );
      }
      return isApproved;
    });

    return {
      ...retrievalResult,
      items: validatedItems
    };
  }

  /**
   * Retrieves 3–6 strong, authoritative evidence anchors for cover letter generation.
   * Prioritizes:
   * 1. Relevant work experiences matching role/company/skills
   * 2. Relevant verified skills directly matching job requirements
   * 3. Relevant projects demonstrating practical application
   * 4. Relevant achievements & certifications
   * Strictly excludes unapproved or other candidates' items.
   */
  async retrieveKnowledgeForCoverLetter(
    job: Job,
    candidateId: string,
    approvedKnowledge?: KnowledgeItem[]
  ): Promise<KnowledgeItem[]> {
    let approvedItems = approvedKnowledge;
    if (!approvedItems) {
      const bank = await careerRepository.getKnowledgeBank(candidateId);
      const allItems: KnowledgeItem[] = [
        ...bank.skills,
        ...bank.experiences,
        ...bank.projects,
        ...bank.education,
        ...bank.certifications,
        ...bank.achievements
      ];
      approvedItems = allItems.filter(
        (item) => item.status === 'approved' && item.candidateId === candidateId
      );
    } else {
      approvedItems = approvedItems.filter(
        (item) => item.status === 'approved' && item.candidateId === candidateId
      );
    }

    const jobSkills = new Set(
      [...(job.requiredSkills || []), ...(job.preferredSkills || [])].map((s) =>
        s.toLowerCase().trim()
      )
    );

    // 1. Experiences
    const experiences = approvedItems.filter((i) => i.category === 'experience');
    const selectedExperiences = experiences.slice(0, 2);

    // 2. Matching skills
    const matchingSkills = approvedItems
      .filter((i) => {
        if (i.category !== 'skill') return false;
        const content = i.content as { name?: string };
        const name = content?.name?.toLowerCase().trim() || '';
        return (
          jobSkills.has(name) ||
          Array.from(jobSkills).some((js) => name.includes(js) || js.includes(name))
        );
      })
      .slice(0, 3);

    // 3. Projects
    const projects = approvedItems.filter((i) => i.category === 'project').slice(0, 2);

    // 4. Achievements & certifications
    const achievements = approvedItems
      .filter((i) => i.category === 'achievement' || i.category === 'certification')
      .slice(0, 1);

    // Combine and limit to 3–6 items
    const combined = [...selectedExperiences, ...matchingSkills, ...projects, ...achievements];
    const unique = Array.from(new Map(combined.map((item) => [item.id, item])).values());

    return unique.slice(0, 6);
  }

  /**
   * Task-aware retrieval for specific application questions based on question category.
   * If required evidence is missing (e.g. unknown technology, missing salary/eligibility preferences),
   * returns hasSufficientEvidence: false with a clean missingEvidenceNote instead of hallucinating.
   */
  async retrieveKnowledgeForQuestion(params: {
    question: string;
    category: ApplicationQuestionCategory;
    job: Job;
    candidateId: string;
    approvedKnowledge?: KnowledgeItem[];
    candidateProfile?: CandidateProfile | null;
    candidatePreferences?: CandidatePreferences | null;
  }): Promise<{
    items: KnowledgeItem[];
    hasSufficientEvidence: boolean;
    missingEvidenceNote: string | null;
  }> {
    const { question, category, candidateId } = params;

    let approvedItems = params.approvedKnowledge;
    if (!approvedItems) {
      const bank = await careerRepository.getKnowledgeBank(candidateId);
      const allItems: KnowledgeItem[] = [
        ...bank.skills,
        ...bank.experiences,
        ...bank.projects,
        ...bank.education,
        ...bank.certifications,
        ...bank.achievements
      ];
      approvedItems = allItems.filter(
        (item) => item.status === 'approved' && item.candidateId === candidateId
      );
    } else {
      approvedItems = approvedItems.filter(
        (item) => item.status === 'approved' && item.candidateId === candidateId
      );
    }

    switch (category) {
      case 'compensation': {
        const prefs =
          params.candidatePreferences ||
          (await careerRepository.getCandidatePreferences(candidateId));
        if (!prefs || !prefs.targetSalaryMin) {
          return {
            items: [],
            hasSufficientEvidence: false,
            missingEvidenceNote:
              'Your target compensation expectations are not configured in your candidate preferences.'
          };
        }
        return {
          items: [],
          hasSufficientEvidence: true,
          missingEvidenceNote: null
        };
      }

      case 'eligibility': {
        const profile =
          params.candidateProfile || (await careerRepository.getCandidateProfile(candidateId));
        const edu = approvedItems.filter((i) => i.category === 'education');
        const certs = approvedItems.filter((i) => i.category === 'certification');
        if (!profile && edu.length === 0 && certs.length === 0) {
          return {
            items: [],
            hasSufficientEvidence: false,
            missingEvidenceNote:
              'Your work authorization and legal eligibility records are not configured in your profile.'
          };
        }
        return {
          items: [...edu, ...certs].slice(0, 2),
          hasSufficientEvidence: false,
          missingEvidenceNote:
            'Please verify and confirm your official work authorization and eligibility status for this role.'
        };
      }

      case 'logistics': {
        const prefs =
          params.candidatePreferences ||
          (await careerRepository.getCandidatePreferences(candidateId));
        if (!prefs || (!prefs.workArrangements?.length && !prefs.preferredLocations?.length)) {
          return {
            items: [],
            hasSufficientEvidence: false,
            missingEvidenceNote:
              'Your start date availability, location, and work arrangement preferences are not configured.'
          };
        }
        return {
          items: [],
          hasSufficientEvidence: true,
          missingEvidenceNote: null
        };
      }

      case 'technical': {
        const techTerms = question.match(
          /\b(?:postgresql|postgres|kubernetes|k8s|python|docker|kafka|aws|gcp|azure|react|typescript|golang|rust|java|redis|graphql|rest|ci\/cd|sql|next\.?js|node\.?js)\b/gi
        );

        if (techTerms && techTerms.length > 0) {
          const matchedItems = approvedItems.filter((item) => {
            const contentStr = JSON.stringify(item.content).toLowerCase();
            return techTerms.some((term) => contentStr.includes(term.toLowerCase()));
          });

          if (matchedItems.length === 0) {
            const missingTech = techTerms[0];
            return {
              items: [],
              hasSufficientEvidence: false,
              missingEvidenceNote: `Your approved Knowledge Bank contains no verified experience with '${missingTech}'. Please enter details if you have experience with this technology.`
            };
          }

          return {
            items: matchedItems.slice(0, 3),
            hasSufficientEvidence: true,
            missingEvidenceNote: null
          };
        }

        const techSkills = approvedItems.filter(
          (i) => i.category === 'skill' || i.category === 'project'
        );
        return {
          items: techSkills.slice(0, 3),
          hasSufficientEvidence: techSkills.length > 0,
          missingEvidenceNote:
            techSkills.length === 0
              ? 'No verified technical skills or projects found in your Knowledge Bank.'
              : null
        };
      }

      case 'behavioral': {
        const behavioralItems = approvedItems.filter(
          (i) =>
            i.category === 'project' || i.category === 'experience' || i.category === 'achievement'
        );
        if (behavioralItems.length === 0) {
          return {
            items: [],
            hasSufficientEvidence: false,
            missingEvidenceNote:
              'No verified projects or work experience records found to anchor a behavioral response.'
          };
        }
        return {
          items: behavioralItems.slice(0, 3),
          hasSufficientEvidence: true,
          missingEvidenceNote: null
        };
      }

      case 'motivation': {
        const relevant = approvedItems.filter(
          (i) => i.category === 'project' || i.category === 'skill' || i.category === 'experience'
        );
        return {
          items: relevant.slice(0, 3),
          hasSufficientEvidence: true,
          missingEvidenceNote: null
        };
      }

      default: {
        return {
          items: approvedItems.slice(0, 2),
          hasSufficientEvidence: true,
          missingEvidenceNote: null
        };
      }
    }
  }
}

export const knowledgeRetrievalService = new KnowledgeRetrievalService();
