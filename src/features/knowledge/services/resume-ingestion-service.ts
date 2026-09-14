import { careerRepository } from '@/services/career-repository';
import {
  ProposedIngestionBatch,
  ProposedKnowledgeItem,
  CandidateKnowledgeBank
} from '@/types/domain';
import { ResumeParserProvider } from './providers/resume-parser-provider';
import { mockResumeParserProvider } from './providers/mock-resume-parser-provider';
import { duplicateDetectionService } from './duplicate-detection-service';

export class ResumeIngestionService {
  private parser: ResumeParserProvider;

  constructor(parser: ResumeParserProvider = mockResumeParserProvider) {
    this.parser = parser;
  }

  setParser(parser: ResumeParserProvider) {
    this.parser = parser;
  }

  /**
   * Ingest a resume file, normalize, detect duplicates/conflicts, and create a proposed batch
   */
  async ingestResume(
    candidateId: string,
    file: { fileName: string; text?: string }
  ): Promise<ProposedIngestionBatch> {
    const extracted = await this.parser.parseResume(file);
    const kb: CandidateKnowledgeBank = await careerRepository.getKnowledgeBank(candidateId);

    const proposedItems: ProposedKnowledgeItem[] = [];
    let counter = 1;

    // 1. Evaluate Extracted Skills
    for (const skill of extracted.skills) {
      const match = duplicateDetectionService.findMatchingSkill(skill.name, kb.skills);

      if (match.matchType === 'exact') {
        proposedItems.push({
          tempId: `prop-${Date.now()}-${counter++}`,
          category: 'skill',
          content: {
            name: skill.name,
            category: skill.category || 'technical',
            yearsOfExperience: skill.years
          },
          confidence: 0.98,
          extractedSnippet: `Identified "${skill.name}" in uploaded resume.`,
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
          confidence: 0.94,
          extractedSnippet: `Extracted "${skill.name}" from document.`,
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
          confidence: 0.95,
          extractedSnippet: `New technical skill extracted from ${file.fileName}.`,
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
            confidence: 0.91,
            extractedSnippet:
              exp.rawSnippet || `${exp.role} at ${exp.employer} (${exp.startDate} - Present)`,
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
            confidence: 0.96,
            extractedSnippet: exp.rawSnippet || `${exp.role} at ${exp.employer}`,
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
          confidence: 0.93,
          extractedSnippet: exp.rawSnippet || `${exp.role} at ${exp.employer}`,
          conflictStatus: 'new'
        });
      }
    }

    // 3. Evaluate Certifications
    for (const cert of extracted.certifications) {
      const match = duplicateDetectionService.findMatchingCertification(
        cert.name,
        kb.certifications
      );
      if (match) {
        proposedItems.push({
          tempId: `prop-${Date.now()}-${counter++}`,
          category: 'certification',
          content: cert,
          confidence: 0.97,
          extractedSnippet: `${cert.name} (Issued by ${cert.issuer})`,
          conflictStatus: 'exact_match',
          existingItemId: match.id,
          conflictDescription: `Matches approved certification "${match.content.name}".`
        });
      } else {
        proposedItems.push({
          tempId: `prop-${Date.now()}-${counter++}`,
          category: 'certification',
          content: cert,
          confidence: 0.97,
          extractedSnippet: `${cert.name} (Issued by ${cert.issuer})`,
          conflictStatus: 'new'
        });
      }
    }

    // 4. Evaluate Achievements
    for (const ach of extracted.achievements) {
      proposedItems.push({
        tempId: `prop-${Date.now()}-${counter++}`,
        category: 'achievement',
        content: ach,
        confidence: 0.92,
        extractedSnippet: ach.description,
        conflictStatus: 'new'
      });
    }

    const batch: ProposedIngestionBatch = {
      id: `batch-${Date.now()}`,
      candidateId,
      fileName: file.fileName,
      uploadedAt: new Date().toISOString(),
      status: 'pending_review',
      items: proposedItems
    };

    await careerRepository.saveProposedBatch(batch);
    return batch;
  }
}

export const resumeIngestionService = new ResumeIngestionService();
