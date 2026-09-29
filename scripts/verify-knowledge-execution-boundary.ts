import { PrismaClient } from '@prisma/client';
import { setTestCandidateId } from '../src/lib/auth';
import { PrismaCareerRepository } from '../src/services/prisma-career-repository';
import { knowledgeBankService } from '../src/features/knowledge/services/knowledge-bank-service';
import { resolveProposedItemAction, acceptAllProposedItemsAction } from '../src/features/knowledge/api/actions';
import { knowledgeBankQueryOptions, proposedBatchesQueryOptions } from '../src/features/knowledge/api/queries';

const prisma = new PrismaClient();
const repo = new PrismaCareerRepository();

async function run() {
  console.log('========================================================');
  console.log('  Testing Knowledge Execution Boundary & Claim Approval');
  console.log('========================================================\n');

  const CAND_1 = 'cand-exec-boundary-1';
  const CAND_2 = 'cand-exec-boundary-2';

  // Teardown
  await prisma.knowledgeItem.deleteMany({ where: { candidateId: { in: [CAND_1, CAND_2] } } });
  await prisma.resumeIngestionBatch.deleteMany({ where: { candidateId: { in: [CAND_1, CAND_2] } } });
  await prisma.candidateDocument.deleteMany({ where: { candidateId: { in: [CAND_1, CAND_2] } } });
  await prisma.candidate.deleteMany({ where: { id: { in: [CAND_1, CAND_2] } } });

  try {
    // 1. Provision candidates
    await prisma.candidate.create({
      data: {
        id: CAND_1,
        clerkUserId: 'user_exec_1',
        email: 'exec1@careerquest.internal',
        profile: {
          create: {
            name: 'David Lightman',
            headline: 'Systems Security Engineer',
            location: 'Seattle, WA',
            professionalSummary: 'Specialist in distributed network systems.'
          }
        },
        preferences: {
          create: {
            targetRoles: ['Security Engineer']
          }
        }
      }
    });

    await prisma.candidate.create({
      data: {
        id: CAND_2,
        clerkUserId: 'user_exec_2',
        email: 'exec2@careerquest.internal',
        profile: {
          create: {
            name: 'Jennifer Mack',
            headline: 'Frontend Engineer',
            location: 'Portland, OR',
            professionalSummary: 'Frontend specialist.'
          }
        },
        preferences: {
          create: {
            targetRoles: ['Frontend Engineer']
          }
        }
      }
    });
    console.log('PASS 01: Candidates provisioned in PostgreSQL.');

    setTestCandidateId(CAND_1);

    // 2. Add an existing baseline skill for Candidate 1 in Knowledge Bank
    const existingSkill = await repo.saveKnowledgeItem({
      id: `kb-skil-baseline-${Date.now()}`,
      candidateId: CAND_1,
      category: 'skill',
      content: { name: 'Python', category: 'technical' },
      status: 'approved',
      provenance: [{
        id: `prov-base-${Date.now()}`,
        sourceType: 'manual_entry',
        sourceLabel: 'Initial Profile Setup',
        addedAt: new Date().toISOString()
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, CAND_1);
    console.log('PASS 02: Baseline skill created in Knowledge Bank -> ID:', existingSkill.id);

    // 3. Create a proposed batch containing:
    //    - Claim A: exact_match pointing to existingSkill.id (PREVIOUSLY THREW SECURITY VIOLATION!)
    //    - Claim B: conflict pointing to existingSkill.id (PREVIOUSLY THREW SECURITY VIOLATION!)
    //    - Claim C: new skill
    const createdBatch1 = await repo.createProposedBatch({
      candidateId: CAND_1,
      fileName: 'david_resume.pdf',
      status: 'pending_review',
      items: [
        {
          tempId: 'claim-exact-match',
          category: 'skill',
          content: { name: 'Python', category: 'technical' },
          confidence: 0.95,
          conflictStatus: 'exact_match',
          existingItemId: existingSkill.id,
          extractedSnippet: 'Proficient in Python and distributed network security.'
        },
        {
          tempId: 'claim-new-skill',
          category: 'skill',
          content: { name: 'Kubernetes', category: 'tools' },
          confidence: 0.88,
          conflictStatus: 'new',
          extractedSnippet: 'Deployed clusters on Kubernetes.'
        },
        {
          tempId: 'claim-conflict-skill',
          category: 'skill',
          content: { name: 'Python 3.12 & AsyncIO', category: 'technical' },
          confidence: 0.92,
          conflictStatus: 'conflict',
          existingItemId: existingSkill.id,
          extractedSnippet: 'Python 3.12 development using AsyncIO.'
        }
      ]
    }, CAND_1);
    const batchId = createdBatch1.id;
    console.log('PASS 03: Proposed ingestion batch created with exact_match, new, and conflict claims -> ID:', batchId);

    // 4. Test resolving EXACT_MATCH claim (Accept)
    console.log('\n--- 4. RESOLVING EXACT_MATCH CLAIM ---');
    const exactResult = await resolveProposedItemAction({
      batchId,
      tempId: 'claim-exact-match',
      action: 'accept'
    });
    console.log('Resolve exact_match result:', exactResult);
    if (!exactResult.resolved) throw new Error('Exact match claim resolution failed');

    // Verify provenance appended to existing item
    const updatedBaseline = await repo.getKnowledgeItemById(existingSkill.id, CAND_1);
    console.log('Updated baseline provenance count:', updatedBaseline?.provenance.length);
    if (!updatedBaseline || updatedBaseline.provenance.length !== 2) {
      throw new Error('Provenance was not appended to existing item on exact match');
    }
    console.log('PASS 04: Exact-match claim resolved cleanly without security violation!');

    // 5. Test resolving NEW claim (Accept)
    console.log('\n--- 5. RESOLVING NEW CLAIM ---');
    const newResult = await resolveProposedItemAction({
      batchId,
      tempId: 'claim-new-skill',
      action: 'accept'
    });
    console.log('Resolve new claim result:', newResult);
    if (!newResult.resolved) throw new Error('New claim resolution failed');

    const kbAfterNew = await repo.getKnowledgeBank(CAND_1);
    const hasK8s = kbAfterNew.skills.some((s) => (s.content as { name: string }).name === 'Kubernetes');
    console.log('Knowledge Bank contains new approved Kubernetes skill:', hasK8s);
    if (!hasK8s) throw new Error('New skill did not enter Knowledge Bank');
    console.log('PASS 05: New claim resolved and entered Knowledge Bank!');

    // 6. Test resolving CONFLICT claim (Accept / Overwrite)
    console.log('\n--- 6. RESOLVING CONFLICT CLAIM ---');
    const conflictResult = await resolveProposedItemAction({
      batchId,
      tempId: 'claim-conflict-skill',
      action: 'accept'
    });
    console.log('Resolve conflict result:', conflictResult);
    if (!conflictResult.resolved) throw new Error('Conflict claim resolution failed');

    // Batch should now be fully resolved (remaining: 0, batch deleted)
    const remainingBatches = await repo.getProposedBatches(CAND_1);
    const batchExists = remainingBatches.some((b) => b.id === batchId);
    console.log('Batch automatically cleaned up when 0 items remain:', !batchExists);
    if (batchExists) throw new Error('Batch was not deleted when last item resolved');
    console.log('PASS 06: Conflict claim resolved, batch successfully deleted upon completion!');

    // 7. Test Accept All Safe Claims on a second batch
    console.log('\n--- 7. TESTING ACCEPT ALL SAFE CLAIMS ---');
    const createdBatch2 = await repo.createProposedBatch({
      candidateId: CAND_1,
      fileName: 'bulk_resume.docx',
      status: 'pending_review',
      items: [
        {
          tempId: 'bulk-skill-1',
          category: 'skill',
          content: { name: 'Docker', category: 'tools' },
          confidence: 0.9,
          conflictStatus: 'new',
          extractedSnippet: 'Docker containers.'
        },
        {
          tempId: 'bulk-skill-2',
          category: 'skill',
          content: { name: 'PostgreSQL', category: 'tools' },
          confidence: 0.95,
          conflictStatus: 'new',
          extractedSnippet: 'PostgreSQL databases.'
        }
      ]
    }, CAND_1);
    const batch2Id = createdBatch2.id;

    const bulkResult = await acceptAllProposedItemsAction({ batchId: batch2Id });
    console.log('Accept all result:', bulkResult);
    if (!bulkResult.success) throw new Error('Accept all failed');

    const kbAfterBulk = await repo.getKnowledgeBank(CAND_1);
    const hasDocker = kbAfterBulk.skills.some((s) => (s.content as { name: string }).name === 'Docker');
    const hasPostgres = kbAfterBulk.skills.some((s) => (s.content as { name: string }).name === 'PostgreSQL');
    console.log('Knowledge Bank contains Docker:', hasDocker, '| PostgreSQL:', hasPostgres);
    if (!hasDocker || !hasPostgres) throw new Error('Bulk accepted items not found in Knowledge Bank');
    console.log('PASS 07: Accept all safe claims resolved without security violation!');

    // 8. Test Server-Side Query Execution (SSR prefetching)
    console.log('\n--- 8. SERVER-SIDE QUERY EXECUTION ---');
    const bankQuery = knowledgeBankQueryOptions(CAND_1);
    const batchesQuery = proposedBatchesQueryOptions(CAND_1);

    const serverBank = await bankQuery.queryFn!({} as never);
    const serverBatches = await batchesQuery.queryFn!({} as never);

    console.log('Server query Knowledge Bank skill count:', serverBank.skills.length);
    console.log('Server query proposed batches count:', serverBatches.length);
    if (serverBank.skills.length === 0) throw new Error('Server query returned empty skills');
    console.log('PASS 08: Server prefetch queryFn executes in-process with 0ms network latency!');

    // 9. Multi-Tenant Candidate Isolation
    console.log('\n--- 9. MULTI-TENANT ISOLATION ---');
    setTestCandidateId(CAND_2);

    const cand2BankQuery = knowledgeBankQueryOptions(CAND_2);
    const cand2BatchesQuery = proposedBatchesQueryOptions(CAND_2);

    const cand2Bank = await cand2BankQuery.queryFn!({} as never);
    const cand2Batches = await cand2BatchesQuery.queryFn!({} as never);

    console.log('Candidate 2 sees 0 skills:', cand2Bank.skills.length === 0);
    console.log('Candidate 2 sees 0 batches:', cand2Batches.length === 0);
    if (cand2Bank.skills.length !== 0 || cand2Batches.length !== 0) {
      throw new Error('Multi-tenant leakage between candidate 1 and candidate 2');
    }
    console.log('PASS 09: Candidate isolation verified on knowledge bank and proposed batches!');

    // 10. Cross-Tenant Tampering Prevention Test
    console.log('\n--- 10. CROSS-TENANT TAMPERING PREVENTED ---');
    // Provision a new proposed claim belonging strictly to Candidate A
    const cand1TamperBatch = await repo.createProposedBatch({
      candidateId: CAND_1,
      fileName: 'confidential_cand1_resume.pdf',
      status: 'pending_review',
      items: [
        {
          tempId: 'claim-cand1-tamper-target',
          category: 'skill',
          content: { name: 'Distributed Consensus', category: 'technical' },
          confidence: 0.98,
          conflictStatus: 'new',
          extractedSnippet: 'Implemented Raft consensus in Go.'
        }
      ]
    }, CAND_1);
    console.log('Created Candidate A confidential proposed batch -> ID:', cand1TamperBatch.id);

    // Authenticate as Candidate B
    setTestCandidateId(CAND_2);

    // 10a: Candidate B attempts to modify/accept Candidate A's claim specifying Candidate A's candidateId
    let candBTamperResolveBlocked = false;
    try {
      await resolveProposedItemAction({
        candidateId: CAND_1, // Tampering attempt: supplying Candidate A's candidateId
        batchId: cand1TamperBatch.id,
        tempId: 'claim-cand1-tamper-target',
        action: 'accept'
      });
    } catch (err: unknown) {
      candBTamperResolveBlocked = true;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log('Candidate B resolve tampering blocked with error:', errMsg);
      if (!errMsg.includes('FORBIDDEN') && !errMsg.includes('Cross-candidate')) {
        throw new Error(`Expected FORBIDDEN / cross-candidate error, got: ${errMsg}`);
      }
    }
    if (!candBTamperResolveBlocked) {
      throw new Error('SECURITY VIOLATION: Candidate B was able to modify/accept Candidate A claim using Candidate A candidate ID!');
    }
    console.log('PASS 10a: Candidate B cannot resolve Candidate A proposed claim using Candidate A candidateId!');

    // 10b: Candidate B attempts to accept-all Candidate A claims specifying Candidate A's candidateId
    let candBTamperAcceptAllBlocked = false;
    try {
      await acceptAllProposedItemsAction({
        candidateId: CAND_1, // Tampering attempt: supplying Candidate A's candidateId
        batchId: cand1TamperBatch.id
      });
    } catch (err: unknown) {
      candBTamperAcceptAllBlocked = true;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log('Candidate B accept-all tampering blocked with error:', errMsg);
      if (!errMsg.includes('FORBIDDEN') && !errMsg.includes('Cross-candidate')) {
        throw new Error(`Expected FORBIDDEN / cross-candidate error, got: ${errMsg}`);
      }
    }
    if (!candBTamperAcceptAllBlocked) {
      throw new Error('SECURITY VIOLATION: Candidate B was able to accept all Candidate A claims using Candidate A candidate ID!');
    }
    console.log('PASS 10b: Candidate B cannot accept all Candidate A claims using Candidate A candidateId!');

    // 10c: Candidate B attempts to resolve Candidate A's claim with omitted candidateId (foreign batchId only)
    let candBForeignBatchResolveBlocked = false;
    try {
      await resolveProposedItemAction({
        batchId: cand1TamperBatch.id,
        tempId: 'claim-cand1-tamper-target',
        action: 'accept'
      });
    } catch (err: unknown) {
      candBForeignBatchResolveBlocked = true;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log('Candidate B foreign batch resolve blocked with error:', errMsg);
    }
    if (!candBForeignBatchResolveBlocked) {
      throw new Error('SECURITY VIOLATION: Candidate B was able to resolve Candidate A claim using foreign batch ID!');
    }
    console.log('PASS 10c: Candidate B cannot resolve foreign batch even if candidateId is omitted!');

    // 10d: Candidate B attempts to accept-all with omitted candidateId (foreign batchId only)
    let candBForeignBatchAcceptAllBlocked = false;
    try {
      await acceptAllProposedItemsAction({
        batchId: cand1TamperBatch.id
      });
    } catch (err: unknown) {
      candBForeignBatchAcceptAllBlocked = true;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log('Candidate B foreign batch accept-all blocked with error:', errMsg);
    }
    if (!candBForeignBatchAcceptAllBlocked) {
      throw new Error('SECURITY VIOLATION: Candidate B was able to accept all in foreign batch even if candidateId is omitted!');
    }
    console.log('PASS 10d: Candidate B cannot accept all in foreign batch even if candidateId is omitted!');

    // 10e: Verify Candidate A's batch and Knowledge Bank remain pristine
    const cand1BankFinal = await repo.getKnowledgeBank(CAND_1);
    const cand2BankFinal = await repo.getKnowledgeBank(CAND_2);
    const cand1HasConsensus = cand1BankFinal.skills.some((s) => (s.content as { name: string }).name === 'Distributed Consensus');
    const cand2HasConsensus = cand2BankFinal.skills.some((s) => (s.content as { name: string }).name === 'Distributed Consensus');
    if (cand1HasConsensus || cand2HasConsensus) {
      throw new Error('SECURITY VIOLATION: Claim was accepted into knowledge bank during unauthorized attack!');
    }
    const cand1RemainingBatchesFinal = await repo.getProposedBatches(CAND_1);
    const cand1BatchIntact = cand1RemainingBatchesFinal.find((b) => b.id === cand1TamperBatch.id);
    if (!cand1BatchIntact || cand1BatchIntact.items.length !== 1) {
      throw new Error('SECURITY VIOLATION: Candidate A batch was mutated during unauthorized attack!');
    }
    console.log('PASS 10e: Verified Candidate A batch and Knowledge Bank remained completely untouched.');

    console.log('\n========================================================');
    console.log('  ALL 10 EXECUTION BOUNDARY & CLAIM RESOLUTION CHECKS PASSED!');
    console.log('========================================================\n');

  } finally {
    setTestCandidateId(null);
    await prisma.knowledgeItem.deleteMany({ where: { candidateId: { in: [CAND_1, CAND_2] } } });
    await prisma.resumeIngestionBatch.deleteMany({ where: { candidateId: { in: [CAND_1, CAND_2] } } });
    await prisma.candidateDocument.deleteMany({ where: { candidateId: { in: [CAND_1, CAND_2] } } });
    await prisma.candidate.deleteMany({ where: { id: { in: [CAND_1, CAND_2] } } });
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
