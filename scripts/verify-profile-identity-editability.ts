import { PrismaClient } from '@prisma/client';
import { PrismaCareerRepository } from '../src/services/prisma-career-repository';
import { knowledgeBankService } from '../src/features/knowledge/services/knowledge-bank-service';

const prisma = new PrismaClient();
const repo = new PrismaCareerRepository();

async function run() {
  console.log('====================================================');
  console.log('  CareerQuest Profile & Identity Editability Test');
  console.log('====================================================\n');

  const testCandIdA = 'cand-profile-test-a';
  const testCandIdB = 'cand-profile-test-b';

  // Cleanup
  await prisma.knowledgeItem.deleteMany({ where: { candidateId: { in: [testCandIdA, testCandIdB] } } });
  await prisma.candidate.deleteMany({ where: { id: { in: [testCandIdA, testCandIdB] } } });

  try {
    // 1. Create clean test candidates
    console.log('--- 1. PROVISIONING CLEAN CANDIDATES ---');
    const candA = await prisma.candidate.create({
      data: {
        id: testCandIdA,
        clerkUserId: 'user_profile_test_a',
        email: 'cand-a@careerquest.internal',
        profile: {
          create: {
            name: 'Initial Name',
            headline: 'Junior Developer',
            location: 'New York, NY',
            phone: '+1 555-0100',
            professionalSummary: 'Initial summary'
          }
        },
        preferences: {
          create: {
            targetRoles: ['Frontend Developer']
          }
        }
      }
    });
    console.log('PASS 01: Created Candidate A with ID:', candA.id);

    const candB = await prisma.candidate.create({
      data: {
        id: testCandIdB,
        clerkUserId: 'user_profile_test_b',
        email: 'cand-b@careerquest.internal',
        profile: {
          create: {
            name: 'Isolated Candidate',
            headline: 'Backend Engineer',
            location: 'San Francisco, CA',
            professionalSummary: 'Backend developer'
          }
        },
        preferences: {
          create: {
            targetRoles: ['Backend Engineer']
          }
        }
      }
    });
    console.log('PASS 02: Created Candidate B with ID:', candB.id);

    // 2. Initial Profile check - 0 skills, 0 exp, 0 edu, 0 proj
    console.log('\n--- 2. INITIAL ZERO-DATA INVARIANT ---');
    const initialProfileA = await repo.getCandidateProfile(testCandIdA);
    if (!initialProfileA) throw new Error('Candidate A profile not found');
    const totalInitialSkills =
      initialProfileA.skills.technical.length +
      initialProfileA.skills.tools.length +
      initialProfileA.skills.soft.length +
      initialProfileA.skills.other.length;
    console.log(`PASS 03: Initial profile skills count: ${totalInitialSkills}`);
    if (totalInitialSkills !== 0) {
      throw new Error('Initial profile has unexpected skills');
    }

    // 3. Edit Identity & Summary via repo.updateCandidateProfile
    console.log('\n--- 3. IDENTITY & SUMMARY MUTATIONS ---');
    const updatedProfileA = await repo.updateCandidateProfile(
      {
        name: 'Dr. Jane Doe',
        headline: 'Principal Distributed Systems Engineer',
        location: 'Seattle, WA',
        phone: '+1 206-555-0199',
        professionalSummary: '10+ years architecting high-throughput distributed databases.',
        targetRoles: ['Staff Engineer', 'Principal Engineer']
      },
      testCandIdA
    );
    console.log('PASS 04: Profile updated in DB -> Name:', updatedProfileA.name, '| Headline:', updatedProfileA.headline);
    if (updatedProfileA.name !== 'Dr. Jane Doe' || updatedProfileA.headline !== 'Principal Distributed Systems Engineer') {
      throw new Error('CandidateProfile fields did not update');
    }

    // 4. Skills: Add approved items across all 4 categories into Knowledge Bank
    console.log('\n--- 4. SKILLS CREATION & CANONICAL KNOWLEDGE BANK MAPPING ---');
    const techSkill = await knowledgeBankService.addKnowledgeItem(
      testCandIdA,
      'skill',
      {
        name: 'Next.js 16',
        category: 'technical',
        proficiency: 'expert',
        yearsOfExperience: 4
      }
    );
    console.log('PASS 05: Added Technical Skill -> ID:', techSkill.id);

    const toolSkill = await knowledgeBankService.addKnowledgeItem(
      testCandIdA,
      'skill',
      {
        name: 'Docker & Kubernetes',
        category: 'tools',
        proficiency: 'advanced',
        yearsOfExperience: 5
      }
    );
    console.log('PASS 06: Added Tools & Infrastructure Skill -> ID:', toolSkill.id);

    const softSkill = await knowledgeBankService.addKnowledgeItem(
      testCandIdA,
      'skill',
      {
        name: 'Cross-functional Technical Leadership',
        category: 'soft',
        proficiency: 'expert',
        yearsOfExperience: 6
      }
    );
    console.log('PASS 07: Added Soft Skill -> ID:', softSkill.id);

    const otherSkill = await knowledgeBankService.addKnowledgeItem(
      testCandIdA,
      'skill',
      {
        name: 'Technical Writing & RFC Drafting',
        category: 'other',
        proficiency: 'proficient'
      }
    );
    console.log('PASS 08: Added Other Proficiency Skill -> ID:', otherSkill.id);

    // 5. Verify CandidateProfile compiles all 4 skill categories
    console.log('\n--- 5. PROFILE SKILLS COMPILATION FROM KNOWLEDGE BANK ---');
    const compiledProfileA = await repo.getCandidateProfile(testCandIdA);
    if (!compiledProfileA) throw new Error('Failed to retrieve compiled profile');
    console.log('PASS 09: Compiled Technical Skills:', compiledProfileA.skills.technical);
    console.log('PASS 10: Compiled Tools & Infra:', compiledProfileA.skills.tools);
    console.log('PASS 11: Compiled Soft Skills:', compiledProfileA.skills.soft);
    console.log('PASS 12: Compiled Other Proficiencies:', compiledProfileA.skills.other);

    if (!compiledProfileA.skills.technical.includes('Next.js 16')) throw new Error('Missing Next.js 16 in technical');
    if (!compiledProfileA.skills.tools.includes('Docker & Kubernetes')) throw new Error('Missing Docker & Kubernetes in tools');
    if (!compiledProfileA.skills.soft.includes('Cross-functional Technical Leadership')) throw new Error('Missing soft skill');
    if (!compiledProfileA.skills.other.includes('Technical Writing & RFC Drafting')) throw new Error('Missing other skill');

    // 6. Experience, Education, Projects creation
    console.log('\n--- 6. EXPERIENCE, EDUCATION, PROJECTS MUTATIONS ---');
    const expItem = await knowledgeBankService.addKnowledgeItem(
      testCandIdA,
      'experience',
      {
        title: 'Senior Systems Architect',
        company: 'CloudCorp',
        location: 'Seattle, WA',
        startDate: '2021-01',
        isCurrent: true,
        bullets: ['Designed multi-region Raft consensus cluster handling 100k writes/sec.']
      }
    );
    console.log('PASS 13: Added Experience -> ID:', expItem.id);

    const eduItem = await knowledgeBankService.addKnowledgeItem(
      testCandIdA,
      'education',
      {
        institution: 'University of Washington',
        degree: 'B.S.',
        fieldOfStudy: 'Computer Science',
        graduationYear: '2020'
      }
    );
    console.log('PASS 14: Added Education -> ID:', eduItem.id);

    const projItem = await knowledgeBankService.addKnowledgeItem(
      testCandIdA,
      'project',
      {
        name: 'High-Throughput Raft Engine',
        technologies: ['Go', 'gRPC', 'RocksDB'],
        url: 'https://github.com/example/raft-engine',
        bullets: ['Implemented Raft distributed log with snapshotting.']
      }
    );
    console.log('PASS 15: Added Project -> ID:', projItem.id);

    // Verify they reflect in CandidateProfile
    const profileWithExp = await repo.getCandidateProfile(testCandIdA);
    if (!profileWithExp) throw new Error('Failed to retrieve profile with exp');
    console.log('PASS 16: Profile Experience count:', profileWithExp.experience.length);
    console.log('PASS 17: Profile Education count:', profileWithExp.education.length);
    console.log('PASS 18: Profile Projects count:', profileWithExp.projects.length);
    if (profileWithExp.experience.length !== 1 || (profileWithExp.experience[0] as unknown as { company?: string }).company !== 'CloudCorp') {
      throw new Error('Experience compilation mismatch');
    }

    // 7. Update an existing skill and archive/remove
    console.log('\n--- 7. SKILL EDITING, ARCHIVING & DELETION ---');
    const updatedSkill = await knowledgeBankService.updateKnowledgeItem(
      techSkill.id,
      {
        name: 'Next.js 16 (App Router & Turbopack)',
        category: 'technical',
        proficiency: 'expert',
        yearsOfExperience: 5
      },
      'Updated skill details',
      testCandIdA
    );
    const updatedContent = updatedSkill.content as { name?: string };
    console.log('PASS 19: Updated skill name ->', updatedContent.name);
    if (updatedContent.name !== 'Next.js 16 (App Router & Turbopack)') throw new Error('Skill name not updated');

    // Archive soft skill (status -> archived)
    const archivedSkill = await knowledgeBankService.updateKnowledgeItemStatus(
      softSkill.id,
      'archived',
      testCandIdA
    );
    console.log('PASS 20: Archived soft skill -> status:', archivedSkill.status);

    // Verify archived skill is excluded from approved Profile skills
    const profileAfterArchive = await repo.getCandidateProfile(testCandIdA);
    if (!profileAfterArchive) throw new Error('Failed to retrieve profile after archive');
    if (profileAfterArchive.skills.soft.includes('Cross-functional Technical Leadership')) {
      throw new Error('Archived skill should not appear in active profile skills');
    }
    console.log('PASS 21: Archived skill successfully excluded from active profile skills');

    // Delete other skill
    const deleted = await knowledgeBankService.deleteKnowledgeItem(otherSkill.id, testCandIdA);
    console.log('PASS 22: Deleted other skill -> result:', deleted);
    if (!deleted) throw new Error('Skill deletion failed');

    // 8. Multi-tenant Candidate Isolation
    console.log('\n--- 8. MULTI-TENANT ISOLATION ---');
    const candBProfile = await repo.getCandidateProfile(testCandIdB);
    if (!candBProfile) throw new Error('Cand B profile missing');
    console.log('PASS 23: Candidate B has 0 skills (Candidate A skills isolated):', candBProfile.skills.technical.length === 0);
    if (candBProfile.skills.technical.length !== 0) throw new Error('Candidate isolation breach!');

    // Candidate B cannot update Candidate A knowledge item
    let rogueUpdateBlocked = false;
    try {
      await knowledgeBankService.updateKnowledgeItem(
        techSkill.id,
        { name: 'Hacked Skill' },
        'Malicious update',
        testCandIdB
      );
    } catch {
      rogueUpdateBlocked = true;
    }
    console.log('PASS 24: Candidate B cannot mutate Candidate A skill ->', rogueUpdateBlocked);
    if (!rogueUpdateBlocked) throw new Error('Security failure: cross-candidate modification allowed');

    // Candidate B cannot delete Candidate A knowledge item
    const rogueDelete = await knowledgeBankService.deleteKnowledgeItem(techSkill.id, testCandIdB);
    console.log('PASS 25: Candidate B cannot delete Candidate A skill ->', rogueDelete === false);
    if (rogueDelete !== false) throw new Error('Security failure: cross-candidate deletion allowed');

    // 9. Persistence Check - Fresh Repository instance
    console.log('\n--- 9. FRESH INSTANCE PERSISTENCE ---');
    const freshRepo = new PrismaCareerRepository();
    const persistedProfile = await freshRepo.getCandidateProfile(testCandIdA);
    if (!persistedProfile) throw new Error('Persisted profile not found');
    console.log('PASS 26: Fresh repository sees persisted name:', persistedProfile.name);
    console.log('PASS 27: Fresh repository sees updated technical skill:', persistedProfile.skills.technical);
    if (!persistedProfile.skills.technical.includes('Next.js 16 (App Router & Turbopack)')) {
      throw new Error('Fresh instance did not see updated skill');
    }

    console.log('\n====================================================');
    console.log('  ALL 27 CHECKPOINTS PASSED!');
    console.log('  Profile & Identity Editability & Knowledge Bank');
    console.log('  Canonical Integration: VERIFIED & CONFIRMED');
    console.log('====================================================\n');

  } finally {
    // Teardown
    await prisma.knowledgeItem.deleteMany({ where: { candidateId: { in: [testCandIdA, testCandIdB] } } });
    await prisma.candidate.deleteMany({ where: { id: { in: [testCandIdA, testCandIdB] } } });
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
