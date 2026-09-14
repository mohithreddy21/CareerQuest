import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer
} from 'docx';
import { ResumeContent } from '@/types/resume-content';
import { ResumeTemplate } from '@/types/templates';

export async function generateResumeDocx(
  content: ResumeContent,
  template: ResumeTemplate
): Promise<Blob> {
  const isClassic = template.id === 'classic-v1';
  const isCompact = template.id === 'compact-v1';
  const fontFamily = isClassic ? 'Georgia' : 'Arial';

  const children: Paragraph[] = [];

  // --- 1. Header ---
  children.push(
    new Paragraph({
      alignment:
        template.layout.headerAlignment === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: content.identity.fullName,
          font: fontFamily,
          bold: true,
          size: isCompact ? 32 : 36
        })
      ]
    }),
    new Paragraph({
      alignment:
        template.layout.headerAlignment === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text:
            content.identity.targetRole +
            (content.identity.targetCompany
              ? ` — Targeted for ${content.identity.targetCompany}`
              : ''),
          font: fontFamily,
          color: isClassic ? '444444' : '2563eb',
          bold: true,
          size: isCompact ? 20 : 22
        })
      ]
    }),
    new Paragraph({
      alignment:
        template.layout.headerAlignment === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 140 },
      border: {
        bottom: {
          color: 'CCCCCC',
          space: 4,
          style: BorderStyle.SINGLE,
          size: 6
        }
      },
      children: [
        new TextRun({
          text: `${content.identity.location}  •  ${content.identity.email}${
            content.identity.phone ? `  •  ${content.identity.phone}` : ''
          }`,
          font: fontFamily,
          color: '666666',
          size: 18
        })
      ]
    })
  );

  // Section heading helper
  const addSectionHeader = (title: string) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: isCompact ? 140 : 200, after: 60 },
        border: {
          bottom: {
            color: 'DDDDDD',
            space: 2,
            style: BorderStyle.SINGLE,
            size: 4
          }
        },
        children: [
          new TextRun({
            text: title.toUpperCase(),
            font: fontFamily,
            bold: true,
            size: isCompact ? 20 : 22,
            color: '222222'
          })
        ]
      })
    );
  };

  // --- 2. Professional Summary ---
  if (content.summary) {
    addSectionHeader('Professional Summary');
    children.push(
      new Paragraph({
        spacing: { after: isCompact ? 80 : 120 },
        children: [
          new TextRun({
            text: content.summary,
            font: fontFamily,
            size: isCompact ? 18 : 19,
            color: '333333'
          })
        ]
      })
    );
  }

  // --- 3. Skills ---
  if (
    content.skills.technical.length > 0 ||
    content.skills.tools.length > 0 ||
    content.skills.soft.length > 0
  ) {
    addSectionHeader('Technical Skills & Competencies');

    if (content.skills.technical.length > 0) {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: 'Languages & Frameworks: ',
              font: fontFamily,
              bold: true,
              size: isCompact ? 18 : 19
            }),
            new TextRun({
              text: content.skills.technical.join(', '),
              font: fontFamily,
              size: isCompact ? 18 : 19,
              color: '444444'
            })
          ]
        })
      );
    }

    if (content.skills.tools.length > 0) {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: 'Infrastructure & Data: ',
              font: fontFamily,
              bold: true,
              size: isCompact ? 18 : 19
            }),
            new TextRun({
              text: content.skills.tools.join(', '),
              font: fontFamily,
              size: isCompact ? 18 : 19,
              color: '444444'
            })
          ]
        })
      );
    }

    if (content.skills.soft.length > 0) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: 'Architectural & Domain: ',
              font: fontFamily,
              bold: true,
              size: isCompact ? 18 : 19
            }),
            new TextRun({
              text: content.skills.soft.join(', '),
              font: fontFamily,
              size: isCompact ? 18 : 19,
              color: '444444'
            })
          ]
        })
      );
    }
  }

  // --- 4. Professional Experience ---
  if (content.experience.length > 0) {
    addSectionHeader('Professional Experience');

    content.experience.forEach((exp) => {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({
              text: exp.role,
              font: fontFamily,
              bold: true,
              size: isCompact ? 19 : 20
            }),
            new TextRun({
              text: ` — ${exp.employer}${exp.location ? ` (${exp.location})` : ''}`,
              font: fontFamily,
              color: '555555',
              size: isCompact ? 18 : 19
            }),
            new TextRun({
              text: `\t${exp.startDate} – ${exp.isCurrent ? 'Present' : exp.endDate || 'Present'}`,
              font: fontFamily,
              color: '777777',
              size: 17
            })
          ]
        })
      );

      exp.bullets.forEach((bullet) => {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: bullet,
                font: fontFamily,
                size: isCompact ? 17 : 18,
                color: '333333'
              })
            ]
          })
        );
      });
    });
  }

  // --- 5. Projects ---
  if (content.projects.length > 0) {
    addSectionHeader('Key Projects & Systems');

    content.projects.forEach((proj) => {
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 30 },
          children: [
            new TextRun({
              text: proj.name,
              font: fontFamily,
              bold: true,
              size: isCompact ? 18 : 19
            }),
            ...(proj.technologies.length > 0
              ? [
                  new TextRun({
                    text: ` [${proj.technologies.join(', ')}]`,
                    font: fontFamily,
                    color: '666666',
                    size: 17
                  })
                ]
              : [])
          ]
        }),
        new Paragraph({
          spacing: { after: 30 },
          children: [
            new TextRun({
              text: proj.description,
              font: fontFamily,
              size: isCompact ? 17 : 18,
              color: '444444'
            })
          ]
        })
      );

      proj.bullets.forEach((bullet) => {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 20 },
            children: [
              new TextRun({
                text: bullet,
                font: fontFamily,
                size: isCompact ? 17 : 18,
                color: '333333'
              })
            ]
          })
        );
      });
    });
  }

  // --- 6. Education & Certifications ---
  if (content.education.length > 0 || content.certifications.length > 0) {
    addSectionHeader('Education & Credentials');

    content.education.forEach((edu) => {
      children.push(
        new Paragraph({
          spacing: { after: 30 },
          children: [
            new TextRun({
              text: `${edu.degree} in ${edu.fieldOfStudy}`,
              font: fontFamily,
              bold: true,
              size: isCompact ? 18 : 19
            }),
            new TextRun({
              text: ` — ${edu.institution} (${edu.startDate} – ${edu.endDate || 'Present'})`,
              font: fontFamily,
              color: '666666',
              size: isCompact ? 17 : 18
            })
          ]
        })
      );
    });

    content.certifications.forEach((cert) => {
      children.push(
        new Paragraph({
          spacing: { after: 30 },
          children: [
            new TextRun({
              text: cert.name,
              font: fontFamily,
              bold: true,
              size: isCompact ? 18 : 19
            }),
            new TextRun({
              text: ` — ${cert.issuer} (Issued ${cert.issueDate}${
                cert.credentialId ? `, ID: ${cert.credentialId}` : ''
              })`,
              font: fontFamily,
              color: '666666',
              size: isCompact ? 17 : 18
            })
          ]
        })
      );
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: isCompact ? 720 : 1000,
              bottom: isCompact ? 720 : 1000,
              left: isCompact ? 720 : 1000,
              right: isCompact ? 720 : 1000
            }
          }
        },
        children
      }
    ]
  });

  return await Packer.toBlob(doc);
}
