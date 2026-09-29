import { careerRepository } from '@/services/career-repository';
import {
  ProposedIngestionBatch,
  ProposedKnowledgeItem,
  CandidateKnowledgeBank
} from '@/types/domain';
import { ResumeParserProvider } from './providers/resume-parser-provider';
import { getResumeParserProvider } from './providers/resume-parser-provider.factory';
import { duplicateDetectionService } from './duplicate-detection-service';

export class ResumeIngestionService {
  private parser?: ResumeParserProvider;

  constructor(parser?: ResumeParserProvider) {
    this.parser = parser;
  }

  setParser(parser: ResumeParserProvider) {
    this.parser = parser;
  }

  getParser(): ResumeParserProvider {
    if (!this.parser) {
      this.parser = getResumeParserProvider();
    }
    return this.parser;
  }

  /**
   * Ingest a resume file, normalize, detect duplicates/conflicts, and create a proposed batch
   * across all six Knowledge Bank categories (skills, experience, projects, education,
   * certifications, achievements).
   */
  async ingestResume(
    candidateId: string,
    file: { fileName: string; text?: string; documentId?: string }
  ): Promise<ProposedIngestionBatch> {
    const parser = this.getParser();
    const extracted = await parser.parseResume(file);
    const kb: CandidateKnowledgeBank = await careerRepository.getKnowledgeBank(candidateId);

    const proposedItems: ProposedKnowledgeItem[] = [];
    let counter = 1;

    // 1. Evaluate Extracted Skills
    for (const skill of extracted.skills) {
      const match = duplicateDetectionService.findMatchingSkill(skill.name, kb.skills);
      const evidenceSnippet =
        skill.evidence?.exactQuote || `Identified "${skill.name}" in uploaded resume.`;
      const confidence = skill.confidence ?? 0.95;

      if (match.matchType === 'exact') {
        proposedItems.push({
          tempId: `prop-${Date.now()}-${counter++}`,
          category: 'skill',
          content: {
            name: skill.name,
            category: skill.category || 'technical',
            yearsOfExperience: skill.years
          },
          confidence,
          extractedSnippet: evidenceSnippet,
          conflictStatus: 'exact_match',
          existingItemId: match.existingItem?.id,
          conflictDescription: `Matches approved skill "${match.existingItem?.content.name}". Approving will add this document as supporting provenance.`
        });
      } else if (match.matchType === 'alias') {
        proposedItems.push({
          tempId: `prop-${Date.now()}-${counter++}`,
          category: 'skill',
          content: {
            name: skill.name,
            category: skill.category || 'technical',
            yearsOfExperience: skill.years
          },
          confidence,
          extractedSnippet: evidenceSnippet,
          conflictStatus: 'possible_duplicate',
          existingItemId: match.existingItem?.id,
          conflictDescription: `Matches canonical approved skill "${match.existingItem?.content.name}".`
        });
      } else {
        proposedItems.push({
          tempId: `prop-${Date.now()}-${counter++}`,
          category: 'skill',
          content: {
            name: duplicateDetectionService.normalizeSkill(skill.name),
            category: skill.category || 'technical',
            yearsOfExperience: skill.years
          },
          confidence,
          extractedSnippet: evidenceSnippet,
          conflictStatus: 'new'
        });
      }
    }

    // 2. Evaluate Extracted Experience
    for (const exp of extracted.experience) {
      const existingMatch = duplicateDetectionService.findMatchingExperience(
        exp.employer,
        exp.startDate,
        kb.experiences
      );
      const evidenceSnippet =
        exp.evidence?.exactQuote || exp.rawSnippet || `${exp.role} at ${exp.employer}`;
      const confidence = exp.confidence ?? 0.93;

      if (existingMatch) {
        const isRoleDifferent =
          existingMatch.content.role.toLowerCase().trim() !== exp.role.toLowerCase().trim();

        if (isRoleDifferent) {
          proposedItems.push({
            tempId: `prop-${Date.now()}-${counter++}`,
            category: 'experience',
            content: {
              employer: exp.employer,
              role: exp.role,
              location: exp.location,
              startDate: exp.startDate,
              endDate: exp.endDate,
              isCurrent: exp.isCurrent ?? true,
              responsibilities: exp.responsibilities,
              achievements: exp.achievements
            },
            confidence,
            extractedSnippet: evidenceSnippet,
            conflictStatus: 'conflict',
            existingItemId: existingMatch.id,
            conflictDescription: `Role title in document is "${exp.role}" whereas current approved record is "${existingMatch.content.role}". Review to reconcile.`
          });
        } else {
          proposedItems.push({
            tempId: `prop-${Date.now()}-${counter++}`,
            category: 'experience',
            content: {
              employer: exp.employer,
              role: exp.role,
              location: exp.location,
              startDate: exp.startDate,
              endDate: exp.endDate,
              isCurrent: exp.isCurrent ?? true,
              responsibilities: exp.responsibilities,
              achievements: exp.achievements
            },
            confidence,
            extractedSnippet: evidenceSnippet,
            conflictStatus: 'exact_match',
            existingItemId: existingMatch.id,
            conflictDescription: `Matches approved employment record at ${existingMatch.content.employer}. Approving will attach this document as supporting provenance.`
          });
        }
      } else {
        proposedItems.push({
          tempId: `prop-${Date.now()}-${counter++}`,
          category: 'experience',
          content: {
            employer: exp.employer,
            role: exp.role,
            location: exp.location,
            startDate: exp.startDate,
            endDate: exp.endDate,
            isCurrent: exp.isCurrent ?? true,
            responsibilities: exp.responsibilities,
            achievements: exp.achievements
          },
          confidence,
          extractedSnippet: evidenceSnippet,
          conflictStatus: 'new'
        });
      }
    }

    // 3. Evaluate Extracted Projects
    for (const proj of extracted.projects) {
      const match = duplicateDetectionService.findMatchingProject(proj.name, kb.projects);
      const evidenceSnippet = proj.evidence?.exactQuote || `${proj.name}: ${proj.description}`;
      const confidence = proj.confidence ?? 0.92;

      if (match) {
        proposedItems.push({
          tempId: `prop-${Date.now()}-${counter++}`,
          category: 'project',
          content: proj,
          confidence,
          extractedSnippet: evidenceSnippet,
          conflictStatus: 'exact_match',
          existingItemId: match.id,
          conflictDescription: `Matches approved project "${match.content.name}". Approving will attach this document as supporting provenance.`
        });
      } else {
        proposedItems.push({
          tempId: `prop-${Date.now()}-${counter++}`,
          category: 'project',
          content: proj,
          confidence,
          extractedSnippet: evidenceSnippet,
          conflictStatus: 'new'
        });
      }
    }

    // 4. Evaluate Extracted Education
    for (const edu of extracted.education) {
      const match = duplicateDetectionService.findMatchingEducation(edu.institution, kb.education);
      const evidenceSnippet =
        edu.evidence?.exactQuote || `${edu.degree} in ${edu.fieldOfStudy} at ${edu.institution}`;
      const confidence = edu.confidence ?? 0.94;

      if (match) {
        proposedItems.push({
          tempId: `prop-${Date.now()}-${counter++}`,
          category: 'education',
          content: edu,
          confidence,
          extractedSnippet: evidenceSnippet,
          conflictStatus: 'exact_match',
          existingItemId: match.id,
          conflictDescription: `Matches approved education at "${match.content.institution}". Approving will attach this document as supporting provenance.`
        });
      } else {
        proposedItems.push({
          tempId: `prop-${Date.now()}-${counter++}`,
          category: 'education',
          content: edu,
          confidence,
          extractedSnippet: evidenceSnippet,
          conflictStatus: 'new'
        });
      }
    }

    // 5. Evaluate Certifications
    for (const cert of extracted.certifications) {
      const match = duplicateDetectionService.findMatchingCertification(
        cert.name,
        kb.certifications
      );
      const evidenceSnippet =
        cert.evidence?.exactQuote || `${cert.name} (Issued by ${cert.issuer})`;
      const confidence = cert.confidence ?? 0.97;

      if (match) {
        proposedItems.push({
          tempId: `prop-${Date.now()}-${counter++}`,
          category: 'certification',
          content: cert,
          confidence,
          extractedSnippet: evidenceSnippet,
          conflictStatus: 'exact_match',
          existingItemId: match.id,
          conflictDescription: `Matches approved certification "${match.content.name}".`
        });
      } else {
        proposedItems.push({
          tempId: `prop-${Date.now()}-${counter++}`,
          category: 'certification',
          content: cert,
          confidence,
          extractedSnippet: evidenceSnippet,
          conflictStatus: 'new'
        });
      }
    }

    // 6. Evaluate Achievements
    for (const ach of extracted.achievements) {
      const evidenceSnippet = ach.evidence?.exactQuote || ach.description;
      const confidence = ach.confidence ?? 0.91;

      proposedItems.push({
        tempId: `prop-${Date.now()}-${counter++}`,
        category: 'achievement',
        content: ach,
        confidence,
        extractedSnippet: evidenceSnippet,
        conflictStatus: 'new'
      });
    }

    const batch: ProposedIngestionBatch = {
      id: `batch-${Date.now()}`,
      candidateId,
      documentId: file.documentId,
      fileName: file.fileName,
      rawText: file.text,
      uploadedAt: new Date().toISOString(),
      status: 'pending_review',
      items: proposedItems
    };

    await careerRepository.saveProposedBatch(batch);
    return batch;
  }
}

export const resumeIngestionService = new ResumeIngestionService();
