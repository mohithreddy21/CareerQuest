import { Job, JobAnalysis, ExtractedRequirement } from '@/types/domain';
import { AnalysisProvider } from './analysis-service';

export class MockAnalysisProvider implements AnalysisProvider {
  async analyze(job: Job): Promise<JobAnalysis> {
    // 1. Role Classification
    const titleLower = job.title.toLowerCase();

    // Seniority extraction
    let seniority: JobAnalysis['seniority'] = 'mid';
    if (/\b(lead|staff|principal|head|director|architect)\b/i.test(titleLower)) {
      seniority = 'lead';
    } else if (/\b(senior|sr\.?)\b/i.test(titleLower)) {
      seniority = 'senior';
    } else if (/\b(junior|jr\.?|associate|entry|intern)\b/i.test(titleLower)) {
      seniority = 'entry';
    }

    // Role category extraction
    let roleCategory = 'Full-Stack Software Engineering';
    if (/design systems?|ui\/ux|design technologist/i.test(titleLower)) {
      roleCategory = 'Design Systems';
    } else if (/frontend|web client|ui/i.test(titleLower)) {
      roleCategory = 'Frontend Platform & DX';
    } else if (/backend|distributed systems|infrastructure|platform/i.test(titleLower)) {
      roleCategory = 'Backend & Distributed Systems';
    } else if (/data|analytics|pipeline|ml|ai/i.test(titleLower)) {
      roleCategory = 'Data & Machine Learning';
    } else if (/product/i.test(titleLower)) {
      roleCategory = 'Product Engineering';
    }

    // 2. Technical Requirements
    const technicalRequirements = Array.from(
      new Set([...job.requiredSkills, ...job.preferredSkills])
    );

    // 3. Meaningful Soft Skills extraction
    const softSkills: string[] = [];
    if (seniority === 'lead' || seniority === 'senior') {
      softSkills.push('Technical Leadership', 'Cross-functional Collaboration');
    } else {
      softSkills.push('Clear Written Communication', 'Cross-functional Collaboration');
    }

    if (roleCategory.includes('Frontend') || roleCategory.includes('Design')) {
      softSkills.push('Design & Product Empathy', 'Web Accessibility Standards');
    } else if (roleCategory.includes('Backend')) {
      softSkills.push('System Observability & Reliability', 'Incident Response');
    } else {
      softSkills.push('Problem Solving', 'Iterative Execution');
    }

    // 4. Important Keywords (for resume tailoring)
    const keywordsSet = new Set<string>();
    job.requiredSkills.forEach((s) => keywordsSet.add(s));
    if (job.preferredSkills) {
      job.preferredSkills.slice(0, 3).forEach((s) => keywordsSet.add(s));
    }
    if (job.workArrangement === 'remote') keywordsSet.add('Distributed Team');
    keywordsSet.add('High Performance');
    keywordsSet.add('Component Architecture');
    keywordsSet.add('Production Scalability');

    const importantKeywords = Array.from(keywordsSet).slice(0, 8);

    // 5. Structured Extracted Requirements
    const extractedRequirements: ExtractedRequirement[] = [
      ...job.requiredSkills.map((skill, idx) => ({
        id: `req-${job.id}-req-${idx + 1}`,
        text: `Demonstrated production proficiency with ${skill}.`,
        category: 'required' as const,
        priority: idx < 3 ? ('high' as const) : ('medium' as const)
      })),
      ...job.preferredSkills.map((skill, idx) => ({
        id: `req-${job.id}-pref-${idx + 1}`,
        text: `Working knowledge or experience with ${skill}.`,
        category: 'preferred' as const,
        priority: 'low' as const
      }))
    ];

    if (job.experienceRequirement) {
      extractedRequirements.unshift({
        id: `req-${job.id}-exp`,
        text: job.experienceRequirement,
        category: 'required',
        priority: 'high'
      });
    }

    return {
      id: `analysis-${job.id}`,
      jobId: job.id,
      seniority,
      roleCategory,
      technicalRequirements,
      softSkills,
      importantKeywords,
      extractedRequirements,
      analysisStatus: 'success'
    };
  }
}

export const mockAnalysisProvider = new MockAnalysisProvider();
