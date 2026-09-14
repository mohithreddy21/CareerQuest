import React from 'react';
import { ResumeContent } from '@/types/resume-content';
import { ResumeTemplate } from '@/types/templates';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface ResumeRendererProps {
  content: ResumeContent;
  template: ResumeTemplate;
  className?: string;
}

export function ResumeRenderer({ content, template, className }: ResumeRendererProps) {
  const { identity, summary, skills, experience, projects, education, certifications } = content;
  const { layout } = template;

  const isClassic = template.id === 'classic-v1';
  const isModern = template.id === 'modern-v1';
  const isCompact = template.id === 'compact-v1';

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-4xl bg-card text-card-foreground rounded-lg border border-border/70 shadow-sm transition-all duration-150',
        isCompact ? 'p-5 sm:p-6 text-[11px] leading-snug' : 'p-6 sm:p-8 text-xs leading-relaxed',
        isClassic ? 'font-serif' : 'font-sans',
        className
      )}
    >
      {/* 1. Header / Identity */}
      <header
        className={cn(
          'pb-4 mb-4 border-b',
          layout.headerAlignment === 'center' ? 'text-center' : 'text-left',
          isClassic && 'border-border/80 pb-3 mb-3',
          isModern && 'border-primary/30 pb-4 mb-4',
          isCompact && 'border-border/60 pb-2 mb-2'
        )}
      >
        <h1
          className={cn(
            'font-bold tracking-tight text-foreground',
            isCompact ? 'text-xl' : 'text-2xl sm:text-3xl'
          )}
        >
          {identity.fullName}
        </h1>

        <p
          className={cn(
            'font-medium',
            isModern
              ? 'text-primary font-semibold text-xs sm:text-sm pt-0.5'
              : 'text-muted-foreground text-xs'
          )}
        >
          {identity.targetRole}
          {identity.targetCompany ? ` — Targeted for ${identity.targetCompany}` : ''}
        </p>

        <div
          className={cn(
            'flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted-foreground pt-1.5',
            layout.headerAlignment === 'center' ? 'justify-center' : 'justify-start',
            isCompact ? 'text-[10px]' : 'text-[11px]'
          )}
        >
          <span>{identity.location}</span>
          <span>&bull;</span>
          <span className='font-mono'>{identity.email}</span>
          {identity.phone && (
            <>
              <span>&bull;</span>
              <span>{identity.phone}</span>
            </>
          )}
          {identity.links && identity.links.length > 0 && (
            <>
              <span>&bull;</span>
              {identity.links.map((link, idx) => (
                <span key={link.label}>
                  <a
                    href={link.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='underline underline-offset-2 hover:text-foreground'
                  >
                    {link.label}
                  </a>
                  {idx < identity.links!.length - 1 && <span className='ml-2'>&bull;</span>}
                </span>
              ))}
            </>
          )}
        </div>
      </header>

      {/* 2. Professional Summary */}
      {summary && (
        <section className={cn(isCompact ? 'mb-3' : 'mb-5')}>
          <h2
            className={cn(
              'font-bold uppercase tracking-wider mb-1.5',
              isClassic && 'text-xs text-foreground border-b border-border/60 pb-0.5',
              isModern &&
                'text-xs text-primary font-semibold flex items-center gap-2 after:h-[1px] after:flex-1 after:bg-primary/20',
              isCompact &&
                'text-[11px] text-foreground font-semibold border-b border-border/40 pb-0.5'
            )}
          >
            Professional Summary
          </h2>
          <p className='text-foreground/90 leading-relaxed'>{summary}</p>
        </section>
      )}

      {/* 3. Technical & Professional Skills */}
      {(skills.technical.length > 0 || skills.tools.length > 0 || skills.soft.length > 0) && (
        <section className={cn(isCompact ? 'mb-3' : 'mb-5')}>
          <h2
            className={cn(
              'font-bold uppercase tracking-wider mb-1.5',
              isClassic && 'text-xs text-foreground border-b border-border/60 pb-0.5',
              isModern &&
                'text-xs text-primary font-semibold flex items-center gap-2 after:h-[1px] after:flex-1 after:bg-primary/20',
              isCompact &&
                'text-[11px] text-foreground font-semibold border-b border-border/40 pb-0.5'
            )}
          >
            Skills & Competencies
          </h2>

          {layout.skillsDisplay === 'pills' ? (
            <div className='space-y-2 pt-0.5'>
              {skills.technical.length > 0 && (
                <div className='flex flex-wrap items-center gap-1.5'>
                  <span className='font-semibold text-foreground text-xs mr-1'>
                    Languages & Frameworks:
                  </span>
                  {skills.technical.map((skill) => (
                    <Badge
                      key={skill}
                      variant='secondary'
                      className='text-[10px] py-0 px-2 font-normal'
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}
              {skills.tools.length > 0 && (
                <div className='flex flex-wrap items-center gap-1.5'>
                  <span className='font-semibold text-foreground text-xs mr-1'>
                    Cloud, Data & Tools:
                  </span>
                  {skills.tools.map((tool) => (
                    <Badge
                      key={tool}
                      variant='outline'
                      className='text-[10px] py-0 px-2 font-normal'
                    >
                      {tool}
                    </Badge>
                  ))}
                </div>
              )}
              {skills.soft.length > 0 && (
                <div className='flex flex-wrap items-center gap-1.5'>
                  <span className='font-semibold text-foreground text-xs mr-1'>
                    Architectural & Practice:
                  </span>
                  {skills.soft.map((item) => (
                    <Badge
                      key={item}
                      variant='secondary'
                      className='text-[10px] py-0 px-2 font-normal'
                    >
                      {item}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ) : layout.skillsDisplay === 'inline' ? (
            <div className='space-y-1 text-foreground/90'>
              {skills.technical.length > 0 && (
                <p>
                  <strong className='text-foreground'>Technical Stack: </strong>
                  {skills.technical.join(' • ')}
                </p>
              )}
              {skills.tools.length > 0 && (
                <p>
                  <strong className='text-foreground'>Cloud & Platforms: </strong>
                  {skills.tools.join(' • ')}
                </p>
              )}
              {skills.soft.length > 0 && (
                <p>
                  <strong className='text-foreground'>Leadership: </strong>
                  {skills.soft.join(' • ')}
                </p>
              )}
            </div>
          ) : (
            <div className='space-y-1 text-foreground/90'>
              {skills.technical.length > 0 && (
                <p>
                  <strong className='text-foreground font-semibold'>
                    Core Languages & Frameworks:{' '}
                  </strong>
                  {skills.technical.join(', ')}
                </p>
              )}
              {skills.tools.length > 0 && (
                <p>
                  <strong className='text-foreground font-semibold'>
                    Infrastructure, Storage & Tooling:{' '}
                  </strong>
                  {skills.tools.join(', ')}
                </p>
              )}
              {skills.soft.length > 0 && (
                <p>
                  <strong className='text-foreground font-semibold'>
                    Domain & Architectural Leadership:{' '}
                  </strong>
                  {skills.soft.join(', ')}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* 4. Professional Experience */}
      {experience.length > 0 && (
        <section className={cn(isCompact ? 'mb-3' : 'mb-5')}>
          <h2
            className={cn(
              'font-bold uppercase tracking-wider mb-2',
              isClassic && 'text-xs text-foreground border-b border-border/60 pb-0.5',
              isModern &&
                'text-xs text-primary font-semibold flex items-center gap-2 after:h-[1px] after:flex-1 after:bg-primary/20',
              isCompact &&
                'text-[11px] text-foreground font-semibold border-b border-border/40 pb-0.5'
            )}
          >
            Professional Experience
          </h2>

          <div className={cn(isCompact ? 'space-y-2.5' : 'space-y-4')}>
            {experience.map((exp) => (
              <div key={exp.id} className='space-y-1'>
                <div className='flex flex-wrap items-baseline justify-between gap-1'>
                  <div>
                    <span className='font-bold text-foreground'>{exp.role}</span>
                    <span className='text-muted-foreground'> &mdash; </span>
                    <span
                      className={cn('font-semibold', isModern ? 'text-primary' : 'text-foreground')}
                    >
                      {exp.employer}
                    </span>
                    {exp.location && (
                      <span className='text-muted-foreground text-[11px]'> ({exp.location})</span>
                    )}
                  </div>
                  <span className='font-mono text-muted-foreground text-[11px] whitespace-nowrap'>
                    {exp.startDate} &mdash; {exp.isCurrent ? 'Present' : exp.endDate || 'Present'}
                  </span>
                </div>

                {exp.bullets.length > 0 && (
                  <ul
                    className={cn(
                      'list-disc text-foreground/90 leading-relaxed',
                      isCompact ? 'pl-4 space-y-0.5 text-[10.5px]' : 'pl-5 space-y-1'
                    )}
                  >
                    {exp.bullets.map((bullet, bIdx) => (
                      <li key={bIdx}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Key Projects */}
      {projects.length > 0 && (
        <section className={cn(isCompact ? 'mb-3' : 'mb-5')}>
          <h2
            className={cn(
              'font-bold uppercase tracking-wider mb-2',
              isClassic && 'text-xs text-foreground border-b border-border/60 pb-0.5',
              isModern &&
                'text-xs text-primary font-semibold flex items-center gap-2 after:h-[1px] after:flex-1 after:bg-primary/20',
              isCompact &&
                'text-[11px] text-foreground font-semibold border-b border-border/40 pb-0.5'
            )}
          >
            Key Projects & Systems
          </h2>

          <div className={cn(isCompact ? 'space-y-2' : 'space-y-3')}>
            {projects.map((proj) => (
              <div key={proj.id} className='space-y-0.5'>
                <div className='flex flex-wrap items-baseline justify-between gap-1'>
                  <div className='flex items-center gap-1.5'>
                    <span className='font-bold text-foreground'>{proj.name}</span>
                    {proj.technologies.length > 0 && (
                      <span className='text-muted-foreground text-[10.5px]'>
                        [{proj.technologies.join(', ')}]
                      </span>
                    )}
                  </div>
                  {proj.url && (
                    <a
                      href={proj.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-primary text-[10.5px] hover:underline'
                    >
                      {proj.url.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>

                <p className='text-foreground/80 text-[11px]'>{proj.description}</p>

                {proj.bullets.length > 0 && (
                  <ul
                    className={cn(
                      'list-disc text-foreground/90 leading-relaxed',
                      isCompact ? 'pl-4 space-y-0.5 text-[10.5px]' : 'pl-5 space-y-0.5'
                    )}
                  >
                    {proj.bullets.map((bullet, bIdx) => (
                      <li key={bIdx}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Education & Certifications */}
      {(education.length > 0 || certifications.length > 0) && (
        <section className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          {education.length > 0 && (
            <div>
              <h2
                className={cn(
                  'font-bold uppercase tracking-wider mb-1.5',
                  isClassic && 'text-xs text-foreground border-b border-border/60 pb-0.5',
                  isModern &&
                    'text-xs text-primary font-semibold flex items-center gap-2 after:h-[1px] after:flex-1 after:bg-primary/20',
                  isCompact &&
                    'text-[11px] text-foreground font-semibold border-b border-border/40 pb-0.5'
                )}
              >
                Education
              </h2>
              <div className='space-y-1.5'>
                {education.map((edu) => (
                  <div key={edu.id}>
                    <p className='font-bold text-foreground'>
                      {edu.degree} in {edu.fieldOfStudy}
                    </p>
                    <p className='text-muted-foreground text-[11px]'>
                      {edu.institution} &bull; {edu.startDate} &mdash; {edu.endDate || 'Present'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {certifications.length > 0 && (
            <div>
              <h2
                className={cn(
                  'font-bold uppercase tracking-wider mb-1.5',
                  isClassic && 'text-xs text-foreground border-b border-border/60 pb-0.5',
                  isModern &&
                    'text-xs text-primary font-semibold flex items-center gap-2 after:h-[1px] after:flex-1 after:bg-primary/20',
                  isCompact &&
                    'text-[11px] text-foreground font-semibold border-b border-border/40 pb-0.5'
                )}
              >
                Certifications
              </h2>
              <div className='space-y-1.5'>
                {certifications.map((cert) => (
                  <div key={cert.id}>
                    <p className='font-bold text-foreground'>{cert.name}</p>
                    <p className='text-muted-foreground text-[11px]'>
                      {cert.issuer} &bull; Issued {cert.issueDate}
                      {cert.credentialId ? ` (${cert.credentialId})` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
