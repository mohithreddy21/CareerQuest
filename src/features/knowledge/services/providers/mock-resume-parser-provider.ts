import { ExtractedResumeData, ResumeParserProvider } from './resume-parser-provider';

const KNOWN_SKILL_DICTIONARY: {
  name: string;
  category: 'technical' | 'tools' | 'soft' | 'other';
  matchRegex: RegExp;
}[] = [
  // Languages & Core Frameworks
  { name: 'Python', category: 'technical', matchRegex: /\bpython\b/i },
  { name: 'TypeScript', category: 'technical', matchRegex: /\btypescript\b/i },
  { name: 'JavaScript', category: 'technical', matchRegex: /\bjavascript\b/i },
  { name: 'React', category: 'technical', matchRegex: /\breact(?:\.js)?\b/i },
  { name: 'Next.js', category: 'technical', matchRegex: /\bnext(?:\.js)?\b/i },
  { name: 'Node.js', category: 'technical', matchRegex: /\bnode(?:\.js)?\b/i },
  { name: 'Go', category: 'technical', matchRegex: /\b(?:golang|go)\b/i },
  { name: 'Rust', category: 'technical', matchRegex: /\brust\b/i },
  { name: 'Java', category: 'technical', matchRegex: /\bjava\b/i },
  { name: 'C++', category: 'technical', matchRegex: /\bc\+\+\b/i },
  { name: 'C#', category: 'technical', matchRegex: /\bc#\b/i },
  { name: 'SQL', category: 'technical', matchRegex: /\bsql\b/i },
  { name: 'PostgreSQL', category: 'technical', matchRegex: /\bpostgres(?:ql)?\b/i },
  { name: 'MySQL', category: 'technical', matchRegex: /\bmysql\b/i },
  { name: 'Redis', category: 'technical', matchRegex: /\bredis\b/i },
  { name: 'MongoDB', category: 'technical', matchRegex: /\bmongodb\b/i },
  { name: 'GraphQL', category: 'technical', matchRegex: /\bgraphql\b/i },
  { name: 'FastAPI', category: 'technical', matchRegex: /\bfastapi\b/i },
  { name: 'Django', category: 'technical', matchRegex: /\bdjango\b/i },
  { name: 'Tailwind CSS', category: 'technical', matchRegex: /\btailwind(?:\s*css)?\b/i },
  { name: 'HTML', category: 'technical', matchRegex: /\bhtml5?\b/i },
  { name: 'CSS', category: 'technical', matchRegex: /\bcss3?\b/i },
  { name: 'gRPC', category: 'technical', matchRegex: /\bgrpc\b/i },
  { name: 'REST APIs', category: 'technical', matchRegex: /\brest(?:ful)?\s*apis?\b/i },
  { name: 'WebSockets', category: 'technical', matchRegex: /\bwebsockets?\b/i },
  { name: 'Microservices', category: 'technical', matchRegex: /\bmicroservices?\b/i },
  { name: 'System Design', category: 'technical', matchRegex: /\bsystem\s*design\b/i },

  // Tools & Infrastructure
  { name: 'Docker', category: 'tools', matchRegex: /\bdocker\b/i },
  { name: 'Kubernetes', category: 'tools', matchRegex: /\b(?:kubernetes|k8s)\b/i },
  { name: 'AWS', category: 'tools', matchRegex: /\baws\b|\bamazon web services\b/i },
  { name: 'GCP', category: 'tools', matchRegex: /\bgcp\b|\bgoogle cloud\b/i },
  { name: 'Azure', category: 'tools', matchRegex: /\bazure\b/i },
  { name: 'Terraform', category: 'tools', matchRegex: /\bterraform\b/i },
  { name: 'CI/CD', category: 'tools', matchRegex: /\bci\/cd\b|\bcontinuous integration\b/i },
  { name: 'Git', category: 'tools', matchRegex: /\bgit\b|\bgithub\b|\bgitlab\b/i },
  { name: 'Linux', category: 'tools', matchRegex: /\blinux\b/i },
  { name: 'Prometheus', category: 'tools', matchRegex: /\bprometheus\b/i },
  { name: 'Grafana', category: 'tools', matchRegex: /\bgrafana\b/i },

  // Soft Skills
  {
    name: 'Technical Leadership',
    category: 'soft',
    matchRegex: /\b(?:technical\s*leadership|team\s*lead)\b/i
  },
  { name: 'Agile', category: 'soft', matchRegex: /\bagile\b/i },
  { name: 'Scrum', category: 'soft', matchRegex: /\bscrum\b/i },
  { name: 'Mentorship', category: 'soft', matchRegex: /\bmentorship|\bmentoring\b/i },
  { name: 'Cross-functional Collaboration', category: 'soft', matchRegex: /\bcross-functional\b/i }
];

export class MockResumeParserProvider implements ResumeParserProvider {
  readonly providerId = 'mock-resume-parser';

  async parseResume(file: { fileName: string; text?: string }): Promise<ExtractedResumeData> {
    const rawText = file.text?.trim() || '';

    // If real text was extracted from the document, parse it deterministically
    if (rawText.length > 20) {
      return this.parseFromText(file.fileName, rawText);
    }

    // Fallback simulation based on filename for unit tests that pass only filenames
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

    // Default simulation fallback
    return {
      rawText: 'Updated Senior Software Engineer Resume 2026...',
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

  private parseFromText(fileName: string, text: string): ExtractedResumeData {
    // 1. Extract Skills from text
    const matchedSkills: {
      name: string;
      category?: 'technical' | 'tools' | 'soft' | 'other';
      years?: number;
    }[] = [];
    const seenSkills = new Set<string>();

    for (const dictSkill of KNOWN_SKILL_DICTIONARY) {
      if (dictSkill.matchRegex.test(text)) {
        if (!seenSkills.has(dictSkill.name.toLowerCase())) {
          seenSkills.add(dictSkill.name.toLowerCase());
          matchedSkills.push({
            name: dictSkill.name,
            category: dictSkill.category
          });
        }
      }
    }

    // 2. Extract Experience from text lines
    const experienceList: ExtractedResumeData['experience'] = [];
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // Look for lines like "Role at Company" or "Role | Company"
    const expRegex = /^([A-Z][A-Za-z0-9\s/,-]+?)\s+(?:at|@|\|)\s+([A-Z][A-Za-z0-9\s/,-]+)$/;
    let currentExp: ExtractedResumeData['experience'][0] | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Bullet points for current experience
      if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
        const bullet = line.replace(/^[-•*]\s*/, '').trim();
        if (currentExp) {
          currentExp.responsibilities.push(bullet);
        }
        continue;
      }

      const match = line.match(expRegex);
      if (
        match &&
        !line.toLowerCase().includes('university') &&
        !line.toLowerCase().includes('school')
      ) {
        if (currentExp) {
          experienceList.push(currentExp);
        }

        const role = match[1].trim();
        const employer = match[2].trim();

        // Check if next line contains dates
        let startDate = '2022-01';
        let isCurrent = true;
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (/present|current/i.test(nextLine)) {
            isCurrent = true;
          }
          const yearMatch = nextLine.match(/\b(20\d\d)\b/);
          if (yearMatch) {
            startDate = `${yearMatch[1]}-01`;
          }
        }

        currentExp = {
          role,
          employer,
          startDate,
          isCurrent,
          responsibilities: [],
          achievements: [],
          rawSnippet: line
        };
      }
    }

    if (currentExp) {
      experienceList.push(currentExp);
    }

    // 3. Extract Education from text lines
    const educationList: ExtractedResumeData['education'] = [];
    const eduKeywords = /(?:university|college|institute|polytechnic|school)/i;
    for (const line of lines) {
      if (eduKeywords.test(line) && !line.startsWith('-')) {
        let degree = 'Bachelor of Science';
        if (/master/i.test(line)) degree = 'Master of Science';
        if (/bachelor|b\.s|b\.tech/i.test(line)) degree = 'Bachelor of Technology';

        let field = 'Computer Science';
        if (/electrical/i.test(line)) field = 'Electrical Engineering';
        if (/data/i.test(line)) field = 'Data Science';

        educationList.push({
          institution: line.split(/[|,-]/)[0].trim(),
          degree,
          fieldOfStudy: field,
          startDate: '2018-08',
          endDate: '2022-05',
          details: line
        });
      }
    }

    // 4. Extract Certifications
    const certList: ExtractedResumeData['certifications'] = [];
    if (/aws certified/i.test(text)) {
      certList.push({
        name: 'AWS Certified Solutions Architect',
        issuer: 'Amazon Web Services',
        issueDate: '2024-01'
      });
    }
    if (/cka|certified kubernetes/i.test(text)) {
      certList.push({
        name: 'Certified Kubernetes Administrator (CKA)',
        issuer: 'The Linux Foundation',
        issueDate: '2025-01'
      });
    }

    return {
      rawText: text,
      skills: matchedSkills,
      experience: experienceList,
      education: educationList,
      projects: [],
      certifications: certList,
      achievements: []
    };
  }
}

export const mockResumeParserProvider = new MockResumeParserProvider();
