'use client';

import { useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { candidateProfileQueryOptions } from '../api/queries';
import { updateCandidateProfileMutation } from '../api/mutations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';

import { KnowledgeBankWorkspace } from '@/features/knowledge/components/knowledge-bank-workspace';

export default function ResumeProfilePage() {
  const { data: profile } = useSuspenseQuery(candidateProfileQueryOptions());

  const [summary, setSummary] = useState(profile.professionalSummary);
  const [targetRoles, setTargetRoles] = useState(profile.targetRoles.join(', '));
  const [activeTab, setActiveTab] = useState<'knowledge' | 'profile' | 'resume'>('knowledge');

  const profileMutation = useMutation({
    ...updateCandidateProfileMutation,
    onSuccess: () => {
      toast.success('Master profile updated successfully.');
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to update profile';
      toast.error(msg);
    }
  });

  const handleSave = () => {
    profileMutation.mutate({
      updates: {
        professionalSummary: summary,
        targetRoles: targetRoles
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean)
      }
    });
  };

  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6'>
      {/* Top Banner */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold tracking-tight text-foreground'>
            Career Assets & Knowledge
          </h1>
          <p className='text-sm text-muted-foreground'>
            The Candidate Knowledge Bank is your persistent, verified source of career truth.
            Resumes are representations compiled from this knowledge.
          </p>
        </div>

        {activeTab === 'profile' && (
          <Button
            size='default'
            disabled={profileMutation.isPending}
            onClick={handleSave}
            className='shadow-xs shrink-0'
          >
            <Icons.check className='mr-1.5 h-4 w-4' />
            Save Profile Changes
          </Button>
        )}
      </div>

      {/* Primary Workspace Navigation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'knowledge' | 'profile' | 'resume')}
        className='w-full'
      >
        <TabsList className='grid grid-cols-3 w-full max-w-lg mb-2'>
          <TabsTrigger value='knowledge' className='gap-1.5 text-xs'>
            <Icons.sparkles className='h-3.5 w-3.5' /> Knowledge Bank
          </TabsTrigger>
          <TabsTrigger value='profile' className='gap-1.5 text-xs'>
            <Icons.user className='h-3.5 w-3.5' /> Profile & Identity
          </TabsTrigger>
          <TabsTrigger value='resume' className='gap-1.5 text-xs'>
            <Icons.page className='h-3.5 w-3.5' /> Master Resume
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Candidate Knowledge Bank (Canonical Store) */}
        <TabsContent value='knowledge' className='pt-2'>
          <KnowledgeBankWorkspace candidateId={profile.id} />
        </TabsContent>

        {/* Tab 2: Profile & Identity */}
        <TabsContent value='profile' className='pt-2 space-y-4'>
          <Tabs defaultValue='summary' className='w-full'>
            <TabsList className='grid grid-cols-2 sm:grid-cols-5 w-full max-w-2xl'>
              <TabsTrigger value='summary'>Summary</TabsTrigger>
              <TabsTrigger value='experience'>Experience</TabsTrigger>
              <TabsTrigger value='skills'>Skills</TabsTrigger>
              <TabsTrigger value='education'>Education</TabsTrigger>
              <TabsTrigger value='projects'>Projects</TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent value='summary' className='space-y-4 pt-4'>
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>Professional Summary & Target Roles</CardTitle>
                  <CardDescription>
                    Your overarching career identity used as the baseline for all role-specific
                    tailors.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='space-y-2'>
                    <label
                      htmlFor='profile-target-roles'
                      className='text-xs font-medium text-foreground'
                    >
                      Target Roles (Comma-separated)
                    </label>
                    <Input
                      id='profile-target-roles'
                      value={targetRoles}
                      onChange={(e) => setTargetRoles(e.target.value)}
                      placeholder='Senior Full-Stack Engineer, Frontend Platform Engineer...'
                    />
                  </div>
                  <div className='space-y-2'>
                    <label
                      htmlFor='profile-master-summary'
                      className='text-xs font-medium text-foreground'
                    >
                      Master Professional Summary
                    </label>
                    <Textarea
                      id='profile-master-summary'
                      rows={5}
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      className='text-xs leading-relaxed'
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Experience Tab */}
            <TabsContent value='experience' className='space-y-4 pt-4'>
              <div className='space-y-4'>
                {profile.experience.map((exp) => (
                  <Card key={exp.id}>
                    <CardHeader className='pb-3'>
                      <div className='flex items-start justify-between'>
                        <div>
                          <CardTitle className='text-base'>{exp.role}</CardTitle>
                          <CardDescription>
                            {exp.employer} • {exp.location}
                          </CardDescription>
                        </div>
                        <Badge variant='outline' className='text-xs'>
                          {exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className='space-y-3 text-xs text-muted-foreground'>
                      <div>
                        <span className='font-semibold text-foreground block mb-1'>
                          Responsibilities:
                        </span>
                        <ul className='list-disc pl-4 space-y-1'>
                          {exp.responsibilities.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                      {exp.achievements.length > 0 && (
                        <div>
                          <span className='font-semibold text-foreground block mb-1'>
                            Key Achievements:
                          </span>
                          <ul className='list-disc pl-4 space-y-1 text-primary'>
                            {exp.achievements.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {exp.candidateEvidence && (
                        <div className='rounded bg-muted/50 p-2.5 border border-border/50 text-[11px] italic'>
                          <span className='font-semibold text-foreground not-italic'>
                            Candidate Evidence:{' '}
                          </span>
                          &ldquo;{exp.candidateEvidence}&rdquo;
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Skills Tab */}
            <TabsContent value='skills' className='space-y-4 pt-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-sm font-semibold'>Technical Skills</CardTitle>
                  </CardHeader>
                  <CardContent className='flex flex-wrap gap-1.5'>
                    {profile.skills.technical.map((s) => (
                      <Badge key={s} variant='secondary' className='text-xs'>
                        {s}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-sm font-semibold'>Tools & Infrastructure</CardTitle>
                  </CardHeader>
                  <CardContent className='flex flex-wrap gap-1.5'>
                    {profile.skills.tools.map((t) => (
                      <Badge key={t} variant='outline' className='text-xs'>
                        {t}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-sm font-semibold'>Soft Skills & Practices</CardTitle>
                  </CardHeader>
                  <CardContent className='flex flex-wrap gap-1.5'>
                    {profile.skills.soft.map((s) => (
                      <Badge key={s} variant='outline' className='text-xs'>
                        {s}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-sm font-semibold'>Other Proficiencies</CardTitle>
                  </CardHeader>
                  <CardContent className='flex flex-wrap gap-1.5'>
                    {profile.skills.other.map((o) => (
                      <Badge key={o} variant='secondary' className='text-xs'>
                        {o}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Education Tab */}
            <TabsContent value='education' className='space-y-4 pt-4'>
              <div className='space-y-4'>
                {profile.education.map((edu) => (
                  <Card key={edu.id}>
                    <CardHeader className='pb-2'>
                      <div className='flex items-start justify-between'>
                        <div>
                          <CardTitle className='text-base'>
                            {edu.degree} in {edu.fieldOfStudy}
                          </CardTitle>
                          <CardDescription>{edu.institution}</CardDescription>
                        </div>
                        <Badge variant='outline' className='text-xs'>
                          {edu.startDate} – {edu.endDate}
                        </Badge>
                      </div>
                    </CardHeader>
                    {edu.details && (
                      <CardContent className='text-xs text-muted-foreground'>
                        {edu.details}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Projects Tab */}
            <TabsContent value='projects' className='space-y-4 pt-4'>
              <div className='space-y-4'>
                {profile.projects.map((proj) => (
                  <Card key={proj.id}>
                    <CardHeader>
                      <CardTitle className='text-base'>{proj.name}</CardTitle>
                      <CardDescription>{proj.description}</CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-2 text-xs text-muted-foreground'>
                      <div className='flex flex-wrap gap-1.5'>
                        {proj.technologies.map((t) => (
                          <Badge key={t} variant='outline' className='text-[10px]'>
                            {t}
                          </Badge>
                        ))}
                      </div>
                      <p>
                        <span className='font-semibold text-foreground'>Contributions: </span>
                        {proj.contributions}
                      </p>
                      {proj.outcomes && (
                        <p>
                          <span className='font-semibold text-foreground'>Outcomes: </span>
                          {proj.outcomes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Tab 3: Formatted Master Resume Preview */}
        <TabsContent value='resume' className='pt-2'>
          <Card className='max-w-4xl mx-auto border-border shadow-xs'>
            <CardContent className='p-8 space-y-6 text-foreground font-sans'>
              <div className='border-b border-border/80 pb-4 text-center space-y-1.5'>
                <h2 className='text-2xl font-bold tracking-tight'>{profile.name}</h2>
                <div className='flex items-center justify-center gap-3 text-xs text-muted-foreground'>
                  <span>{profile.email}</span>
                  {profile.phone && <span>• {profile.phone}</span>}
                  <span>• {profile.location}</span>
                </div>
                <div className='pt-1 text-xs font-medium text-primary'>
                  Targeting: {profile.targetRoles.join(' | ')}
                </div>
              </div>

              <div className='space-y-2'>
                <h3 className='text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-1'>
                  Professional Summary
                </h3>
                <p className='text-xs leading-relaxed text-foreground/90'>{summary}</p>
              </div>

              <div className='space-y-3'>
                <h3 className='text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-1'>
                  Work Experience
                </h3>
                {profile.experience.map((exp) => (
                  <div key={exp.id} className='space-y-1 text-xs'>
                    <div className='flex justify-between font-semibold'>
                      <span>
                        {exp.role} — {exp.employer}
                      </span>
                      <span className='text-muted-foreground'>
                        {exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate}
                      </span>
                    </div>
                    <ul className='list-disc pl-4 space-y-0.5 text-muted-foreground'>
                      {exp.responsibilities.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className='space-y-3'>
                <h3 className='text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-1'>
                  Education
                </h3>
                {profile.education.map((edu) => (
                  <div key={edu.id} className='flex justify-between text-xs'>
                    <div>
                      <p className='font-semibold'>
                        {edu.degree} in {edu.fieldOfStudy}
                      </p>
                      <p className='text-muted-foreground'>{edu.institution}</p>
                    </div>
                    <span className='text-muted-foreground'>
                      {edu.startDate} – {edu.endDate}
                    </span>
                  </div>
                ))}
              </div>

              <div className='space-y-2'>
                <h3 className='text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-1'>
                  Core Skills
                </h3>
                <div className='text-xs space-y-1 text-muted-foreground'>
                  <p>
                    <span className='font-semibold text-foreground'>Technical:</span>{' '}
                    {profile.skills.technical.join(', ')}
                  </p>
                  <p>
                    <span className='font-semibold text-foreground'>Tools & Cloud:</span>{' '}
                    {profile.skills.tools.join(', ')}
                  </p>
                  <p>
                    <span className='font-semibold text-foreground'>Soft Skills:</span>{' '}
                    {profile.skills.soft.join(', ')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
