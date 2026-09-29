import { Job, JobAnalysis, ResumeVersion } from '@/types/domain';
import { RetrievedCandidateKnowledge, ResumeChange } from '@/types/tailoring';
import { ResumeTailorProvider } from './resume-tailor-provider';
import { aiOrchestrator } from '@/lib/ai/ai-orchestrator';
import { ResumeTailorInput, ResumeTailorOutput } from '@/lib/ai/task-types';

export class LLMResumeTailorProvider implements ResumeTailorProvider {
  async generateProposedChanges(
    job: Job,
    _analysis: JobAnalysis,
    masterResume: ResumeVersion,
    retrievedKnowledge: RetrievedCandidateKnowledge
  ): Promise<ResumeChange[]> {
    const candidateId = masterResume.candidateId;
    const resumeVersionId = `res-tailored-${job.id}`;

    // Handle empty candidate knowledge bank gracefully without fabricating unsupported experience
    if (!retrievedKnowledge.items || retrievedKnowledge.items.length === 0) {
      return [];
    }

    // Prepare strictly typed input for RESUME_TAILOR task
    const tailorInput: ResumeTailorInput = {
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        targetRole: job.title,
        description: job.description || '',
        responsibilities: job.responsibilities || [],
        requiredSkills: job.requiredSkills || [],
        preferredSkills: job.preferredSkills || []
      },
      masterResume: {
        id: masterResume.id,
        summary: masterResume.summary || '',
        experience: (masterResume.experience || []).map((e) => ({
          id: e.id,
          employer: e.employer,
          role: e.role,
          responsibilities: e.responsibilities || [],
          achievements: e.achievements || []
        })),
        skills: {
          technical: masterResume.skills?.technical || [],
          tools: masterResume.skills?.tools || [],
          soft: masterResume.skills?.soft || [],
          other: masterResume.skills?.other || []
        },
        projects: (masterResume.projects || []).map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          technologies: p.technologies || [],
          contributions: p.contributions || ''
        }))
      },
      approvedKnowledge: retrievedKnowledge.items.map((k) => ({
        knowledgeItemId: k.knowledgeItemId,
        category: k.category,
        title: k.title,
        supportingSnippet: k.supportingSnippet
      }))
    };

    // Dispatch typed RESUME_TAILOR task via AIOrchestrator
    const { data } = await aiOrchestrator.dispatch<ResumeTailorOutput>(
      'RESUME_TAILOR',
      tailorInput,
      { candidateId }
    );

    if (!data.proposedChanges || data.proposedChanges.length === 0) {
      return [];
    }

    // Map AI proposals to standard domain ResumeChange objects
    // NOTE: grounded is initially set to false — PositiveGroundingValidator in
    // ResumeTailoringService is authoritative and performs domain-level validation.
    return data.proposedChanges.map((proposal, idx) => ({
      id: `change-${job.id}-${proposal.section}-${idx + 1}`,
      candidateId,
      jobId: job.id,
      resumeVersionId,
      section: proposal.section,
      sectionItemId: proposal.sectionItemId,
      originalContent: proposal.originalContent,
      proposedContent: proposal.proposedContent,
      rationale: proposal.rationale,
      jobRequirement: proposal.jobRequirement,
      sourceCandidateEvidence: proposal.sourceEvidenceSnippet || '',
      sourceKnowledgeItemIds: proposal.sourceKnowledgeItemIds || [],
      evidenceReferences: proposal.sourceEvidenceSnippet ? [proposal.sourceEvidenceSnippet] : [],
      status: 'pending',
      grounded: false
    }));
  }
}

export const llmResumeTailorProvider = new LLMResumeTailorProvider();
