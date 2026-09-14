import { CandidateProfile, TailoredResumeVersion } from './domain';

export interface ResumeIdentity {
  fullName: string;
  targetRole: string;
  targetCompany?: string;
  email: string;
  phone?: string;
  location: string;
  links?: { label: string; url: string }[];
}

export interface ResumeContentExperience {
  id: string;
  employer: string;
  role: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  bullets: string[];
}

export interface ResumeContentProject {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  bullets: string[];
  url?: string;
}

export interface ResumeContentEducation {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate?: string;
  details?: string;
}

export interface ResumeContentCertification {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  credentialId?: string;
}

export interface ResumeContent {
  identity: ResumeIdentity;
  summary: string;
  skills: {
    technical: string[];
    tools: string[];
    soft: string[];
  };
  experience: ResumeContentExperience[];
  projects: ResumeContentProject[];
  education: ResumeContentEducation[];
  certifications: ResumeContentCertification[];
}

/**
 * Extracts normalized, structured ResumeContent from a finalized or draft TailoredResumeVersion
 * and optional CandidateProfile metadata.
 */
export function extractResumeContent(
  resume: TailoredResumeVersion,
  candidate?: Partial<CandidateProfile> | null
): ResumeContent {
  const candidateName = candidate?.name || 'Alex Chen';
  const candidateEmail = candidate?.email || 'alex.chen@example.com';
  const candidatePhone = candidate?.phone || '+1 (555) 234-5678';
  const candidateLocation = candidate?.location || 'San Francisco, CA';

  return {
    identity: {
      fullName: candidateName,
      targetRole: resume.targetRole || 'Senior Software Engineer',
      targetCompany: resume.targetCompany || undefined,
      email: candidateEmail,
      phone: candidatePhone,
      location: candidateLocation,
      links: [
        { label: 'GitHub', url: 'https://github.com/alexchen' },
        { label: 'LinkedIn', url: 'https://linkedin.com/in/alexchen' }
      ]
    },
    summary: resume.summary,
    skills: {
      technical: [...(resume.skills?.technical || [])],
      tools: [...(resume.skills?.tools || [])],
      soft: [...(resume.skills?.soft || [])]
    },
    experience: (resume.experience || []).map((exp) => ({
      id: exp.id,
      employer: exp.employer,
      role: exp.role,
      location: exp.location,
      startDate: exp.startDate,
      endDate: exp.endDate,
      isCurrent: exp.isCurrent,
      bullets: [...(exp.responsibilities || []), ...(exp.achievements || [])]
    })),
    projects: (resume.projects || []).map((proj) => ({
      id: proj.id,
      name: proj.name,
      description: proj.description,
      technologies: [...(proj.technologies || [])],
      bullets: [proj.contributions, ...(proj.outcomes ? [proj.outcomes] : [])].filter(Boolean),
      url: proj.url
    })),
    education: (resume.education || []).map((edu) => ({
      id: edu.id,
      institution: edu.institution,
      degree: edu.degree,
      fieldOfStudy: edu.fieldOfStudy,
      startDate: edu.startDate,
      endDate: edu.endDate,
      details: edu.details
    })),
    certifications: (resume.certifications || []).map((cert) => ({
      id: cert.id,
      name: cert.name,
      issuer: cert.issuer,
      issueDate: cert.issueDate,
      credentialId: cert.credentialId
    }))
  };
}
