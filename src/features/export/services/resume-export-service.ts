import { TailoredResumeVersion } from '@/types/tailoring';
import { CandidateProfile } from '@/types/domain';
import { ResumeTemplate, ResumeExport } from '@/types/templates';
import { extractResumeContent } from '@/types/resume-content';
import { generateResumePdf } from './pdf-exporter';
import { generateResumeDocx } from './docx-exporter';

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportResumeDocument({
  resume,
  template,
  format,
  candidate
}: {
  resume: TailoredResumeVersion;
  template: ResumeTemplate;
  format: 'pdf' | 'docx';
  candidate?: CandidateProfile | null;
}): Promise<ResumeExport> {
  const content = extractResumeContent(resume, candidate);
  const safeName = (content.identity.fullName || 'Resume')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  const safeCompany = (resume.targetCompany || 'job').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const filename = `${safeName}_resume_${safeCompany}_${template.id}.${format}`;

  if (format === 'pdf') {
    const doc = generateResumePdf(content, template);
    doc.save(filename);
  } else if (format === 'docx') {
    const blob = await generateResumeDocx(content, template);
    triggerBrowserDownload(blob, filename);
  }

  const exportRecord: ResumeExport = {
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    candidateId: resume.candidateId,
    tailoredResumeVersionId: resume.id,
    templateId: template.id,
    templateVersion: template.version,
    format,
    filename,
    createdAt: new Date().toISOString()
  };

  return exportRecord;
}
