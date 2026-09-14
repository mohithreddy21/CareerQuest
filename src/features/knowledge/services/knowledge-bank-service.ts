import { careerRepository } from '@/services/career-repository';
import {
  CandidateKnowledgeBank,
  KnowledgeCategory,
  KnowledgeItem,
  KnowledgeProvenance,
  KnowledgeStatus,
  ProposedIngestionBatch
} from '@/types/domain';

export class KnowledgeBankService {
  /**
   * Get the complete Candidate Knowledge Bank
   */
  async getKnowledgeBank(candidateId: string): Promise<CandidateKnowledgeBank> {
    return careerRepository.getKnowledgeBank(candidateId);
  }

  /**
   * Get only active, approved knowledge items (for future matching & tailoring)
   */
  async getActiveApprovedKnowledge(candidateId: string): Promise<CandidateKnowledgeBank> {
    const kb = await careerRepository.getKnowledgeBank(candidateId);
    return {
      ...kb,
      skills: kb.skills.filter((i) => i.status === 'approved'),
      experiences: kb.experiences.filter((i) => i.status === 'approved'),
      projects: kb.projects.filter((i) => i.status === 'approved'),
      education: kb.education.filter((i) => i.status === 'approved'),
      certifications: kb.certifications.filter((i) => i.status === 'approved'),
      achievements: kb.achievements.filter((i) => i.status === 'approved')
    };
  }

  /**
   * Manually add a knowledge item
   */
  async addKnowledgeItem(
    candidateId: string,
    category: KnowledgeCategory,
    content: unknown,
    provenanceLabel = 'Manual Profile Entry'
  ): Promise<KnowledgeItem> {
    const provenance: KnowledgeProvenance = {
      id: `prov-${Date.now()}`,
      sourceType: 'manual_entry',
      sourceLabel: provenanceLabel,
      addedAt: new Date().toISOString()
    };

    const item: KnowledgeItem = {
      id: `kb-${category.slice(0, 4)}-${Date.now()}`,
      candidateId,
      category,
      content,
      status: 'approved',
      provenance: [provenance],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return careerRepository.saveKnowledgeItem(item);
  }

  /**
   * Update content of an existing knowledge item
   */
  async updateKnowledgeItem(
    id: string,
    content: unknown,
    provenanceNote = 'Manual update',
    candidateId?: string
  ): Promise<KnowledgeItem> {
    const newProv: KnowledgeProvenance = {
      id: `prov-${Date.now()}`,
      sourceType: 'manual_entry',
      sourceLabel: provenanceNote,
      addedAt: new Date().toISOString()
    };

    const kb = await careerRepository.getKnowledgeBank(candidateId);
    const existing = this.findItemInBank(kb, id);
    if (!existing) throw new Error(`Item ${id} not found in Knowledge Bank`);

    return careerRepository.updateKnowledgeItem(
      id,
      {
        content,
        provenance: [...existing.provenance, newProv],
        updatedAt: new Date().toISOString()
      },
      candidateId
    );
  }

  /**
   * Update status of an item (e.g. approve, archive, reject)
   */
  async updateKnowledgeItemStatus(
    id: string,
    status: KnowledgeStatus,
    candidateId?: string
  ): Promise<KnowledgeItem> {
    return careerRepository.updateKnowledgeItemStatus(id, status, candidateId);
  }

  /**
   * Delete an item permanently
   */
  async deleteKnowledgeItem(id: string, candidateId?: string): Promise<boolean> {
    return careerRepository.deleteKnowledgeItem(id, candidateId);
  }

  /**
   * Get pending proposed ingestion batches
   */
  async getProposedBatches(candidateId: string): Promise<ProposedIngestionBatch[]> {
    return careerRepository.getProposedBatches(candidateId);
  }

  /**
   * Resolve an individual proposed item from an ingestion batch
   */
  async resolveProposedItem(
    candidateId: string,
    batchId: string,
    tempId: string,
    action: 'accept' | 'reject' | 'edit',
    editedContent?: unknown
  ): Promise<{ resolved: boolean; remainingInBatch: number }> {
    const batches = await careerRepository.getProposedBatches(candidateId);
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) throw new Error(`Batch ${batchId} not found`);

    const propItemIdx = batch.items.findIndex((i) => i.tempId === tempId);
    if (propItemIdx < 0) throw new Error(`Proposed item ${tempId} not found`);

    const propItem = batch.items[propItemIdx];

    if (action === 'accept' || action === 'edit') {
      const finalContent = editedContent || propItem.content;
      const provenance: KnowledgeProvenance = {
        id: `prov-ingest-${Date.now()}`,
        sourceType: 'resume_upload',
        sourceLabel: batch.fileName,
        extractedSnippet: propItem.extractedSnippet,
        confidence: propItem.confidence,
        addedAt: new Date().toISOString()
      };

      if (
        propItem.conflictStatus === 'exact_match' ||
        propItem.conflictStatus === 'possible_duplicate'
      ) {
        // If an existing item is referenced, append provenance to the existing item without duplicating
        if (propItem.existingItemId) {
          const kb = await careerRepository.getKnowledgeBank(candidateId);
          const existing = this.findItemInBank(kb, propItem.existingItemId);
          if (existing) {
            await careerRepository.updateKnowledgeItem(propItem.existingItemId, {
              provenance: [...existing.provenance, provenance]
            });
          }
        }
      } else if (propItem.conflictStatus === 'conflict' && propItem.existingItemId) {
        // Overwrite existing approved item with accepted incoming/edited content and append provenance
        const kb = await careerRepository.getKnowledgeBank(candidateId);
        const existing = this.findItemInBank(kb, propItem.existingItemId);
        if (existing) {
          await careerRepository.updateKnowledgeItem(propItem.existingItemId, {
            content: finalContent,
            provenance: [...existing.provenance, provenance],
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        // Create new approved knowledge item
        const newItem: KnowledgeItem = {
          id: `kb-${propItem.category.slice(0, 4)}-${Date.now()}`,
          candidateId,
          category: propItem.category,
          content: finalContent,
          status: 'approved',
          provenance: [provenance],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await careerRepository.saveKnowledgeItem(newItem);
      }
    }

    // Remove resolved item from batch
    batch.items.splice(propItemIdx, 1);

    if (batch.items.length === 0) {
      await careerRepository.deleteProposedBatch(batchId);
      return { resolved: true, remainingInBatch: 0 };
    } else {
      await careerRepository.saveProposedBatch(batch);
      return { resolved: true, remainingInBatch: batch.items.length };
    }
  }

  /**
   * Accept all safe proposed items in a batch
   */
  async acceptAllProposedItems(candidateId: string, batchId: string): Promise<void> {
    const batches = await careerRepository.getProposedBatches(candidateId);
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return;

    // Clone list to process
    const itemsToProcess = [...batch.items];
    for (const item of itemsToProcess) {
      // Don't auto-accept unresolved conflicts; only accept new or duplicate provenance attachments
      if (item.conflictStatus !== 'conflict') {
        await this.resolveProposedItem(candidateId, batchId, item.tempId, 'accept');
      }
    }
  }

  private findItemInBank(kb: CandidateKnowledgeBank, id: string): KnowledgeItem | null {
    for (const cat of [
      'skills',
      'experiences',
      'projects',
      'education',
      'certifications',
      'achievements'
    ] as const) {
      const found = (kb[cat] as KnowledgeItem[]).find((i) => i.id === id);
      if (found) return found;
    }
    return null;
  }
}

export const knowledgeBankService = new KnowledgeBankService();
