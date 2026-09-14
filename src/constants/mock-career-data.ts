import {
  Application,
  ApplicationEvent,
  CandidateProfile,
  Job,
  JobAnalysis,
  JobMatch,
  ResumeVersion,
  CandidateKnowledgeBank,
  ProposedIngestionBatch
} from '@/types/domain';

export interface CareerDatabase {
  candidate: CandidateProfile;
  jobs: Job[];
  analyses: JobAnalysis[];
  matches: JobMatch[];
  resumes: ResumeVersion[];
  applications: Application[];
  applicationEvents: ApplicationEvent[];
  knowledgeBank: CandidateKnowledgeBank;
  proposedBatches: ProposedIngestionBatch[];
  documents?: import('@/types').CandidateDocument[];
  resumeExports?: import('@/types').ResumeExport[];
}

export const initialCareerData: CareerDatabase = {
  candidate: {
    id: 'cand-1',
    userId: 'user_mock_01',
    name: 'Alex Chen',
    email: 'alex.chen@example.com',
    phone: '+1 (555) 234-5678',
    location: 'San Francisco, CA',
    professionalSummary:
      'Senior Full-Stack & Frontend Engineer with 7+ years of experience building resilient web applications, design systems, and distributed cloud services. Experienced in React, Next.js, TypeScript, Node.js, and relational database architecture.',
    targetRoles: [
      'Senior Full-Stack Engineer',
      'Senior Frontend Engineer',
      'Staff Software Engineer'
    ],
    experience: [
      {
        id: 'exp-1',
        employer: 'Veloce Labs',
        role: 'Senior Full-Stack Engineer',
        location: 'San Francisco, CA',
        startDate: '2022-03',
        endDate: undefined,
        isCurrent: true,
        responsibilities: [
          'Led architecture of core workspace dashboard used by 120k+ monthly active users.',
          'Reduced p95 page load times from 2.4s to 420ms through SSR streaming and query cache normalization.',
          'Engineered real-time collaboration pipeline using WebSocket pub/sub and optimistic UI updates.'
        ],
        achievements: [
          'Reduced API latency by 45% with Redis tiered caching.',
          'Mentored 4 junior and mid-level engineers across product feature squads.'
        ],
        candidateEvidence:
          'Led full-stack architecture, React/Next.js performance optimization, and distributed query caching at Veloce Labs.'
      },
      {
        id: 'exp-2',
        employer: 'Apex Cloud Systems',
        role: 'Full-Stack Software Engineer',
        location: 'San Jose, CA',
        startDate: '2019-06',
        endDate: '2022-02',
        isCurrent: false,
        responsibilities: [
          'Developed microservices in Node.js and TypeScript handling payment reconciliation.',
          'Designed PostgreSQL schema migrations and indexing strategies handling 4M+ daily transactions.',
          'Collaborated with product designers to implement reusable design-system components.'
        ],
        achievements: [
          'Maintained 99.98% uptime across payment billing microservices.',
          'Shipped design system library adopted across 6 internal engineering teams.'
        ],
        candidateEvidence:
          'Implemented payment reconciliation microservices, PostgreSQL query optimization, and component design systems at Apex Cloud Systems.'
      }
    ],
    education: [
      {
        id: 'edu-1',
        institution: 'University of California, Berkeley',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        startDate: '2015-08',
        endDate: '2019-05',
        details: 'Dean’s Honor List, Focus on Distributed Systems and Human-Computer Interaction.'
      }
    ],
    skills: {
      technical: [
        'TypeScript',
        'JavaScript (ESNext)',
        'React 19',
        'Next.js (App Router)',
        'Node.js',
        'Go',
        'PostgreSQL',
        'Redis',
        'GraphQL',
        'REST APIs'
      ],
      tools: [
        'Docker',
        'Git',
        'Kubernetes',
        'AWS (ECS, S3, RDS)',
        'Tailwind CSS',
        'TanStack Query',
        'Postman'
      ],
      soft: [
        'System Design',
        'Technical Mentorship',
        'Cross-functional Collaboration',
        'Product Strategy'
      ],
      other: ['CI/CD (GitHub Actions)', 'Design Systems', 'Performance Profiling']
    },
    projects: [
      {
        id: 'proj-1',
        name: 'OpenMetric Dashboard',
        description:
          'Open-source performance observability tool for Next.js App Router applications.',
        technologies: ['Next.js', 'TypeScript', 'Tailwind CSS', 'PostgreSQL'],
        contributions:
          'Architected core telemetry ingestion engine and real-time visualization widgets.',
        outcomes: 'Earned 1.8k GitHub stars and used by over 300 active teams.',
        url: 'https://github.com/alexchen/openmetric'
      }
    ],
    certifications: [
      {
        id: 'cert-1',
        name: 'AWS Certified Solutions Architect - Associate',
        issuer: 'Amazon Web Services',
        issueDate: '2023-04',
        credentialId: 'AWS-ASA-99482'
      }
    ],
    preferences: {
      targetRoles: ['Senior Full-Stack Engineer', 'Frontend Platform Engineer'],
      preferredLocations: ['San Francisco, CA', 'Remote', 'New York, NY'],
      workArrangements: ['remote', 'hybrid'],
      targetSalaryMin: 165000,
      currency: 'USD'
    },
    masterResumeId: 'res-master'
  },

  jobs: [
    {
      id: 'job-1',
      title: 'Senior Full-Stack Engineer',
      company: 'Stripe',
      location: 'San Francisco, CA',
      workArrangement: 'hybrid',
      description:
        'Stripe is looking for a Senior Full-Stack Engineer to build scalable infrastructure and customer-facing interfaces for Stripe Billing. You will work on distributed payment systems, developer-facing dashboards, and real-time checkout flows.',
      responsibilities: [
        'Design, build, and maintain APIs, services, and user interfaces across Stripe products.',
        'Scale merchant billing pipelines processing hundreds of millions of dollars daily.',
        'Partner with product managers and designers to craft elegant developer experiences.',
        'Improve engineering standards, tooling, and operational stability.'
      ],
      requiredSkills: ['React', 'TypeScript', 'Node.js', 'Distributed Systems', 'PostgreSQL'],
      preferredSkills: ['Go', 'Microservices', 'GraphQL', 'Fintech Experience'],
      experienceRequirement: '5+ years software engineering experience',
      educationRequirement:
        "Bachelor's degree in Computer Science or equivalent practical experience",
      salary: {
        min: 165000,
        max: 195000,
        currency: 'USD',
        interval: 'yearly'
      },
      postedDate: '2026-09-01',
      source: 'linkedin',
      originalUrl: 'https://stripe.com/jobs/senior-full-stack-billing',
      normalizedAt: '2026-09-02T10:00:00Z',
      jobStatus: 'active'
    },
    {
      id: 'job-2',
      title: 'Backend Systems Engineer',
      company: 'Datadog',
      location: 'New York, NY',
      workArrangement: 'hybrid',
      description:
        'Datadog is looking for a Backend Systems Engineer to join our APM ingestion team. You will build high-throughput distributed pipelines ingesting trillions of telemetry data points daily with sub-second latencies.',
      responsibilities: [
        'Build high-performance streaming pipelines handling massive telemetry payloads.',
        'Optimize data storage engines and query paths for real-time analytics.',
        'Ensure system reliability, low latency, and horizontal scalability.',
        'Participate in on-call rotation and production incident response.'
      ],
      requiredSkills: ['Go', 'Distributed Systems', 'PostgreSQL', 'Kafka', 'Kubernetes'],
      preferredSkills: ['Rust', 'Telemetry/APM', 'Cassandra', 'eBPF'],
      experienceRequirement: '4+ years building high-scale backend services',
      educationRequirement: "Bachelor's in CS or equivalent field",
      salary: {
        min: 170000,
        max: 200000,
        currency: 'USD',
        interval: 'yearly'
      },
      postedDate: '2026-09-02',
      source: 'indeed',
      originalUrl: 'https://careers.datadoghq.com/detail/backend-systems',
      normalizedAt: '2026-09-03T11:30:00Z',
      jobStatus: 'active'
    },
    {
      id: 'job-3',
      title: 'Frontend Platform Engineer',
      company: 'Vercel',
      location: 'Remote',
      workArrangement: 'remote',
      description:
        'Vercel is seeking a Frontend Platform Engineer to advance our design system, core dashboard architecture, and developer workflows. You will pioneer Next.js features and build world-class user interfaces.',
      responsibilities: [
        'Architect and evolve shared UI components and design systems for vercel.com.',
        'Optimize client-side runtime performance, bundle size, and Core Web Vitals.',
        'Collaborate with the Next.js core team to dogfood upcoming framework primitives.',
        'Establish automated visual regression and accessibility testing standards.'
      ],
      requiredSkills: ['React', 'Next.js', 'TypeScript', 'Design Systems', 'Web Performance'],
      preferredSkills: ['Tailwind CSS', 'Accessibility (a11y)', 'Monorepos', 'Rust/Turbopack'],
      experienceRequirement: '5+ years frontend/web engineering experience',
      educationRequirement: 'B.S. in Computer Science or equivalent',
      salary: {
        min: 160000,
        max: 185000,
        currency: 'USD',
        interval: 'yearly'
      },
      postedDate: '2026-08-24',
      source: 'url_import',
      originalUrl: 'https://vercel.com/careers/frontend-platform',
      normalizedAt: '2026-08-25T14:15:00Z',
      jobStatus: 'active'
    },
    {
      id: 'job-4',
      title: 'Staff Software Engineer, Developer Experience',
      company: 'Linear',
      location: 'Remote',
      workArrangement: 'remote',
      description:
        'Linear is looking for a Staff Software Engineer to lead frontend architecture and performance. You will build lightning-fast desktop and web applications with offline-first synchronisation and bespoke keyboard-driven interactions.',
      responsibilities: [
        'Lead architectural initiatives across our sync engine and client applications.',
        'Maintain sub-50ms interaction latency across complex issue graphs and boards.',
        'Drive technical roadmap and mentor engineers across multiple feature groups.',
        'Design intuitive keyboard navigation and offline conflict resolution models.'
      ],
      requiredSkills: [
        'TypeScript',
        'React',
        'Real-time Sync',
        'SQLite',
        'Performance Optimization'
      ],
      preferredSkills: ['Electron', 'Offline-First Systems', 'WebSockets', 'Canvas rendering'],
      experienceRequirement: '8+ years engineering experience',
      educationRequirement: 'Relevant degree or equivalent experience',
      salary: {
        min: 190000,
        max: 220000,
        currency: 'USD',
        interval: 'yearly'
      },
      postedDate: '2026-09-05',
      source: 'manual',
      originalUrl: 'https://linear.app/careers/staff-engineer',
      normalizedAt: '2026-09-06T09:00:00Z',
      jobStatus: 'active'
    },
    {
      id: 'job-5',
      title: 'Senior Frontend Engineer, Design Systems',
      company: 'Figma',
      location: 'San Francisco, CA',
      workArrangement: 'hybrid',
      description:
        'Figma is looking for a Senior Frontend Engineer to build and scale our web client and collaborative canvas controls.',
      responsibilities: [
        'Build accessible, performant design components used across Figma Web.',
        'Optimize canvas rendering and collaborative UI interactions.'
      ],
      requiredSkills: ['React', 'TypeScript', 'Design Systems', 'CSS Architecture'],
      preferredSkills: ['WebGL', 'WebAssembly', 'Canvas API'],
      experienceRequirement: '5+ years experience',
      salary: {
        min: 175000,
        max: 205000,
        currency: 'USD',
        interval: 'yearly'
      },
      postedDate: '2026-08-12',
      source: 'linkedin',
      originalUrl: 'https://figma.com/careers/senior-frontend',
      normalizedAt: '2026-08-15T08:00:00Z',
      jobStatus: 'active'
    },
    {
      id: 'job-6',
      title: 'Full-Stack Product Engineer',
      company: 'Notion',
      location: 'San Francisco, CA',
      workArrangement: 'hybrid',
      description:
        'Notion is looking for a Product Engineer to craft block-based editing experiences and workspace integrations.',
      responsibilities: [
        'Develop block editor capabilities and document collaboration tools.',
        'Build APIs for third-party workspace integrations.'
      ],
      requiredSkills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
      preferredSkills: ['IndexedDB', 'CRDTs', 'Rich Text Editors'],
      experienceRequirement: '4+ years experience',
      salary: {
        min: 170000,
        max: 195000,
        currency: 'USD',
        interval: 'yearly'
      },
      postedDate: '2026-08-08',
      source: 'linkedin',
      originalUrl: 'https://notion.so/careers/product-engineer',
      normalizedAt: '2026-08-10T11:00:00Z',
      jobStatus: 'active'
    },
    {
      id: 'job-7',
      title: 'Staff Frontend Infrastructure Engineer',
      company: 'Airbnb',
      location: 'San Francisco, CA',
      workArrangement: 'hybrid',
      description:
        'Airbnb is looking for a Staff Frontend Infrastructure Engineer to lead core web runtime performance, bundle optimization, and shared design system tooling across our host and guest experiences.',
      responsibilities: [
        'Scale frontend infrastructure supporting 400+ product engineers.',
        'Optimize CI build, bundle splitting, and SSR hydration performance.',
        'Partner with architecture council to maintain 99.9% web runtime availability.'
      ],
      requiredSkills: ['TypeScript', 'React', 'Design Systems', 'Web Performance', 'Node.js'],
      preferredSkills: ['Rust', 'GraphQL', 'Webpack/Vite', 'Micro-frontends'],
      experienceRequirement: '7+ years web engineering and infrastructure experience',
      educationRequirement: "Bachelor's degree in CS or equivalent",
      salary: {
        min: 195000,
        max: 235000,
        currency: 'USD',
        interval: 'yearly'
      },
      postedDate: '2026-08-05',
      source: 'linkedin',
      originalUrl: 'https://careers.airbnb.com/positions/staff-frontend-infra',
      normalizedAt: '2026-08-06T10:00:00Z',
      jobStatus: 'active'
    },
    {
      id: 'job-8',
      title: 'Full-Stack Collaboration Engineer',
      company: 'GitHub',
      location: 'Remote',
      workArrangement: 'remote',
      description:
        'Join GitHub Issues and Projects team to engineer real-time collaboration, markdown editing, and project planning tooling used by millions of open-source and enterprise developers worldwide.',
      responsibilities: [
        'Develop real-time collaborative workspace features and markdown editors.',
        'Ensure WCAG 2.2 AA accessibility and keyboard shortcut performance.',
        'Scale background job processing and WebSocket synchronization pipelines.'
      ],
      requiredSkills: ['TypeScript', 'React', 'Ruby on Rails', 'WebSockets', 'Accessibility'],
      preferredSkills: ['GraphQL', 'Go', 'Redis Pub/Sub'],
      experienceRequirement: '5+ years full-stack engineering experience',
      educationRequirement: "Bachelor's in Computer Science or equivalent",
      salary: {
        min: 175000,
        max: 205000,
        currency: 'USD',
        interval: 'yearly'
      },
      postedDate: '2026-08-15',
      source: 'linkedin',
      originalUrl: 'https://github.com/about/careers/collab-engineer',
      normalizedAt: '2026-08-16T12:00:00Z',
      jobStatus: 'active'
    }
  ],

  analyses: [
    {
      id: 'analysis-1',
      jobId: 'job-1',
      seniority: 'senior',
      roleCategory: 'Full-Stack Engineering',
      technicalRequirements: [
        'React',
        'TypeScript',
        'Node.js',
        'Distributed Systems',
        'PostgreSQL'
      ],
      softSkills: ['System Design', 'Communication', 'Cross-functional Execution'],
      importantKeywords: ['Billing', 'Payments', 'Microservices', 'High-throughput'],
      extractedRequirements: [
        {
          id: 'req-1-1',
          text: '5+ years software engineering experience with modern TypeScript and React.',
          category: 'required',
          priority: 'high'
        },
        {
          id: 'req-1-2',
          text: 'Proven experience designing distributed services and relational data models.',
          category: 'required',
          priority: 'high'
        },
        {
          id: 'req-1-3',
          text: 'Experience with high-volume payment processing or transactional services.',
          category: 'preferred',
          priority: 'medium'
        }
      ],
      analysisStatus: 'success'
    },
    {
      id: 'analysis-2',
      jobId: 'job-2',
      seniority: 'senior',
      roleCategory: 'Backend & Distributed Systems',
      technicalRequirements: ['Go', 'Distributed Systems', 'Kafka', 'Kubernetes', 'PostgreSQL'],
      softSkills: ['System Observability', 'Mentorship', 'Incident Response'],
      importantKeywords: ['Telemetry', 'High-throughput', 'Streaming', 'Sub-second latency'],
      extractedRequirements: [
        {
          id: 'req-2-1',
          text: '4+ years experience developing high-concurrency backend services in Go.',
          category: 'required',
          priority: 'high'
        },
        {
          id: 'req-2-2',
          text: 'Hands-on experience with Kafka streaming pipelines and Kubernetes orchestration.',
          category: 'required',
          priority: 'high'
        },
        {
          id: 'req-2-3',
          text: 'Experience with telemetry/APM or low-level performance profiling.',
          category: 'preferred',
          priority: 'medium'
        }
      ],
      analysisStatus: 'success'
    },
    {
      id: 'analysis-3',
      jobId: 'job-3',
      seniority: 'senior',
      roleCategory: 'Frontend Platform & DX',
      technicalRequirements: [
        'React',
        'Next.js',
        'TypeScript',
        'Design Systems',
        'Web Performance'
      ],
      softSkills: ['Developer Empathy', 'Cross-team Alignment', 'Accessibility focus'],
      importantKeywords: ['Core Web Vitals', 'SSR', 'Tailwind', 'Component Architecture'],
      extractedRequirements: [
        {
          id: 'req-3-1',
          text: 'Deep expertise in React, Next.js (App Router), and modern TypeScript.',
          category: 'required',
          priority: 'high'
        },
        {
          id: 'req-3-2',
          text: 'Experience building, documenting, and maintaining multi-team design systems.',
          category: 'required',
          priority: 'high'
        },
        {
          id: 'req-3-3',
          text: 'Demonstrated mastery of Core Web Vitals optimization and accessibility (WCAG AA).',
          category: 'required',
          priority: 'medium'
        }
      ],
      analysisStatus: 'success'
    },
    {
      id: 'analysis-4',
      jobId: 'job-4',
      seniority: 'lead',
      roleCategory: 'Frontend Architecture & Offline Systems',
      technicalRequirements: [
        'TypeScript',
        'React',
        'Real-time Sync',
        'SQLite',
        'Performance Optimization'
      ],
      softSkills: ['Technical Leadership', 'Product Sense', 'High Autonomy'],
      importantKeywords: [
        'Sub-50ms latency',
        'Keyboard-first',
        'Offline-first',
        'Conflict Resolution'
      ],
      extractedRequirements: [
        {
          id: 'req-4-1',
          text: '8+ years software engineering experience with deep focus on web performance.',
          category: 'required',
          priority: 'high'
        },
        {
          id: 'req-4-2',
          text: 'Experience architecting client-side databases (SQLite, IndexedDB) and sync protocols.',
          category: 'required',
          priority: 'high'
        },
        {
          id: 'req-4-3',
          text: 'Background creating bespoke desktop-grade client applications with Electron.',
          category: 'preferred',
          priority: 'medium'
        }
      ],
      analysisStatus: 'success'
    },
    {
      id: 'analysis-5',
      jobId: 'job-5',
      seniority: 'senior',
      roleCategory: 'Design Systems',
      technicalRequirements: ['React', 'TypeScript', 'Design Systems', 'CSS Architecture'],
      softSkills: ['Design Collaboration', 'Accessibility'],
      importantKeywords: ['Design Tokens', 'Web Accessibility', 'Canvas UI'],
      extractedRequirements: [
        {
          id: 'req-5-1',
          text: '5+ years building production design system component libraries.',
          category: 'required',
          priority: 'high'
        }
      ],
      analysisStatus: 'success'
    },
    {
      id: 'analysis-6',
      jobId: 'job-6',
      seniority: 'mid',
      roleCategory: 'Product Engineering',
      technicalRequirements: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
      softSkills: ['Product Strategy', 'Iterative Execution'],
      importantKeywords: ['Block editor', 'Integrations', 'Collaboration'],
      extractedRequirements: [
        {
          id: 'req-6-1',
          text: '4+ years full-stack product development experience.',
          category: 'required',
          priority: 'high'
        }
      ],
      analysisStatus: 'success'
    }
  ],

  matches: [
    {
      id: 'match-1',
      jobId: 'job-1',
      candidateId: 'cand-1',
      score: 94,
      recommendation: 'strong',
      headline: 'Strong opportunity — Excellent alignment with core stack and experience.',
      reasoning:
        'Your 7+ years of experience with React, TypeScript, and Node.js directly matches Stripe’s Billing team requirements. Your background in payment reconciliation at Apex Cloud Systems provides exceptional domain relevance.',
      strongMatches: [
        {
          requirementId: 'req-1-1',
          title: 'Full-Stack TypeScript & React',
          detail: '7+ years production experience leading frontend and backend teams.'
        },
        {
          requirementId: 'req-1-2',
          title: 'Transactional Data & PostgreSQL',
          detail:
            'Architected PostgreSQL schemas handling 4M+ daily transactions at Apex Cloud Systems.'
        }
      ],
      partialMatches: [
        {
          requirementId: 'req-1-3',
          title: 'Go Language Proficiency',
          detail:
            'Candidate has working knowledge of Go, though majority of recent projects use TypeScript/Node.'
        }
      ],
      missingRequirements: [],
      supportingCandidateEvidence: [
        {
          requirementText: 'Design, build, and maintain APIs and distributed services.',
          evidenceSource: 'Veloce Labs (Senior Full-Stack Engineer)',
          evidenceSnippet:
            'Led architecture of core workspace dashboard used by 120k+ monthly active users and reduced API latency by 45%.'
        },
        {
          requirementText: 'Scale merchant billing pipelines and payment services.',
          evidenceSource: 'Apex Cloud Systems (Full-Stack Engineer)',
          evidenceSnippet:
            'Developed microservices handling payment reconciliation with 99.98% uptime.'
        }
      ]
    },
    {
      id: 'match-2',
      jobId: 'job-2',
      candidateId: 'cand-1',
      score: 82,
      recommendation: 'good',
      headline: 'Good match — Strong backend fundamentals; Kafka and Kubernetes are minor gaps.',
      reasoning:
        'You demonstrate exceptional distributed systems and PostgreSQL proficiency. While you have Go and Docker experience, hands-on production Kafka streaming is a minor area to review.',
      strongMatches: [
        {
          requirementId: 'req-2-1',
          title: 'High-Scale Backend Services',
          detail:
            'Demonstrated experience with high-throughput microservices and latency optimization.'
        },
        {
          requirementId: 'req-2-2',
          title: 'Relational Database Optimization',
          detail: 'Deep PostgreSQL indexing and migration expertise.'
        }
      ],
      partialMatches: [
        {
          requirementId: 'req-2-2',
          title: 'Kafka Streaming Pipelines',
          detail:
            'Experience with Redis pub/sub and WebSockets, but less dedicated Kafka stream processing.'
        }
      ],
      missingRequirements: [
        {
          requirementId: 'req-2-3',
          title: 'eBPF / Low-Level Profiling',
          detail: 'No direct eBPF experience listed in profile.'
        }
      ],
      supportingCandidateEvidence: [
        {
          requirementText: 'Build high-performance streaming pipelines and optimize query paths.',
          evidenceSource: 'Veloce Labs',
          evidenceSnippet:
            'Reduced p95 page load times from 2.4s to 420ms through SSR streaming and cache normalization.'
        }
      ]
    },
    {
      id: 'match-3',
      jobId: 'job-3',
      candidateId: 'cand-1',
      score: 91,
      recommendation: 'strong',
      headline: 'Strong opportunity — Direct match for Next.js platform and design systems.',
      reasoning:
        'Your deep expertise in Next.js App Router, SSR streaming, design systems, and web performance aligns with Vercel’s platform initiatives.',
      strongMatches: [
        {
          requirementId: 'req-3-1',
          title: 'Next.js & React 19 Mastery',
          detail:
            'Extensive production experience building App Router applications and open-source tooling.'
        },
        {
          requirementId: 'req-3-2',
          title: 'Design System Engineering',
          detail: 'Shipped design systems adopted across multiple teams at Apex Cloud Systems.'
        }
      ],
      partialMatches: [],
      missingRequirements: [
        {
          requirementId: 'req-3-3',
          title: 'Rust / Turbopack Internals',
          detail:
            'Candidate profile focuses on TypeScript tooling rather than native Rust compilers.'
        }
      ],
      supportingCandidateEvidence: [
        {
          requirementText: 'Architect and evolve shared UI components and design systems.',
          evidenceSource: 'Apex Cloud Systems',
          evidenceSnippet:
            'Shipped design system library adopted across 6 internal engineering teams.'
        }
      ]
    },
    {
      id: 'match-4',
      jobId: 'job-4',
      candidateId: 'cand-1',
      score: 76,
      recommendation: 'moderate',
      headline: 'Possible match — Strong frontend architecture; offline sync requires bridge.',
      reasoning:
        'You have outstanding TypeScript and real-time collaboration background, but Linear specifically emphasizes bespoke offline-first sync engines and native Electron desktop targets.',
      strongMatches: [
        {
          requirementId: 'req-4-1',
          title: 'High-Performance Web Client',
          detail: 'Proven track record of sub-second page performance and state normalization.'
        }
      ],
      partialMatches: [
        {
          requirementId: 'req-4-2',
          title: 'Real-Time Synchronisation',
          detail:
            'Built WebSocket pub/sub collaboration, but less experience with local SQLite sync.'
        }
      ],
      missingRequirements: [
        {
          requirementId: 'req-4-3',
          title: 'Electron Desktop Development',
          detail: 'Primary background is web/cloud rather than native desktop distribution.'
        }
      ],
      supportingCandidateEvidence: [
        {
          requirementText: 'Maintain high-performance interaction latency.',
          evidenceSource: 'Veloce Labs',
          evidenceSnippet:
            'Engineered real-time collaboration pipeline using WebSocket pub/sub and optimistic UI updates.'
        }
      ]
    },
    {
      id: 'match-5',
      jobId: 'job-5',
      candidateId: 'cand-1',
      score: 89,
      recommendation: 'strong',
      headline: 'Strong opportunity — Excellent design systems and frontend depth.',
      reasoning: 'Extensive design system background matches Figma web client initiatives.',
      strongMatches: [
        {
          title: 'Design Systems',
          detail: 'Built multi-team component libraries.'
        }
      ],
      partialMatches: [],
      missingRequirements: [],
      supportingCandidateEvidence: [
        {
          requirementText: 'Build accessible, performant design components.',
          evidenceSource: 'Apex Cloud Systems',
          evidenceSnippet:
            'Shipped design system library adopted across 6 internal engineering teams.'
        }
      ]
    },
    {
      id: 'match-6',
      jobId: 'job-6',
      candidateId: 'cand-1',
      score: 92,
      recommendation: 'strong',
      headline: 'Strong opportunity — Great fit for product engineering and APIs.',
      reasoning:
        'Full-stack experience with Node.js and React directly translates to product feature work.',
      strongMatches: [
        {
          title: 'Product Engineering',
          detail: 'Built collaborative product dashboards with 120k+ users.'
        }
      ],
      partialMatches: [],
      missingRequirements: [],
      supportingCandidateEvidence: [
        {
          requirementText: 'Develop collaborative workspace features.',
          evidenceSource: 'Veloce Labs',
          evidenceSnippet: 'Led architecture of core workspace dashboard used by 120k+ users.'
        }
      ]
    },
    {
      id: 'match-7',
      jobId: 'job-7',
      candidateId: 'cand-1',
      score: 84,
      recommendation: 'good',
      headline: 'Good match — Strong frontend architecture & performance track record.',
      reasoning:
        'Proven web performance and design systems background aligns well with Airbnb infrastructure.',
      strongMatches: [
        {
          title: 'Design Systems & Performance',
          detail: 'Demonstrated reduction in p95 page load latencies and shared library adoption.'
        }
      ],
      partialMatches: [],
      missingRequirements: [],
      supportingCandidateEvidence: [
        {
          requirementText: 'Lead core web runtime performance and bundle optimization.',
          evidenceSource: 'Veloce Labs',
          evidenceSnippet: 'Reduced p95 page load times from 2.4s to 420ms through SSR streaming.'
        }
      ]
    },
    {
      id: 'match-8',
      jobId: 'job-8',
      candidateId: 'cand-1',
      score: 79,
      recommendation: 'moderate',
      headline:
        'Moderate match — Strong React collaboration background; Ruby on Rails is secondary.',
      reasoning:
        'Candidate has extensive real-time collaboration expertise, with less primary Ruby on Rails experience.',
      strongMatches: [
        {
          title: 'Real-Time Collaboration',
          detail: 'Built WebSocket pub/sub collaboration pipelines at Veloce Labs.'
        }
      ],
      partialMatches: [
        {
          title: 'Ruby on Rails',
          detail:
            'Working knowledge from open-source contributions, primary focus is TypeScript/Node.'
        }
      ],
      missingRequirements: [],
      supportingCandidateEvidence: [
        {
          requirementText: 'Build real-time collaborative workspace features.',
          evidenceSource: 'Veloce Labs',
          evidenceSnippet: 'Engineered real-time collaboration pipeline using WebSocket pub/sub.'
        }
      ]
    }
  ],

  resumes: [
    {
      id: 'res-master',
      candidateId: 'cand-1',
      title: 'Master Professional Resume',
      targetRole: 'Senior Full-Stack & Frontend Engineer',
      summary:
        'Senior Full-Stack & Frontend Engineer with 7+ years of experience building resilient web applications, design systems, and distributed cloud services. Experienced in React, Next.js, TypeScript, Node.js, and relational database architecture.',
      experience: [
        {
          id: 'exp-1',
          employer: 'Veloce Labs',
          role: 'Senior Full-Stack Engineer',
          location: 'San Francisco, CA',
          startDate: '2022-03',
          endDate: undefined,
          isCurrent: true,
          responsibilities: [
            'Led architecture of core workspace dashboard used by 120k+ monthly active users.',
            'Reduced p95 page load times from 2.4s to 420ms through SSR streaming and query cache normalization.',
            'Engineered real-time collaboration pipeline using WebSocket pub/sub and optimistic UI updates.'
          ],
          achievements: [
            'Reduced API latency by 45% with Redis tiered caching.',
            'Mentored 4 junior and mid-level engineers across product feature squads.'
          ],
          candidateEvidence:
            'Led full-stack architecture, React/Next.js performance optimization, and distributed query caching at Veloce Labs.'
        },
        {
          id: 'exp-2',
          employer: 'Apex Cloud Systems',
          role: 'Full-Stack Software Engineer',
          location: 'San Jose, CA',
          startDate: '2019-06',
          endDate: '2022-02',
          isCurrent: false,
          responsibilities: [
            'Developed microservices in Node.js and TypeScript handling payment reconciliation.',
            'Designed PostgreSQL schema migrations and indexing strategies handling 4M+ daily transactions.',
            'Collaborated with product designers to implement reusable design-system components.'
          ],
          achievements: [
            'Maintained 99.98% uptime across payment billing microservices.',
            'Shipped design system library adopted across 6 internal engineering teams.'
          ],
          candidateEvidence:
            'Implemented payment reconciliation microservices, PostgreSQL query optimization, and component design systems at Apex Cloud Systems.'
        }
      ],
      education: [
        {
          id: 'edu-1',
          institution: 'University of California, Berkeley',
          degree: 'Bachelor of Science',
          fieldOfStudy: 'Computer Science',
          startDate: '2015-08',
          endDate: '2019-05',
          details: 'Dean’s Honor List, Focus on Distributed Systems and Human-Computer Interaction.'
        }
      ],
      skills: {
        technical: [
          'TypeScript',
          'JavaScript',
          'React',
          'Next.js',
          'Node.js',
          'Go',
          'PostgreSQL',
          'Redis'
        ],
        tools: ['Docker', 'Git', 'Kubernetes', 'AWS', 'Tailwind CSS', 'TanStack Query'],
        soft: ['System Design', 'Mentorship', 'Collaboration'],
        other: ['CI/CD', 'Design Systems', 'Performance Profiling']
      },
      projects: [
        {
          id: 'proj-1',
          name: 'OpenMetric Dashboard',
          description:
            'Open-source performance observability tool for Next.js App Router applications.',
          technologies: ['Next.js', 'TypeScript', 'Tailwind CSS', 'PostgreSQL'],
          contributions:
            'Architected core telemetry ingestion engine and real-time visualization widgets.',
          outcomes: 'Earned 1.8k GitHub stars and used by over 300 active teams.',
          url: 'https://github.com/alexchen/openmetric'
        }
      ],
      certifications: [
        {
          id: 'cert-1',
          name: 'AWS Certified Solutions Architect - Associate',
          issuer: 'Amazon Web Services',
          issueDate: '2023-04',
          credentialId: 'AWS-ASA-99482'
        }
      ],
      changes: [],
      approvalState: 'approved',
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-15T10:00:00Z'
    },
    {
      id: 'res-tailored-job-1',
      candidateId: 'cand-1',
      masterResumeId: 'res-master',
      jobId: 'job-1',
      title: 'Tailored Resume — Senior Full-Stack Engineer (Stripe)',
      targetRole: 'Senior Full-Stack Engineer (Billing Infrastructure)',
      summary:
        'Senior Full-Stack Engineer with 7+ years of experience architecting high-scale transactional web services, payment reconciliation pipelines, and high-performance React applications.',
      experience: [
        {
          id: 'exp-1',
          employer: 'Veloce Labs',
          role: 'Senior Full-Stack Engineer',
          location: 'San Francisco, CA',
          startDate: '2022-03',
          endDate: undefined,
          isCurrent: true,
          responsibilities: [
            'Architected high-throughput workspace services processing high-frequency data for 120k+ active users.',
            'Reduced p95 latency from 2.4s to 420ms through SSR streaming and distributed cache normalization.',
            'Engineered real-time collaboration pipeline using WebSocket pub/sub with zero data loss.'
          ],
          achievements: [
            'Reduced API latency by 45% with Redis tiered caching.',
            'Mentored 4 engineers in distributed system design and testing practices.'
          ],
          candidateEvidence:
            'Led full-stack architecture, React/Next.js performance optimization, and distributed query caching at Veloce Labs.'
        },
        {
          id: 'exp-2',
          employer: 'Apex Cloud Systems',
          role: 'Full-Stack Software Engineer (Billing & Payments)',
          location: 'San Jose, CA',
          startDate: '2019-06',
          endDate: '2022-02',
          isCurrent: false,
          responsibilities: [
            'Developed mission-critical payment reconciliation microservices handling 4M+ daily financial transactions.',
            'Designed fault-tolerant PostgreSQL schema migrations and indexing models maintaining 99.98% uptime.',
            'Collaborated with product teams on customer-facing billing workflows and design systems.'
          ],
          achievements: [
            'Maintained 99.98% uptime across payment billing microservices.',
            'Shipped design system library adopted across 6 internal engineering teams.'
          ],
          candidateEvidence:
            'Implemented payment reconciliation microservices, PostgreSQL query optimization, and component design systems at Apex Cloud Systems.'
        }
      ],
      education: [
        {
          id: 'edu-1',
          institution: 'University of California, Berkeley',
          degree: 'Bachelor of Science',
          fieldOfStudy: 'Computer Science',
          startDate: '2015-08',
          endDate: '2019-05',
          details: 'Dean’s Honor List, Focus on Distributed Systems.'
        }
      ],
      skills: {
        technical: [
          'TypeScript',
          'React',
          'Node.js',
          'Distributed Systems',
          'PostgreSQL',
          'Go',
          'Redis'
        ],
        tools: ['Docker', 'AWS', 'Kubernetes', 'Tailwind CSS', 'TanStack Query'],
        soft: ['System Design', 'Communication', 'Technical Mentorship'],
        other: ['Financial Reconciliation', 'CI/CD', 'Performance Tuning']
      },
      projects: [
        {
          id: 'proj-1',
          name: 'OpenMetric Dashboard',
          description:
            'Open-source performance observability tool for Next.js App Router applications.',
          technologies: ['Next.js', 'TypeScript', 'Tailwind CSS', 'PostgreSQL'],
          contributions:
            'Architected core telemetry ingestion engine and real-time visualization widgets.',
          outcomes: 'Earned 1.8k GitHub stars and used by over 300 active teams.',
          url: 'https://github.com/alexchen/openmetric'
        }
      ],
      certifications: [
        {
          id: 'cert-1',
          name: 'AWS Certified Solutions Architect - Associate',
          issuer: 'Amazon Web Services',
          issueDate: '2023-04',
          credentialId: 'AWS-ASA-99482'
        }
      ],
      changes: [
        {
          id: 'change-1',
          resumeVersionId: 'res-tailored-job-1',
          section: 'summary',
          originalContent:
            'Senior Full-Stack & Frontend Engineer with 7+ years of experience building resilient web applications, design systems, and distributed cloud services.',
          proposedContent:
            'Senior Full-Stack Engineer with 7+ years of experience architecting high-scale transactional web services, payment reconciliation pipelines, and high-performance React applications.',
          rationale:
            'Focuses summary directly on Stripe Billing’s emphasis on transactional stability and payment reconciliation.',
          jobRequirement:
            'Scale merchant billing pipelines processing hundreds of millions of dollars daily.',
          sourceCandidateEvidence:
            'Developed microservices handling payment reconciliation at Apex Cloud Systems.',
          sourceKnowledgeItemIds: ['kb-exp-2'],
          status: 'approved'
        },
        {
          id: 'change-2',
          resumeVersionId: 'res-tailored-job-1',
          section: 'experience',
          sectionItemId: 'exp-2',
          originalContent:
            'Developed microservices in Node.js and TypeScript handling payment reconciliation.',
          proposedContent:
            'Developed mission-critical payment reconciliation microservices handling 4M+ daily financial transactions.',
          rationale:
            'Elevates verified metrics from existing candidate experience to directly demonstrate scale.',
          jobRequirement:
            'Experience designing distributed services and relational data models for payments.',
          sourceCandidateEvidence:
            'Maintained 99.98% uptime across payment billing microservices with 4M+ daily transactions.',
          sourceKnowledgeItemIds: ['kb-exp-2'],
          status: 'pending'
        },
        {
          id: 'change-3',
          resumeVersionId: 'res-tailored-job-1',
          section: 'skills',
          originalContent: 'TypeScript, JavaScript, React, Next.js, Node.js, Go, PostgreSQL, Redis',
          proposedContent: 'TypeScript, React, Node.js, Distributed Systems, PostgreSQL, Go, Redis',
          rationale:
            'Reprioritizes Distributed Systems and PostgreSQL ahead of general web frameworks to match job spec.',
          jobRequirement: 'Distributed Systems, PostgreSQL, and Node.js core stack.',
          sourceCandidateEvidence:
            'Candidate has 7+ years distributed systems and relational database design experience.',
          sourceKnowledgeItemIds: ['kb-skill-1', 'kb-skill-2', 'kb-skill-4'],
          status: 'pending'
        }
      ],
      approvalState: 'in_review',
      createdAt: '2026-09-02T14:30:00Z',
      updatedAt: '2026-09-03T09:15:00Z'
    }
  ],

  applications: [
    {
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'cand-1',
      status: 'preparing',
      dateDiscovered: '2026-09-01T10:30:00Z',
      dateApplied: undefined,
      resumeVersionId: 'res-tailored-job-1',
      tailoredResumeVersionId: 'res-tailored-job-1',
      selectedTemplateId: 'classic-v1',
      selectedTemplateVersion: '1.0.0',
      coverLetter:
        'Dear Stripe Recruiting Team,\n\nI am excited to apply for the Senior Full-Stack Engineer role on the Billing team. Having built transactional microservices handling over 4 million daily transactions at Apex Cloud Systems and optimized high-throughput dashboards at Veloce Labs, I understand the exacting reliability required for payment infrastructure. I look forward to bringing this expertise to Stripe Billing.\n\nSincerely,\nAlex Chen',
      applicationAnswers: [
        {
          id: 'ans-1-1',
          question: 'What is the most complex distributed systems challenge you have resolved?',
          suggestedAnswer:
            'At Apex Cloud Systems, our payment reconciliation microservice experienced concurrency bottlenecks during month-end surges. I re-architected the pipeline using advisory locking in PostgreSQL and Redis idempotent queues, reducing duplicate reconciliation attempts to zero and maintaining 99.98% uptime.',
          contextUsed: 'Apex Cloud Systems payment reconciliation project',
          reviewed: true
        }
      ],
      notes:
        'Reviewed match analysis (94%). Working on tailoring resume and finalizing application answers.',
      interviewStages: [],
      contacts: [
        {
          id: 'c-1',
          name: 'Sarah Jenkins',
          role: 'Staff Technical Recruiter',
          email: 'sjenkins@stripe.com',
          phone: '+1 (415) 890-1234',
          linkedInUrl: 'https://linkedin.com/in/sarah-jenkins-recruiting',
          notes: 'Reached out after viewing open-source Next.js metrics work.',
          createdAt: '2026-09-03T11:30:00Z'
        }
      ],
      followUpDate: '2026-09-12',
      followUpStatus: 'pending',
      followUpNote: 'Check in on Billing team technical review process',
      matchScoreAtApplication: 94,
      statusHistory: [
        {
          status: 'discovered',
          timestamp: '2026-09-01T10:30:00Z',
          note: 'Discovered via LinkedIn match.'
        },
        {
          status: 'interested',
          timestamp: '2026-09-02T09:00:00Z',
          note: 'Marked as top priority opportunity.'
        },
        {
          status: 'preparing',
          timestamp: '2026-09-02T14:30:00Z',
          note: 'Generated tailored resume and cover letter draft.'
        }
      ]
    },
    {
      id: 'app-2',
      jobId: 'job-2',
      candidateId: 'cand-1',
      status: 'interested',
      dateDiscovered: '2026-09-02T11:45:00Z',
      dateApplied: undefined,
      notes:
        'Good backend systems match. Need to review Kafka requirements before tailoring resume.',
      statusHistory: [
        {
          status: 'discovered',
          timestamp: '2026-09-02T11:45:00Z',
          note: 'Imported from Indeed.'
        },
        {
          status: 'interested',
          timestamp: '2026-09-03T16:00:00Z',
          note: 'Decided to pursue after reviewing 82% match breakdown.'
        }
      ]
    },
    {
      id: 'app-3',
      jobId: 'job-3',
      candidateId: 'cand-1',
      status: 'applied',
      dateDiscovered: '2026-08-25T14:20:00Z',
      dateApplied: '2026-08-28T18:00:00Z',
      resumeVersionId: 'res-master',
      notes:
        'Submitted application on Vercel careers site using master resume. Referenced OpenMetric project in application.',
      followUpDate: '2026-09-15',
      statusHistory: [
        {
          status: 'discovered',
          timestamp: '2026-08-25T14:20:00Z',
          note: 'Imported via URL parser.'
        },
        {
          status: 'interested',
          timestamp: '2026-08-26T10:00:00Z',
          note: 'High match score (91%).'
        },
        {
          status: 'preparing',
          timestamp: '2026-08-27T11:00:00Z',
          note: 'Prepared materials.'
        },
        {
          status: 'applied',
          timestamp: '2026-08-28T18:00:00Z',
          note: 'Completed human-controlled submission on external site.'
        }
      ]
    },
    {
      id: 'app-4',
      jobId: 'job-4',
      candidateId: 'cand-1',
      status: 'discovered',
      dateDiscovered: '2026-09-06T09:15:00Z',
      dateApplied: undefined,
      notes: 'Staff level opportunity. Reviewing match score (76%) and offline sync requirements.',
      statusHistory: [
        {
          status: 'discovered',
          timestamp: '2026-09-06T09:15:00Z',
          note: 'Added manually to discovery feed.'
        }
      ]
    },
    {
      id: 'app-5',
      jobId: 'job-5',
      candidateId: 'cand-1',
      status: 'interview',
      dateDiscovered: '2026-08-15T08:00:00Z',
      dateApplied: '2026-08-19T17:00:00Z',
      resumeVersionId: 'res-master',
      notes: 'Completed recruiter screen. Technical architecture round scheduled for next week.',
      interviewStages: [
        {
          id: 'int-1',
          stageName: 'Recruiter Screen',
          scheduledDate: '2026-08-25T15:00:00Z',
          completedDate: '2026-08-25T15:30:00Z',
          notes: 'Great conversation on team structure and remote setup.',
          status: 'completed',
          outcome: 'passed'
        },
        {
          id: 'int-2',
          stageName: 'Technical Architecture & Design Systems',
          scheduledDate: '2026-09-14T18:00:00Z',
          notes: 'Prepare deep-dive on design system token propagation and accessibility.',
          status: 'scheduled',
          outcome: 'pending'
        }
      ],
      contacts: [
        {
          id: 'c-2',
          name: 'David Cho',
          role: 'Engineering Manager',
          email: 'dcho@figma.com',
          linkedInUrl: 'https://linkedin.com/in/david-cho-eng',
          notes: 'Focused on high-performance web canvas architecture.',
          createdAt: '2026-08-20T10:00:00Z'
        }
      ],
      followUpDate: '2026-09-14',
      followUpStatus: 'none',
      matchScoreAtApplication: 89,
      statusHistory: [
        {
          status: 'discovered',
          timestamp: '2026-08-15T08:00:00Z'
        },
        {
          status: 'applied',
          timestamp: '2026-08-19T17:00:00Z'
        },
        {
          status: 'interview',
          timestamp: '2026-08-26T10:00:00Z',
          note: 'Invited to technical round.'
        }
      ]
    },
    {
      id: 'app-6',
      jobId: 'job-6',
      candidateId: 'cand-1',
      status: 'offer',
      dateDiscovered: '2026-08-10T11:00:00Z',
      dateApplied: '2026-08-13T14:00:00Z',
      resumeVersionId: 'res-master',
      notes:
        'Received formal offer for Full-Stack Product Engineer ($185k base + equity). Offer decision deadline Sept 20.',
      followUpDate: '2026-09-18',
      statusHistory: [
        {
          status: 'discovered',
          timestamp: '2026-08-10T11:00:00Z'
        },
        {
          status: 'applied',
          timestamp: '2026-08-13T14:00:00Z'
        },
        {
          status: 'interview',
          timestamp: '2026-08-20T16:00:00Z'
        },
        {
          status: 'offer',
          timestamp: '2026-09-04T12:00:00Z',
          note: 'Formal offer received.'
        }
      ],
      matchScoreAtApplication: 92
    },
    {
      id: 'app-7',
      jobId: 'job-7',
      candidateId: 'cand-1',
      status: 'rejected',
      dateDiscovered: '2026-08-06T10:00:00Z',
      dateApplied: '2026-08-14T15:00:00Z',
      dateClosed: '2026-08-26T17:00:00Z',
      resumeVersionId: 'res-master',
      matchScoreAtApplication: 84,
      notes:
        'Received feedback that headcount was filled internally by team transfer. Encouraged to re-apply in Q1.',
      followUpStatus: 'none',
      statusHistory: [
        { status: 'discovered', timestamp: '2026-08-06T10:00:00Z' },
        {
          status: 'applied',
          timestamp: '2026-08-14T15:00:00Z',
          note: 'Applied via Airbnb careers portal.'
        },
        {
          status: 'rejected',
          timestamp: '2026-08-26T17:00:00Z',
          note: 'Position closed internally.'
        }
      ]
    },
    {
      id: 'app-8',
      jobId: 'job-8',
      candidateId: 'cand-1',
      status: 'withdrawn',
      dateDiscovered: '2026-08-16T12:00:00Z',
      dateApplied: '2026-08-20T14:00:00Z',
      dateClosed: '2026-08-29T10:00:00Z',
      resumeVersionId: 'res-master',
      matchScoreAtApplication: 79,
      notes: 'Withdrew candidacy after prioritizing Stripe and Figma opportunities.',
      followUpStatus: 'none',
      statusHistory: [
        { status: 'discovered', timestamp: '2026-08-16T12:00:00Z' },
        { status: 'applied', timestamp: '2026-08-20T14:00:00Z' },
        { status: 'withdrawn', timestamp: '2026-08-29T10:00:00Z', note: 'Withdrawn by candidate.' }
      ]
    }
  ],

  applicationEvents: [
    // --- app-1 (Stripe) events ---
    {
      id: 'evt-1-1',
      applicationId: 'app-1',
      jobId: 'job-1',
      type: 'discovered',
      title: 'Job Discovered',
      description: 'Discovered Senior Full-Stack Engineer at Stripe via LinkedIn importer.',
      timestamp: '2026-09-01T10:30:00Z',
      isAutomated: true
    },
    {
      id: 'evt-1-2',
      applicationId: 'app-1',
      jobId: 'job-1',
      type: 'interested',
      title: 'Marked as Priority',
      description: 'Prioritized Stripe opportunity following 94% match review.',
      timestamp: '2026-09-02T09:00:00Z',
      isAutomated: false
    },
    {
      id: 'evt-1-3',
      applicationId: 'app-1',
      jobId: 'job-1',
      type: 'preparation_started',
      title: 'Application Preparation Started',
      description: 'Initiated resume tailoring and generated role-specific Q&A drafts.',
      timestamp: '2026-09-02T14:30:00Z',
      isAutomated: true
    },
    {
      id: 'evt-1-4',
      applicationId: 'app-1',
      jobId: 'job-1',
      type: 'resume_tailored',
      title: 'Tailored Resume Finalized',
      description: 'Candidate approved 3 proposed revisions for Billing & PostgreSQL alignment.',
      timestamp: '2026-09-03T11:00:00Z',
      isAutomated: false
    },
    {
      id: 'evt-1-5',
      applicationId: 'app-1',
      jobId: 'job-1',
      type: 'resume_exported',
      title: 'Resume Exported',
      description: 'Exported PDF using Modern v1 template for external portal upload.',
      timestamp: '2026-09-03T11:15:00Z',
      isAutomated: false,
      metadata: { format: 'pdf', templateId: 'modern-v1' }
    },
    {
      id: 'evt-1-6',
      applicationId: 'app-1',
      jobId: 'job-1',
      type: 'handoff_opened',
      title: 'External Portal Handoff',
      description: 'Opened Stripe career portal in external browser window.',
      timestamp: '2026-09-03T11:20:00Z',
      isAutomated: true
    },
    {
      id: 'evt-1-7',
      applicationId: 'app-1',
      jobId: 'job-1',
      type: 'applied_confirmed',
      title: 'Candidate Confirmed Applied',
      description: 'Candidate explicitly verified submission on Stripe careers website.',
      timestamp: '2026-09-03T11:25:00Z',
      isAutomated: false
    },
    {
      id: 'evt-1-8',
      applicationId: 'app-1',
      jobId: 'job-1',
      type: 'follow_up_scheduled',
      title: 'Follow-Up Scheduled',
      description: 'Scheduled 7-day follow-up for September 12, 2026.',
      timestamp: '2026-09-03T11:26:00Z',
      isAutomated: true,
      metadata: { followUpDate: '2026-09-12' }
    },
    {
      id: 'evt-1-9',
      applicationId: 'app-1',
      jobId: 'job-1',
      type: 'contact_added',
      title: 'Recruiter Contact Logged',
      description: 'Added Sarah Jenkins (Staff Technical Recruiter).',
      timestamp: '2026-09-03T11:30:00Z',
      isAutomated: false
    },

    // --- app-5 (Figma) events ---
    {
      id: 'evt-5-1',
      applicationId: 'app-5',
      jobId: 'job-5',
      type: 'discovered',
      title: 'Job Discovered',
      description: 'Discovered Senior Frontend Engineer at Figma.',
      timestamp: '2026-08-15T08:00:00Z',
      isAutomated: true
    },
    {
      id: 'evt-5-2',
      applicationId: 'app-5',
      jobId: 'job-5',
      type: 'applied_confirmed',
      title: 'Application Submitted',
      description: 'Applied via Figma careers website.',
      timestamp: '2026-08-19T17:00:00Z',
      isAutomated: false
    },
    {
      id: 'evt-5-3',
      applicationId: 'app-5',
      jobId: 'job-5',
      type: 'interview_scheduled',
      title: 'Recruiter Screen Scheduled',
      description: 'Scheduled with People Ops for August 25, 2026.',
      timestamp: '2026-08-22T10:00:00Z',
      isAutomated: false
    },
    {
      id: 'evt-5-4',
      applicationId: 'app-5',
      jobId: 'job-5',
      type: 'interview_completed',
      title: 'Recruiter Screen Completed',
      description: 'Completed screen — positive conversation regarding remote culture.',
      timestamp: '2026-08-25T15:30:00Z',
      isAutomated: false,
      metadata: { outcome: 'passed' }
    },
    {
      id: 'evt-5-5',
      applicationId: 'app-5',
      jobId: 'job-5',
      type: 'interview_scheduled',
      title: 'Technical Architecture Round Scheduled',
      description: 'Deep-dive on real-time multiplayer canvas and token propagation for Sept 14.',
      timestamp: '2026-08-26T11:00:00Z',
      isAutomated: false,
      metadata: { scheduledDate: '2026-09-14T18:00:00Z' }
    },

    // --- app-6 (Notion) events ---
    {
      id: 'evt-6-1',
      applicationId: 'app-6',
      jobId: 'job-6',
      type: 'discovered',
      title: 'Job Discovered',
      description: 'Discovered Product Engineer role at Notion.',
      timestamp: '2026-08-10T11:00:00Z',
      isAutomated: true
    },
    {
      id: 'evt-6-2',
      applicationId: 'app-6',
      jobId: 'job-6',
      type: 'applied_confirmed',
      title: 'Application Submitted',
      description: 'Applied via Notion careers portal.',
      timestamp: '2026-08-13T14:00:00Z',
      isAutomated: false
    },
    {
      id: 'evt-6-3',
      applicationId: 'app-6',
      jobId: 'job-6',
      type: 'interview_completed',
      title: 'Technical Loop Completed',
      description: 'Finished 3-round engineering loop with product squads.',
      timestamp: '2026-08-20T16:00:00Z',
      isAutomated: false,
      metadata: { outcome: 'passed' }
    },
    {
      id: 'evt-6-4',
      applicationId: 'app-6',
      jobId: 'job-6',
      type: 'offer_received',
      title: 'Formal Offer Received',
      description: 'Offer received: $185,000 base salary + equity compensation package.',
      timestamp: '2026-09-04T12:00:00Z',
      isAutomated: false,
      metadata: { compensation: '$185k base + equity', deadline: '2026-09-20' }
    },

    // --- app-7 (Airbnb) events ---
    {
      id: 'evt-7-1',
      applicationId: 'app-7',
      jobId: 'job-7',
      type: 'discovered',
      title: 'Job Discovered',
      description: 'Discovered Staff Frontend Infrastructure at Airbnb.',
      timestamp: '2026-08-06T10:00:00Z',
      isAutomated: true
    },
    {
      id: 'evt-7-2',
      applicationId: 'app-7',
      jobId: 'job-7',
      type: 'applied_confirmed',
      title: 'Application Submitted',
      description: 'Submitted application on Airbnb careers.',
      timestamp: '2026-08-14T15:00:00Z',
      isAutomated: false
    },
    {
      id: 'evt-7-3',
      applicationId: 'app-7',
      jobId: 'job-7',
      type: 'rejection_logged',
      title: 'Outcome Recorded: Position Filled',
      description: 'Recruiter communicated that role was filled via internal transfer.',
      timestamp: '2026-08-26T17:00:00Z',
      isAutomated: false
    },

    // --- app-8 (GitHub) events ---
    {
      id: 'evt-8-1',
      applicationId: 'app-8',
      jobId: 'job-8',
      type: 'discovered',
      title: 'Job Discovered',
      description: 'Discovered Full-Stack Collaboration Engineer at GitHub.',
      timestamp: '2026-08-16T12:00:00Z',
      isAutomated: true
    },
    {
      id: 'evt-8-2',
      applicationId: 'app-8',
      jobId: 'job-8',
      type: 'applied_confirmed',
      title: 'Application Submitted',
      description: 'Submitted application for GitHub Issues team.',
      timestamp: '2026-08-20T14:00:00Z',
      isAutomated: false
    },
    {
      id: 'evt-8-3',
      applicationId: 'app-8',
      jobId: 'job-8',
      type: 'withdrawn',
      title: 'Candidacy Withdrawn by Candidate',
      description: 'Candidate prioritized Stripe and Figma opportunities.',
      timestamp: '2026-08-29T10:00:00Z',
      isAutomated: false
    }
  ],

  knowledgeBank: {
    id: 'kb-cand-1',
    candidateId: 'cand-1',
    updatedAt: '2026-09-10T12:00:00Z',
    skills: [
      {
        id: 'kb-skill-ts',
        candidateId: 'cand-1',
        category: 'skill',
        content: {
          name: 'TypeScript',
          category: 'technical',
          proficiency: 'expert',
          yearsOfExperience: 6
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-ts-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Master Profile Baseline',
            addedAt: '2026-08-01T00:00:00Z'
          },
          {
            id: 'prov-ts-2',
            sourceType: 'manual_entry',
            sourceLabel: 'Manual Profile Entry',
            addedAt: '2026-08-15T10:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-15T10:00:00Z'
      },
      {
        id: 'kb-skill-react',
        candidateId: 'cand-1',
        category: 'skill',
        content: {
          name: 'React 19',
          category: 'technical',
          proficiency: 'expert',
          yearsOfExperience: 7
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-react-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Master Profile Baseline',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-skill-nextjs',
        candidateId: 'cand-1',
        category: 'skill',
        content: {
          name: 'Next.js (App Router)',
          category: 'technical',
          proficiency: 'expert',
          yearsOfExperience: 4
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-next-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Master Profile Baseline',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-skill-nodejs',
        candidateId: 'cand-1',
        category: 'skill',
        content: {
          name: 'Node.js',
          category: 'technical',
          proficiency: 'advanced',
          yearsOfExperience: 6
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-node-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Master Profile Baseline',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-skill-postgres',
        candidateId: 'cand-1',
        category: 'skill',
        content: {
          name: 'PostgreSQL',
          category: 'technical',
          proficiency: 'advanced',
          yearsOfExperience: 5
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-pg-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Master Profile Baseline',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-skill-go',
        candidateId: 'cand-1',
        category: 'skill',
        content: {
          name: 'Go',
          category: 'technical',
          proficiency: 'intermediate',
          yearsOfExperience: 2
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-go-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Master Profile Baseline',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-skill-redis',
        candidateId: 'cand-1',
        category: 'skill',
        content: {
          name: 'Redis',
          category: 'technical',
          proficiency: 'advanced',
          yearsOfExperience: 4
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-redis-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Master Profile Baseline',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-skill-graphql',
        candidateId: 'cand-1',
        category: 'skill',
        content: {
          name: 'GraphQL',
          category: 'technical',
          proficiency: 'intermediate',
          yearsOfExperience: 3
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-gql-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Master Profile Baseline',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-skill-docker',
        candidateId: 'cand-1',
        category: 'skill',
        content: {
          name: 'Docker',
          category: 'tools',
          proficiency: 'advanced',
          yearsOfExperience: 5
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-dock-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Master Profile Baseline',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-skill-k8s',
        candidateId: 'cand-1',
        category: 'skill',
        content: {
          name: 'Kubernetes',
          category: 'tools',
          proficiency: 'intermediate',
          yearsOfExperience: 3
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-k8s-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Master Profile Baseline',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-skill-aws',
        candidateId: 'cand-1',
        category: 'skill',
        content: {
          name: 'AWS (ECS, S3, RDS)',
          category: 'tools',
          proficiency: 'advanced',
          yearsOfExperience: 4
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-aws-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Master Profile Baseline',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-skill-tailwind',
        candidateId: 'cand-1',
        category: 'skill',
        content: {
          name: 'Tailwind CSS',
          category: 'tools',
          proficiency: 'expert',
          yearsOfExperience: 5
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-tw-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Master Profile Baseline',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-skill-sysdesign',
        candidateId: 'cand-1',
        category: 'skill',
        content: {
          name: 'System Design',
          category: 'soft',
          proficiency: 'advanced',
          yearsOfExperience: 5
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-sd-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Master Profile Baseline',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-skill-mentor',
        candidateId: 'cand-1',
        category: 'skill',
        content: {
          name: 'Technical Mentorship',
          category: 'soft',
          proficiency: 'advanced',
          yearsOfExperience: 4
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-tm-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Master Profile Baseline',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      }
    ],
    experiences: [
      {
        id: 'kb-exp-veloce',
        candidateId: 'cand-1',
        category: 'experience',
        content: {
          employer: 'Veloce Labs',
          role: 'Senior Full-Stack Engineer',
          location: 'San Francisco, CA',
          startDate: '2022-03',
          endDate: undefined,
          isCurrent: true,
          responsibilities: [
            'Led architecture of core workspace dashboard used by 120k+ monthly active users.',
            'Reduced p95 page load times from 2.4s to 420ms through SSR streaming and query cache normalization.',
            'Engineered real-time collaboration pipeline using WebSocket pub/sub and optimistic UI updates.'
          ],
          achievements: [
            'Reduced API latency by 45% with Redis tiered caching.',
            'Mentored 4 junior and mid-level engineers across product feature squads.'
          ]
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-veloce-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Verified Employment Record (Veloce Labs)',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-exp-apex',
        candidateId: 'cand-1',
        category: 'experience',
        content: {
          employer: 'Apex Cloud Systems',
          role: 'Full-Stack Software Engineer',
          location: 'San Jose, CA',
          startDate: '2019-06',
          endDate: '2022-02',
          isCurrent: false,
          responsibilities: [
            'Developed microservices in Node.js and TypeScript handling payment reconciliation.',
            'Designed PostgreSQL schema migrations and indexing strategies handling 4M+ daily transactions.',
            'Collaborated with product designers to implement reusable design-system components.'
          ],
          achievements: [
            'Maintained 99.98% uptime across payment billing microservices.',
            'Shipped design system library adopted across 6 internal engineering teams.'
          ]
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-apex-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Verified Employment Record (Apex Cloud Systems)',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      }
    ],
    projects: [
      {
        id: 'kb-proj-openmetric',
        candidateId: 'cand-1',
        category: 'project',
        content: {
          name: 'OpenMetric Dashboard',
          description:
            'Open-source performance observability tool for Next.js App Router applications.',
          technologies: ['Next.js', 'TypeScript', 'Tailwind CSS', 'PostgreSQL'],
          contributions:
            'Architected core telemetry ingestion engine and real-time visualization widgets.',
          outcomes: 'Earned 1.8k GitHub stars and used by over 300 active teams.',
          url: 'https://github.com/alexchen/openmetric'
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-om-1',
            sourceType: 'profile_migration',
            sourceLabel: 'GitHub Open Source (OpenMetric)',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      }
    ],
    education: [
      {
        id: 'kb-edu-berkeley',
        candidateId: 'cand-1',
        category: 'education',
        content: {
          institution: 'University of California, Berkeley',
          degree: 'Bachelor of Science',
          fieldOfStudy: 'Computer Science',
          startDate: '2015-08',
          endDate: '2019-05',
          details: 'Dean’s Honor List, Focus on Distributed Systems and Human-Computer Interaction.'
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-cal-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Academic Credential (UC Berkeley)',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      }
    ],
    certifications: [
      {
        id: 'kb-cert-aws',
        candidateId: 'cand-1',
        category: 'certification',
        content: {
          name: 'AWS Certified Solutions Architect - Associate',
          issuer: 'Amazon Web Services',
          issueDate: '2023-04',
          credentialId: 'AWS-ASA-99482'
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-aws-cert-1',
            sourceType: 'profile_migration',
            sourceLabel: 'AWS Verification Registry',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      }
    ],
    achievements: [
      {
        id: 'kb-ach-latency',
        candidateId: 'cand-1',
        category: 'achievement',
        content: {
          title: 'Latency & SSR Streaming Optimization',
          description:
            'Reduced p95 page load times from 2.4s to 420ms through SSR streaming and query cache normalization.',
          metric: 'p95 2.4s → 420ms (-82%)',
          sourceContext: 'Veloce Labs'
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-ach-1',
            sourceType: 'profile_migration',
            sourceLabel: 'Veloce Labs Performance Metrics',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-ach-billing',
        candidateId: 'cand-1',
        category: 'achievement',
        content: {
          title: 'High-Scale Payment Reconciliation Engine',
          description:
            'Engineered multi-tenant billing & usage telemetry pipelines processing over 4M transactional events daily with PostgreSQL.',
          metric: '4M+ daily transactions, 99.98% uptime',
          sourceContext: 'Apex Cloud Systems'
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-ach-2',
            sourceType: 'profile_migration',
            sourceLabel: 'Apex Cloud Production Reliability SLA',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-ach-designsys',
        candidateId: 'cand-1',
        category: 'achievement',
        content: {
          title: 'Multi-Team Design System Adoption',
          description:
            'Designed and shipped central design system component library in TypeScript/Tailwind, adopted across 6 engineering teams.',
          metric: 'Adopted across 6 internal engineering teams',
          sourceContext: 'Apex Cloud Systems'
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-ach-3',
            sourceType: 'profile_migration',
            sourceLabel: 'Apex Cloud Internal Tooling Review',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      },
      {
        id: 'kb-ach-stars',
        candidateId: 'cand-1',
        category: 'achievement',
        content: {
          title: 'Open Source Community Adoption',
          description:
            'Architected OpenMetric Dashboard, earning 1.8k GitHub stars and used by over 300 active teams.',
          metric: '1.8k GitHub Stars, 300+ Teams',
          sourceContext: 'OpenMetric Dashboard'
        },
        status: 'approved',
        provenance: [
          {
            id: 'prov-ach-4',
            sourceType: 'profile_migration',
            sourceLabel: 'GitHub Metrics API',
            addedAt: '2026-08-01T00:00:00Z'
          }
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      }
    ]
  },

  proposedBatches: [
    {
      id: 'batch-2026-01',
      candidateId: 'cand-1',
      fileName: 'Resume_Alex_Chen_2026_Updated.pdf',
      uploadedAt: '2026-09-10T14:30:00Z',
      status: 'pending_review',
      items: [
        {
          tempId: 'prop-1',
          category: 'skill',
          content: {
            name: 'gRPC',
            category: 'technical',
            proficiency: 'intermediate',
            yearsOfExperience: 2
          },
          confidence: 0.95,
          extractedSnippet:
            'Designed high-throughput microservices using gRPC protocol and Protocol Buffers.',
          conflictStatus: 'new'
        },
        {
          tempId: 'prop-2',
          category: 'certification',
          content: {
            name: 'Certified Kubernetes Administrator (CKA)',
            issuer: 'The Linux Foundation',
            issueDate: '2026-02',
            credentialId: 'LF-CKA-294821'
          },
          confidence: 0.98,
          extractedSnippet:
            'Certified Kubernetes Administrator (CKA) — Credential LF-CKA-294821 (Issued Feb 2026)',
          conflictStatus: 'new'
        },
        {
          tempId: 'prop-3',
          category: 'skill',
          content: { name: 'Go (Golang)', category: 'technical', proficiency: 'intermediate' },
          confidence: 0.94,
          extractedSnippet: 'Built backend distributed telemetry ingestion jobs with Go (Golang).',
          conflictStatus: 'possible_duplicate',
          existingItemId: 'kb-skill-go',
          conflictDescription:
            'Matches existing approved skill "Go". Approving will attach this resume as a supporting provenance source without creating a duplicate.'
        },
        {
          tempId: 'prop-4',
          category: 'experience',
          content: {
            employer: 'Veloce Labs',
            role: 'Staff Software Engineer',
            location: 'San Francisco, CA',
            startDate: '2022-03',
            isCurrent: true,
            responsibilities: [
              'Spearheaded architecture of core workspace dashboard used by 120k+ monthly active users.',
              'Reduced p95 page load times from 2.4s to 420ms through SSR streaming.'
            ],
            achievements: ['Promoted to Staff Software Engineer leading cross-squad architecture.']
          },
          confidence: 0.91,
          extractedSnippet: 'Staff Software Engineer at Veloce Labs (2022 - Present)',
          conflictStatus: 'conflict',
          existingItemId: 'kb-exp-veloce',
          conflictDescription:
            'Role title in document is "Staff Software Engineer" whereas current approved record is "Senior Full-Stack Engineer". Review to reconcile.'
        }
      ]
    }
  ]
};
