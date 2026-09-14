import { ExtractedResumeData, ResumeParserProvider } from './resume-parser-provider';

export class MockResumeParserProvider implements ResumeParserProvider {
  async parseResume(file: { fileName: string; text?: string }): Promise<ExtractedResumeData> {
    // Deterministic simulation based on filename or text
    const lowerName = file.fileName.toLowerCase();

    if (lowerName.includes('devops') || lowerName.includes('cloud')) {
      return {
        rawText: 'DevOps & Cloud Engineering profile update...',
        skills: [
          { name: 'Terraform', category: 'tools', years: 3 },
          { name: 'Kubernetes', category: 'tools', years: 3 },
          { name: 'Prometheus', category: 'tools', years: 2 },
          { name: 'AWS', category: 'tools', years: 4 }
        ],
        experience: [],
        education: [],
        projects: [],
        certifications: [
          {
            name: 'AWS Certified DevOps Engineer - Professional',
            issuer: 'Amazon Web Services',
            issueDate: '2025-11',
            credentialId: 'AWS-DOP-49102'
          }
        ],
        achievements: [
          {
            title: 'Automated CI/CD Pipeline Fleet',
            description: 'Reduced deployment failure rate by 70% with automated canary releases.',
            metric: '70% reduction in deployment failures'
          }
        ]
      };
    }

    // Default 2026 Updated Resume mock
    return {
      rawText: 'Alex Chen Updated Senior Software Engineer Resume 2026...',
      skills: [
        { name: 'TypeScript', category: 'technical', years: 6 },
        { name: 'React', category: 'technical', years: 7 },
        { name: 'gRPC', category: 'technical', years: 2 },
        { name: 'Go (Golang)', category: 'technical', years: 3 },
        { name: 'PostgreSQL', category: 'technical', years: 5 }
      ],
      experience: [
        {
          employer: 'Veloce Labs',
          role: 'Staff Software Engineer',
          location: 'San Francisco, CA',
          startDate: '2022-03',
          isCurrent: true,
          responsibilities: [
            'Spearheaded architecture of core workspace dashboard used by 120k+ monthly active users.',
            'Reduced p95 page load times from 2.4s to 420ms through SSR streaming.'
          ],
          achievements: ['Promoted to Staff Software Engineer leading cross-squad architecture.'],
          rawSnippet:
            'Staff Software Engineer at Veloce Labs (2022 - Present). Led architecture of core dashboard.'
        }
      ],
      education: [],
      projects: [],
      certifications: [
        {
          name: 'Certified Kubernetes Administrator (CKA)',
          issuer: 'The Linux Foundation',
          issueDate: '2026-02',
          credentialId: 'LF-CKA-294821'
        }
      ],
      achievements: [
        {
          title: 'WebSocket Latency Reduction',
          description:
            'Optimized real-time pub/sub synchronization pipeline decreasing state sync latency by 65%.',
          metric: '65% latency reduction'
        }
      ]
    };
  }
}

export const mockResumeParserProvider = new MockResumeParserProvider();
