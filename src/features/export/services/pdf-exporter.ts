import { jsPDF } from 'jspdf';
import { ResumeContent } from '@/types/resume-content';
import { ResumeTemplate } from '@/types/templates';

export function generateResumePdf(content: ResumeContent, template: ResumeTemplate): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter'
  });

  const isClassic = template.id === 'classic-v1';
  const isCompact = template.id === 'compact-v1';

  // Page dimensions & margins
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = isCompact ? 36 : 46;
  const contentWidth = pageWidth - margin * 2;

  let y = margin + 10;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin + 10;
    }
  };

  // Fonts
  doc.setFont(isClassic ? 'times' : 'helvetica', 'bold');

  // --- 1. Header ---
  const nameSize = isCompact ? 18 : 22;
  doc.setFontSize(nameSize);
  doc.setTextColor(20, 20, 20);

  if (template.layout.headerAlignment === 'center') {
    doc.text(content.identity.fullName, pageWidth / 2, y, { align: 'center' });
    y += nameSize + 4;

    doc.setFontSize(isCompact ? 10 : 11);
    doc.setFont(isClassic ? 'times' : 'helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    const targetSubtitle =
      content.identity.targetRole +
      (content.identity.targetCompany ? ` — Targeted for ${content.identity.targetCompany}` : '');
    doc.text(targetSubtitle, pageWidth / 2, y, { align: 'center' });
    y += 14;

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const contactLine = `${content.identity.location}  •  ${content.identity.email}  •  ${content.identity.phone || ''}`;
    doc.text(contactLine, pageWidth / 2, y, { align: 'center' });
    y += 18;
  } else {
    doc.text(content.identity.fullName, margin, y);
    y += nameSize + 4;

    doc.setFontSize(isCompact ? 10 : 11);
    doc.setFont(isClassic ? 'times' : 'helvetica', 'normal');
    doc.setTextColor(isClassic ? 70 : 30, isClassic ? 70 : 80, isClassic ? 70 : 180);
    const targetSubtitle =
      content.identity.targetRole +
      (content.identity.targetCompany ? ` — Targeted for ${content.identity.targetCompany}` : '');
    doc.text(targetSubtitle, margin, y);
    y += 14;

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const contactLine = `${content.identity.location}  •  ${content.identity.email}  •  ${content.identity.phone || ''}`;
    doc.text(contactLine, margin, y);
    y += 18;
  }

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.75);
  doc.line(margin, y, pageWidth - margin, y);
  y += isCompact ? 12 : 16;

  // Section heading helper
  const renderSectionHeader = (title: string) => {
    checkPageBreak(30);
    doc.setFont(isClassic ? 'times' : 'helvetica', 'bold');
    doc.setFontSize(isCompact ? 10 : 11);
    doc.setTextColor(30, 30, 30);
    doc.text(title.toUpperCase(), margin, y);
    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += isCompact ? 10 : 14;
  };

  // --- 2. Professional Summary ---
  if (content.summary) {
    renderSectionHeader('Professional Summary');
    doc.setFont(isClassic ? 'times' : 'helvetica', 'normal');
    doc.setFontSize(isCompact ? 9 : 9.5);
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(content.summary, contentWidth);
    checkPageBreak(lines.length * 12 + 8);
    doc.text(lines, margin, y);
    y += lines.length * 12 + (isCompact ? 8 : 12);
  }

  // --- 3. Skills ---
  if (
    content.skills.technical.length > 0 ||
    content.skills.tools.length > 0 ||
    content.skills.soft.length > 0
  ) {
    renderSectionHeader('Technical Skills & Core Competencies');
    doc.setFont(isClassic ? 'times' : 'helvetica', 'normal');
    doc.setFontSize(isCompact ? 8.5 : 9);

    if (content.skills.technical.length > 0) {
      checkPageBreak(14);
      doc.setFont(isClassic ? 'times' : 'helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      const prefix = 'Languages & Frameworks: ';
      doc.text(prefix, margin, y);
      const prefixWidth = doc.getTextWidth(prefix);
      doc.setFont(isClassic ? 'times' : 'helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const skillsText = content.skills.technical.join(', ');
      const skillsLines = doc.splitTextToSize(skillsText, contentWidth - prefixWidth);
      doc.text(skillsLines[0] || '', margin + prefixWidth, y);
      if (skillsLines.length > 1) {
        y += 11;
        doc.text(skillsLines.slice(1), margin, y);
        y += (skillsLines.length - 1) * 11;
      }
      y += 12;
    }

    if (content.skills.tools.length > 0) {
      checkPageBreak(14);
      doc.setFont(isClassic ? 'times' : 'helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      const prefix = 'Infrastructure & Data: ';
      doc.text(prefix, margin, y);
      const prefixWidth = doc.getTextWidth(prefix);
      doc.setFont(isClassic ? 'times' : 'helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const toolsText = content.skills.tools.join(', ');
      const toolsLines = doc.splitTextToSize(toolsText, contentWidth - prefixWidth);
      doc.text(toolsLines[0] || '', margin + prefixWidth, y);
      if (toolsLines.length > 1) {
        y += 11;
        doc.text(toolsLines.slice(1), margin, y);
        y += (toolsLines.length - 1) * 11;
      }
      y += 12;
    }

    if (content.skills.soft.length > 0) {
      checkPageBreak(14);
      doc.setFont(isClassic ? 'times' : 'helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      const prefix = 'Architectural & Domain: ';
      doc.text(prefix, margin, y);
      const prefixWidth = doc.getTextWidth(prefix);
      doc.setFont(isClassic ? 'times' : 'helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const softText = content.skills.soft.join(', ');
      const softLines = doc.splitTextToSize(softText, contentWidth - prefixWidth);
      doc.text(softLines[0] || '', margin + prefixWidth, y);
      if (softLines.length > 1) {
        y += 11;
        doc.text(softLines.slice(1), margin, y);
        y += (softLines.length - 1) * 11;
      }
      y += 12;
    }

    y += isCompact ? 4 : 8;
  }

  // --- 4. Professional Experience ---
  if (content.experience.length > 0) {
    renderSectionHeader('Professional Experience');

    content.experience.forEach((exp) => {
      checkPageBreak(40);
      doc.setFont(isClassic ? 'times' : 'helvetica', 'bold');
      doc.setFontSize(isCompact ? 9.5 : 10);
      doc.setTextColor(20, 20, 20);
      doc.text(exp.role, margin, y);

      doc.setFont(isClassic ? 'times' : 'helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const employerStr = ` — ${exp.employer}${exp.location ? ` (${exp.location})` : ''}`;
      const roleWidth = doc.getTextWidth(exp.role);
      doc.text(employerStr, margin + roleWidth, y);

      const dateStr = `${exp.startDate} – ${exp.isCurrent ? 'Present' : exp.endDate || 'Present'}`;
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      doc.text(dateStr, pageWidth - margin, y, { align: 'right' });
      y += isCompact ? 11 : 13;

      // Bullets
      doc.setFont(isClassic ? 'times' : 'helvetica', 'normal');
      doc.setFontSize(isCompact ? 8.5 : 9);
      doc.setTextColor(50, 50, 50);

      exp.bullets.forEach((bullet) => {
        const bulletLines = doc.splitTextToSize(bullet, contentWidth - 14);
        checkPageBreak(bulletLines.length * 11 + 4);
        doc.text('•', margin + 4, y);
        doc.text(bulletLines, margin + 14, y);
        y += bulletLines.length * 11 + 2;
      });

      y += isCompact ? 4 : 8;
    });
  }

  // --- 5. Projects ---
  if (content.projects.length > 0) {
    renderSectionHeader('Key Projects & Systems');

    content.projects.forEach((proj) => {
      checkPageBreak(30);
      doc.setFont(isClassic ? 'times' : 'helvetica', 'bold');
      doc.setFontSize(isCompact ? 9 : 9.5);
      doc.setTextColor(20, 20, 20);
      doc.text(proj.name, margin, y);

      if (proj.technologies.length > 0) {
        doc.setFont(isClassic ? 'times' : 'helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(90, 90, 90);
        const nameWidth = doc.getTextWidth(proj.name);
        doc.text(` [${proj.technologies.join(', ')}]`, margin + nameWidth, y);
      }
      y += isCompact ? 10 : 12;

      doc.setFont(isClassic ? 'times' : 'helvetica', 'normal');
      doc.setFontSize(isCompact ? 8.5 : 9);
      doc.setTextColor(50, 50, 50);
      const descLines = doc.splitTextToSize(proj.description, contentWidth);
      checkPageBreak(descLines.length * 11);
      doc.text(descLines, margin, y);
      y += descLines.length * 11 + 2;

      proj.bullets.forEach((bullet) => {
        const bLines = doc.splitTextToSize(bullet, contentWidth - 14);
        checkPageBreak(bLines.length * 11 + 3);
        doc.text('•', margin + 4, y);
        doc.text(bLines, margin + 14, y);
        y += bLines.length * 11 + 2;
      });

      y += isCompact ? 4 : 6;
    });
  }

  // --- 6. Education & Certifications ---
  if (content.education.length > 0 || content.certifications.length > 0) {
    renderSectionHeader('Education & Credentials');

    content.education.forEach((edu) => {
      checkPageBreak(24);
      doc.setFont(isClassic ? 'times' : 'helvetica', 'bold');
      doc.setFontSize(isCompact ? 8.5 : 9);
      doc.setTextColor(30, 30, 30);
      doc.text(`${edu.degree} in ${edu.fieldOfStudy}`, margin, y);

      doc.setFont(isClassic ? 'times' : 'helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(
        `${edu.institution} (${edu.startDate} – ${edu.endDate || 'Present'})`,
        pageWidth - margin,
        y,
        { align: 'right' }
      );
      y += isCompact ? 11 : 13;
    });

    content.certifications.forEach((cert) => {
      checkPageBreak(16);
      doc.setFont(isClassic ? 'times' : 'helvetica', 'bold');
      doc.setFontSize(isCompact ? 8.5 : 9);
      doc.setTextColor(30, 30, 30);
      doc.text(cert.name, margin, y);

      doc.setFont(isClassic ? 'times' : 'helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${cert.issuer} (Issued ${cert.issueDate})`, pageWidth - margin, y, {
        align: 'right'
      });
      y += isCompact ? 10 : 12;
    });
  }

  return doc;
}
