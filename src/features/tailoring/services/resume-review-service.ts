import { careerRepository } from '@/services/career-repository';
import { ResumeChangeStatus, TailoredResumeVersion } from '@/types/tailoring';
import { ResumeVersion } from '@/types/domain';
import { knowledgeRetrievalService } from './knowledge-retrieval-service';
import { resumeTailoringService } from './resume-tailoring-service';

export class ResumeReviewService {
  /**
   * Loads or creates a tailored resume version for the given job.
   */
  async getOrCreateTailoredResume(
    jobId: string,
    candidateId: string
  ): Promise<TailoredResumeVersion> {
    const existing = await careerRepository.getTailoredResumeForJob(jobId, candidateId);
    if (existing && existing.changes.length > 0) {
      return existing;
    }

    const job = await careerRepository.getJobById(jobId, candidateId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const analysis = await careerRepository.getJobAnalysis(jobId);
    if (!analysis) throw new Error(`Job analysis not found for job: ${jobId}`);

    let masterResume: ResumeVersion | null = await careerRepository.getMasterResume(candidateId);
    if (!masterResume) {
      const candProfile = await careerRepository.getCandidateProfile(candidateId);
      masterResume = {
        id: `res-master-${candidateId}`,
        candidateId,
        jobId: '',
        title: 'Master Resume',
        targetRole: candProfile.targetRoles?.[0] || 'Professional',
        summary: candProfile.professionalSummary || '',
        experience: candProfile.experience || [],
        education: candProfile.education || [],
        skills: candProfile.skills || { technical: [], tools: [], soft: [], other: [] },
        projects: candProfile.projects || [],
        certifications: candProfile.certifications || [],
        approvalState: 'approved',
        changes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    const activeMasterResume: ResumeVersion = masterResume;

    // 1. Retrieve approved knowledge
    const retrievedKnowledge = await knowledgeRetrievalService.retrieveKnowledgeForJob(
      jobId,
      candidateId
    );

    // 2. Generate grounded changes
    const groundedChanges = await resumeTailoringService.generateGroundedChanges(
      job,
      analysis,
      activeMasterResume,
      retrievedKnowledge
    );

    // 3. Assemble initial tailored version
    const initialVersion: TailoredResumeVersion = {
      id: `res-tailored-${job.id}`,
      candidateId,
      masterResumeId: activeMasterResume.id,
      jobId: job.id,
      targetCompany: job.company,
      targetRole: job.title,
      title: `Tailored Resume — ${job.title} (${job.company})`,
      summary: activeMasterResume.summary,
      experience: JSON.parse(JSON.stringify(activeMasterResume.experience)),
      education: JSON.parse(JSON.stringify(activeMasterResume.education)),
      skills: JSON.parse(JSON.stringify(activeMasterResume.skills)),
      projects: JSON.parse(JSON.stringify(activeMasterResume.projects)),
      certifications: JSON.parse(JSON.stringify(activeMasterResume.certifications)),
      changes: groundedChanges,
      approvalState: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 4. Save to repository (immutable master preserved)
    await careerRepository.saveResumeVersion(initialVersion);
    return initialVersion;
  }

  /**
   * Updates an individual change's review status (approve / reject / pending).
   */
  async updateChangeStatus(
    resumeVersionId: string,
    changeId: string,
    status: ResumeChangeStatus,
    candidateId?: string
  ): Promise<TailoredResumeVersion> {
    const resume = await careerRepository.getResumeVersionById(resumeVersionId, candidateId);
    if (!resume) throw new Error(`Resume version not found: ${resumeVersionId}`);

    const change = resume.changes.find((c) => c.id === changeId);
    if (!change) throw new Error(`Change not found: ${changeId}`);

    change.status = status;
    resume.updatedAt = new Date().toISOString();

    // Re-compile resume snapshot
    this.compileResumeContent(resume);

    await careerRepository.saveResumeVersion(resume, candidateId);
    return resume;
  }

  /**
   * Saves candidate's custom edits to a proposed change.
   */
  async editChangeContent(
    resumeVersionId: string,
    changeId: string,
    editedContent: string,
    candidateId?: string
  ): Promise<TailoredResumeVersion> {
    const resume = await careerRepository.getResumeVersionById(resumeVersionId, candidateId);
    if (!resume) throw new Error(`Resume version not found: ${resumeVersionId}`);

    const change = resume.changes.find((c) => c.id === changeId);
    if (!change) throw new Error(`Change not found: ${changeId}`);

    change.editedContent = editedContent;
    change.status = 'edited';
    resume.updatedAt = new Date().toISOString();

    // Re-compile resume snapshot
    this.compileResumeContent(resume);

    await careerRepository.saveResumeVersion(resume, candidateId);
    return resume;
  }

  /**
   * Approves all pending changes in a single safe operation.
   * Does NOT touch previously rejected changes.
   */
  async approveAllPendingChanges(
    resumeVersionId: string,
    candidateId?: string
  ): Promise<TailoredResumeVersion> {
    const resume = await careerRepository.getResumeVersionById(resumeVersionId, candidateId);
    if (!resume) throw new Error(`Resume version not found: ${resumeVersionId}`);

    resume.changes.forEach((c) => {
      if (c.status === 'pending') {
        c.status = 'approved';
      }
    });

    resume.approvalState = 'approved';
    resume.updatedAt = new Date().toISOString();

    this.compileResumeContent(resume);

    await careerRepository.saveResumeVersion(resume, candidateId);
    return resume;
  }

  /**
   * Compiles the tailored resume snapshot by applying approved/edited changes.
   * Master Resume is NEVER touched.
   */
  private compileResumeContent(resume: TailoredResumeVersion): void {
    for (const change of resume.changes) {
      const activeText =
        change.status === 'approved'
          ? change.proposedContent
          : change.status === 'edited'
            ? change.editedContent || change.proposedContent
            : change.originalContent;

      if (change.section === 'summary') {
        resume.summary = activeText;
      } else if (change.section === 'experience' && change.sectionItemId) {
        const exp = resume.experience.find((e) => e.id === change.sectionItemId);
        if (exp) {
          const rIdx = exp.responsibilities.findIndex(
            (r) => r.trim() === change.originalContent.trim()
          );
          if (rIdx >= 0) {
            exp.responsibilities[rIdx] = activeText;
          }
        }
      } else if (change.section === 'projects' && change.sectionItemId) {
        const proj = resume.projects.find((p) => p.id === change.sectionItemId);
        if (proj && proj.contributions.trim() === change.originalContent.trim()) {
          proj.contributions = activeText;
        }
      } else if (
        change.section === 'skills' &&
        (change.status === 'approved' || change.status === 'edited')
      ) {
        const skillsArray = activeText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        resume.skills.technical = skillsArray;
      }
    }

    const allResolved = resume.changes.every(
      (c) => c.status === 'approved' || c.status === 'edited'
    );
    if (allResolved && resume.changes.length > 0) {
      resume.approvalState = 'approved';
    }
  }
}

export const resumeReviewService = new ResumeReviewService();
