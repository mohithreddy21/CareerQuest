'use client';

import { useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { candidateProfileQueryOptions } from '../api/queries';
import { updateCandidateProfileMutation } from '../api/mutations';
import { knowledgeBankQueryOptions } from '@/features/knowledge/api/queries';
import {
  addKnowledgeItemMutation,
  updateKnowledgeItemMutation,
  updateKnowledgeStatusMutation,
  deleteKnowledgeItemMutation
} from '@/features/knowledge/api/mutations';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import {
  KnowledgeCategory,
  KnowledgeItem,
  SkillKnowledgeContent,
  ExperienceKnowledgeContent,
  EducationKnowledgeContent,
  ProjectKnowledgeContent
} from '@/types/knowledge';
import { KnowledgeBankWorkspace } from '@/features/knowledge/components/knowledge-bank-workspace';
import { KnowledgeItemDialog } from '@/features/knowledge/components/knowledge-item-dialog';
import { ResumeUploadDialog } from '@/features/knowledge/components/resume-upload-dialog';

interface SkillBadgeProps {
  item: KnowledgeItem;
  onEdit: (item: KnowledgeItem) => void;
  onArchive: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
}

function SkillBadge({ item, onEdit, onArchive, onDelete }: SkillBadgeProps) {
  const content = item.content as SkillKnowledgeContent;
  const name = content.name;
  const proficiency = content.proficiency;
  const years = content.yearsOfExperience;

  return (
    <div className='group inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-secondary/40 px-2.5 py-1 text-xs font-medium text-foreground transition-all hover:border-primary/40 hover:bg-secondary/80'>
      <span className='font-semibold'>{name}</span>
      {years ? <span className='text-[10px] text-muted-foreground'>({years}y)</span> : null}
      {proficiency && proficiency !== 'advanced' ? (
        <span className='text-[10px] text-muted-foreground/80 capitalize'>• {proficiency}</span>
      ) : null}

      <div className='flex items-center gap-0.5 ml-1 opacity-60 group-hover:opacity-100 transition-opacity'>
        <button
          type='button'
          onClick={() => onEdit(item)}
          className='p-0.5 text-muted-foreground hover:text-primary transition-colors rounded'
          title={`Edit ${name}`}
          aria-label={`Edit ${name}`}
        >
          <Icons.edit className='h-3 w-3' />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type='button'
                className='p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded'
                aria-label={`More options for ${name}`}
              >
                <Icons.ellipsis className='h-3 w-3' />
              </button>
            }
          />
          <DropdownMenuContent align='end' className='text-xs min-w-36'>
            <DropdownMenuItem onClick={() => onEdit(item)} className='gap-2 cursor-pointer'>
              <Icons.edit className='h-3.5 w-3.5' /> Edit Skill
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onArchive(item.id, name)}
              className='gap-2 cursor-pointer'
            >
              <Icons.eyeOff className='h-3.5 w-3.5' /> Archive Skill
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(item.id, name)}
              className='gap-2 text-destructive focus:text-destructive cursor-pointer'
            >
              <Icons.trash className='h-3.5 w-3.5' /> Delete Permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function ResumeProfilePage({ candidateId }: { candidateId?: string } = {}) {
  const { data: profile } = useSuspenseQuery(candidateProfileQueryOptions());
  const activeCandidateId = candidateId || profile.id;
  const { data: bank } = useSuspenseQuery(knowledgeBankQueryOptions(activeCandidateId));

  // Profile fields state
  const [name, setName] = useState(profile.name || '');
  const [headline, setHeadline] = useState(profile.headline || '');
  const [location, setLocation] = useState(profile.location || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [summary, setSummary] = useState(profile.professionalSummary || '');
  const [targetRoles, setTargetRoles] = useState(profile.targetRoles.join(', '));

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'knowledge' | 'profile' | 'resume'>('profile');
  const [profileSubTab, setProfileSubTab] = useState('skills');

  // Dialog state for knowledge item mutations
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [dialogCategory, setDialogCategory] = useState<KnowledgeCategory>('skill');
  const [dialogSkillCategory, setDialogSkillCategory] = useState<
    'technical' | 'tools' | 'soft' | 'other' | undefined
  >(undefined);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);

  // Mutations
  const profileMutation = useMutation({
    ...updateCandidateProfileMutation,
    onSuccess: () => {
      toast.success('Profile & Identity saved successfully.');
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to update profile';
      toast.error(msg);
    }
  });

  const addKnowledgeMutation = useMutation({
    ...addKnowledgeItemMutation
  });

  const updateKnowledgeMutation = useMutation({
    ...updateKnowledgeItemMutation
  });

  const statusKnowledgeMutation = useMutation({
    ...updateKnowledgeStatusMutation
  });

  const deleteKnowledgeMutation = useMutation({
    ...deleteKnowledgeItemMutation
  });

  const handleSave = () => {
    profileMutation.mutate({
      updates: {
        name: name.trim() || undefined,
        headline: headline.trim() || undefined,
        location: location.trim() || undefined,
        phone: phone.trim() || undefined,
        professionalSummary: summary,
        targetRoles: targetRoles
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean)
      }
    });
  };

  const handleOpenAdd = (
    category: KnowledgeCategory,
    skillCategory?: 'technical' | 'tools' | 'soft' | 'other'
  ) => {
    setEditingItem(null);
    setDialogCategory(category);
    setDialogSkillCategory(skillCategory);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: KnowledgeItem) => {
    setEditingItem(item);
    setDialogCategory(item.category);
    if (item.category === 'skill') {
      setDialogSkillCategory((item.content as SkillKnowledgeContent).category || 'technical');
    } else {
      setDialogSkillCategory(undefined);
    }
    setDialogOpen(true);
  };

  const handleSaveKnowledgeItem = (
    category: KnowledgeCategory,
    content: Record<string, unknown>,
    itemId?: string
  ) => {
    if (itemId) {
      updateKnowledgeMutation.mutate(
        {
          id: itemId,
          content,
          provenanceNote: 'Updated via Profile & Identity'
        },
        {
          onSuccess: () => {
            toast.success(
              `${category.charAt(0).toUpperCase() + category.slice(1)} updated in Knowledge Bank.`
            );
            setDialogOpen(false);
            setEditingItem(null);
          },
          onError: (err: Error) => {
            toast.error(err.message || 'Failed to update item');
          }
        }
      );
    } else {
      addKnowledgeMutation.mutate(
        {
          candidateId: profile.id,
          category,
          content,
          provenanceLabel: 'Profile & Identity entry'
        },
        {
          onSuccess: () => {
            toast.success(
              `${category.charAt(0).toUpperCase() + category.slice(1)} added to Knowledge Bank.`
            );
            setDialogOpen(false);
            setEditingItem(null);
          },
          onError: (err: Error) => {
            toast.error(err.message || 'Failed to add item');
          }
        }
      );
    }
  };

  const handleDeleteKnowledgeItem = (id: string, label: string) => {
    deleteKnowledgeMutation.mutate(id, {
      onSuccess: () => {
        toast.success(`${label} permanently removed.`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to remove item');
      }
    });
  };

  const handleArchiveKnowledgeItem = (id: string, label: string) => {
    statusKnowledgeMutation.mutate(
      { id, status: 'archived' },
      {
        onSuccess: () => {
          toast.success(`${label} archived.`);
        },
        onError: (err: Error) => {
          toast.error(err.message || 'Failed to archive item');
        }
      }
    );
  };

  // Approved knowledge items grouped by category
  const approvedSkills = bank.skills.filter((s) => s.status === 'approved');
  const approvedExperiences = bank.experiences.filter((e) => e.status === 'approved');
  const approvedEducation = bank.education.filter((e) => e.status === 'approved');
  const approvedProjects = bank.projects.filter((p) => p.status === 'approved');

  const technicalSkills = approvedSkills.filter(
    (s) => ((s.content as SkillKnowledgeContent).category || 'technical') === 'technical'
  );
  const toolSkills = approvedSkills.filter(
    (s) => (s.content as SkillKnowledgeContent).category === 'tools'
  );
  const softSkills = approvedSkills.filter(
    (s) => (s.content as SkillKnowledgeContent).category === 'soft'
  );
  const otherSkills = approvedSkills.filter(
    (s) => (s.content as SkillKnowledgeContent).category === 'other'
  );

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

        <div className='flex items-center gap-2 shrink-0'>
          <Button
            variant='outline'
            size='default'
            onClick={() => setUploadDialogOpen(true)}
            className='gap-1.5 shadow-xs'
          >
            <Icons.upload className='h-4 w-4' />
            Upload Resume
          </Button>
          {activeTab === 'profile' && (
            <Button
              size='default'
              disabled={profileMutation.isPending}
              onClick={handleSave}
              className='shadow-xs'
            >
              <Icons.check className='mr-1.5 h-4 w-4' />
              {profileMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
            </Button>
          )}
        </div>
      </div>

      {/* Primary Workspace Navigation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'knowledge' | 'profile' | 'resume')}
        className='w-full'
      >
        <TabsList className='grid grid-cols-3 w-full max-w-lg mb-2'>
          <TabsTrigger value='profile' className='gap-1.5 text-xs'>
            <Icons.user className='h-3.5 w-3.5' /> Profile & Identity
          </TabsTrigger>
          <TabsTrigger value='knowledge' className='gap-1.5 text-xs'>
            <Icons.sparkles className='h-3.5 w-3.5' /> Knowledge Bank
          </TabsTrigger>
          <TabsTrigger value='resume' className='gap-1.5 text-xs'>
            <Icons.page className='h-3.5 w-3.5' /> Master Resume
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile & Identity */}
        <TabsContent value='profile' className='pt-2 space-y-4'>
          <Tabs value={profileSubTab} onValueChange={setProfileSubTab} className='w-full'>
            <TabsList className='h-auto grid grid-cols-3 sm:grid-cols-5 w-full max-w-2xl p-1 gap-1'>
              <TabsTrigger value='skills'>Skills</TabsTrigger>
              <TabsTrigger value='summary'>Summary</TabsTrigger>
              <TabsTrigger value='experience'>Experience</TabsTrigger>
              <TabsTrigger value='education'>Education</TabsTrigger>
              <TabsTrigger value='projects'>Projects</TabsTrigger>
            </TabsList>

            {/* Sub-Tab: Skills */}
            <TabsContent value='skills' className='space-y-4 pt-4'>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/50'>
                <div>
                  <h2 className='text-base font-semibold text-foreground'>
                    Skills & Proficiencies
                  </h2>
                  <p className='text-xs text-muted-foreground'>
                    Approved skills from your Knowledge Bank grouped by domain. These directly power
                    AI match scoring and resume tailoring.
                  </p>
                </div>
                <Button
                  size='sm'
                  onClick={() => handleOpenAdd('skill')}
                  className='gap-1.5 shrink-0'
                >
                  <Icons.add className='h-4 w-4' /> Add Skill
                </Button>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {/* 1. Technical Skills */}
                <Card className='border-border/70 shadow-xs'>
                  <CardHeader className='pb-3 flex flex-row items-center justify-between space-y-0'>
                    <div>
                      <CardTitle className='text-sm font-semibold'>Technical Skills</CardTitle>
                      <CardDescription className='text-xs'>
                        {technicalSkills.length === 1
                          ? '1 skill'
                          : `${technicalSkills.length} skills`}
                      </CardDescription>
                    </div>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handleOpenAdd('skill', 'technical')}
                      className='h-7 text-xs gap-1'
                    >
                      <Icons.add className='h-3 w-3' /> Add Skill
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {technicalSkills.length === 0 ? (
                      <div className='rounded-lg border border-dashed p-4 text-center'>
                        <p className='text-xs text-muted-foreground mb-2'>
                          No technical skills added yet. Add languages, frameworks, and architecture
                          proficiencies.
                        </p>
                        <Button
                          size='sm'
                          variant='secondary'
                          onClick={() => handleOpenAdd('skill', 'technical')}
                          className='h-7 text-xs gap-1'
                        >
                          <Icons.add className='h-3 w-3' /> Add Technical Skill
                        </Button>
                      </div>
                    ) : (
                      <div className='flex flex-wrap gap-1.5'>
                        {technicalSkills.map((s) => (
                          <SkillBadge
                            key={s.id}
                            item={s}
                            onEdit={handleOpenEdit}
                            onArchive={handleArchiveKnowledgeItem}
                            onDelete={handleDeleteKnowledgeItem}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 2. Tools & Infrastructure */}
                <Card className='border-border/70 shadow-xs'>
                  <CardHeader className='pb-3 flex flex-row items-center justify-between space-y-0'>
                    <div>
                      <CardTitle className='text-sm font-semibold'>
                        Tools & Infrastructure
                      </CardTitle>
                      <CardDescription className='text-xs'>
                        {toolSkills.length === 1 ? '1 tool' : `${toolSkills.length} tools`}
                      </CardDescription>
                    </div>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handleOpenAdd('skill', 'tools')}
                      className='h-7 text-xs gap-1'
                    >
                      <Icons.add className='h-3 w-3' /> Add Tool
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {toolSkills.length === 0 ? (
                      <div className='rounded-lg border border-dashed p-4 text-center'>
                        <p className='text-xs text-muted-foreground mb-2'>
                          No tools or infrastructure skills added yet. Add databases, cloud
                          platforms, and DevOps tools.
                        </p>
                        <Button
                          size='sm'
                          variant='secondary'
                          onClick={() => handleOpenAdd('skill', 'tools')}
                          className='h-7 text-xs gap-1'
                        >
                          <Icons.add className='h-3 w-3' /> Add Tool
                        </Button>
                      </div>
                    ) : (
                      <div className='flex flex-wrap gap-1.5'>
                        {toolSkills.map((s) => (
                          <SkillBadge
                            key={s.id}
                            item={s}
                            onEdit={handleOpenEdit}
                            onArchive={handleArchiveKnowledgeItem}
                            onDelete={handleDeleteKnowledgeItem}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 3. Soft Skills & Practices */}
                <Card className='border-border/70 shadow-xs'>
                  <CardHeader className='pb-3 flex flex-row items-center justify-between space-y-0'>
                    <div>
                      <CardTitle className='text-sm font-semibold'>
                        Soft Skills & Practices
                      </CardTitle>
                      <CardDescription className='text-xs'>
                        {softSkills.length === 1 ? '1 practice' : `${softSkills.length} practices`}
                      </CardDescription>
                    </div>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handleOpenAdd('skill', 'soft')}
                      className='h-7 text-xs gap-1'
                    >
                      <Icons.add className='h-3 w-3' /> Add Practice
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {softSkills.length === 0 ? (
                      <div className='rounded-lg border border-dashed p-4 text-center'>
                        <p className='text-xs text-muted-foreground mb-2'>
                          No practices added yet. Add methodologies, leadership, and communication
                          skills.
                        </p>
                        <Button
                          size='sm'
                          variant='secondary'
                          onClick={() => handleOpenAdd('skill', 'soft')}
                          className='h-7 text-xs gap-1'
                        >
                          <Icons.add className='h-3 w-3' /> Add Practice
                        </Button>
                      </div>
                    ) : (
                      <div className='flex flex-wrap gap-1.5'>
                        {softSkills.map((s) => (
                          <SkillBadge
                            key={s.id}
                            item={s}
                            onEdit={handleOpenEdit}
                            onArchive={handleArchiveKnowledgeItem}
                            onDelete={handleDeleteKnowledgeItem}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 4. Other Proficiencies */}
                <Card className='border-border/70 shadow-xs'>
                  <CardHeader className='pb-3 flex flex-row items-center justify-between space-y-0'>
                    <div>
                      <CardTitle className='text-sm font-semibold'>Other Proficiencies</CardTitle>
                      <CardDescription className='text-xs'>
                        {otherSkills.length === 1
                          ? '1 proficiency'
                          : `${otherSkills.length} proficiencies`}
                      </CardDescription>
                    </div>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handleOpenAdd('skill', 'other')}
                      className='h-7 text-xs gap-1'
                    >
                      <Icons.add className='h-3 w-3' /> Add Skill
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {otherSkills.length === 0 ? (
                      <div className='rounded-lg border border-dashed p-4 text-center'>
                        <p className='text-xs text-muted-foreground mb-2'>
                          No additional skills added yet. Add domain proficiencies or specialized
                          capabilities.
                        </p>
                        <Button
                          size='sm'
                          variant='secondary'
                          onClick={() => handleOpenAdd('skill', 'other')}
                          className='h-7 text-xs gap-1'
                        >
                          <Icons.add className='h-3 w-3' /> Add Proficiency
                        </Button>
                      </div>
                    ) : (
                      <div className='flex flex-wrap gap-1.5'>
                        {otherSkills.map((s) => (
                          <SkillBadge
                            key={s.id}
                            item={s}
                            onEdit={handleOpenEdit}
                            onArchive={handleArchiveKnowledgeItem}
                            onDelete={handleDeleteKnowledgeItem}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Sub-Tab: Summary & Identity */}
            <TabsContent value='summary' className='space-y-4 pt-4'>
              <Card className='border-border/70 shadow-xs'>
                <CardHeader>
                  <CardTitle className='text-base'>Candidate Identity & Target Roles</CardTitle>
                  <CardDescription className='text-xs'>
                    Your personal details and overarching career positioning used across job matches
                    and resume tailoring.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div className='space-y-1.5'>
                      <label
                        htmlFor='profile-full-name'
                        className='text-xs font-medium text-foreground'
                      >
                        Full Name *
                      </label>
                      <Input
                        id='profile-full-name'
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder='e.g. Alex Chen'
                        className='text-xs'
                      />
                    </div>

                    <div className='space-y-1.5'>
                      <label
                        htmlFor='profile-headline'
                        className='text-xs font-medium text-foreground'
                      >
                        Professional Headline
                      </label>
                      <Input
                        id='profile-headline'
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        placeholder='e.g. Senior Full-Stack & Distributed Systems Engineer'
                        className='text-xs'
                      />
                    </div>

                    <div className='space-y-1.5'>
                      <label
                        htmlFor='profile-location'
                        className='text-xs font-medium text-foreground'
                      >
                        Location
                      </label>
                      <Input
                        id='profile-location'
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder='e.g. San Francisco, CA or Remote'
                        className='text-xs'
                      />
                    </div>

                    <div className='space-y-1.5'>
                      <label
                        htmlFor='profile-phone'
                        className='text-xs font-medium text-foreground'
                      >
                        Phone Number
                      </label>
                      <Input
                        id='profile-phone'
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder='e.g. +1 555 123 4567'
                        className='text-xs'
                      />
                    </div>
                  </div>

                  <div className='space-y-1.5'>
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
                      placeholder='Senior Full-Stack Engineer, Frontend Platform Engineer, Staff Architect...'
                      className='text-xs'
                    />
                  </div>

                  <div className='space-y-1.5'>
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
                      placeholder='Write a concise, compelling summary of your career experience and technical strengths...'
                      className='text-xs leading-relaxed'
                    />
                  </div>
                </CardContent>
                <CardFooter className='border-t bg-muted/20 px-6 py-3 flex items-center justify-between'>
                  <p className='text-[11px] text-muted-foreground'>
                    Clicking save updates your profile and re-anchors your Master Resume.
                  </p>
                  <Button
                    size='sm'
                    disabled={profileMutation.isPending}
                    onClick={handleSave}
                    className='shadow-xs'
                  >
                    <Icons.check className='mr-1.5 h-3.5 w-3.5' />
                    {profileMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            {/* Sub-Tab: Experience */}
            <TabsContent value='experience' className='space-y-4 pt-4'>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/50'>
                <div>
                  <h2 className='text-base font-semibold text-foreground'>Work Experience</h2>
                  <p className='text-xs text-muted-foreground'>
                    Verified professional roles that ground tailored resume bullet points and career
                    achievements.
                  </p>
                </div>
                <Button
                  size='sm'
                  onClick={() => handleOpenAdd('experience')}
                  className='gap-1.5 shrink-0'
                >
                  <Icons.add className='h-4 w-4' /> Add Experience
                </Button>
              </div>

              {approvedExperiences.length === 0 ? (
                <Card className='border-dashed'>
                  <CardContent className='flex flex-col items-center justify-center py-10 text-center space-y-3'>
                    <div className='rounded-full bg-muted p-3 text-muted-foreground'>
                      <Icons.user className='h-6 w-6' />
                    </div>
                    <div className='space-y-1'>
                      <h3 className='font-semibold text-sm'>No work experience added yet</h3>
                      <p className='text-xs text-muted-foreground max-w-sm'>
                        Add your career history to ground your resume tailoring and calculate
                        verified job matches.
                      </p>
                    </div>
                    <Button
                      size='sm'
                      onClick={() => handleOpenAdd('experience')}
                      className='gap-1.5'
                    >
                      <Icons.add className='h-3.5 w-3.5' /> Add Experience
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className='space-y-4'>
                  {approvedExperiences.map((exp) => {
                    const content = exp.content as ExperienceKnowledgeContent;
                    return (
                      <Card key={exp.id} className='border-border/70 shadow-xs'>
                        <CardHeader className='pb-3'>
                          <div className='flex items-start justify-between gap-3'>
                            <div>
                              <CardTitle className='text-base'>{content.role}</CardTitle>
                              <CardDescription>
                                {content.employer} • {content.location || 'Remote'}
                              </CardDescription>
                            </div>
                            <div className='flex items-center gap-2'>
                              <Badge variant='outline' className='text-xs'>
                                {content.startDate} –{' '}
                                {content.isCurrent ? 'Present' : content.endDate}
                              </Badge>
                              <Button
                                size='sm'
                                variant='ghost'
                                onClick={() => handleOpenEdit(exp)}
                                className='h-7 px-2 text-xs gap-1'
                                title='Edit Experience'
                              >
                                <Icons.edit className='h-3.5 w-3.5' /> Edit
                              </Button>
                              <Button
                                size='sm'
                                variant='ghost'
                                onClick={() =>
                                  handleDeleteKnowledgeItem(
                                    exp.id,
                                    `${content.role} at ${content.employer}`
                                  )
                                }
                                className='h-7 px-2 text-xs text-destructive hover:text-destructive gap-1'
                                title='Delete Experience'
                              >
                                <Icons.trash className='h-3.5 w-3.5' />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className='space-y-3 text-xs text-muted-foreground'>
                          {content.responsibilities && content.responsibilities.length > 0 && (
                            <div>
                              <span className='font-semibold text-foreground block mb-1'>
                                Responsibilities:
                              </span>
                              <ul className='list-disc pl-4 space-y-1'>
                                {content.responsibilities.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {content.achievements && content.achievements.length > 0 && (
                            <div>
                              <span className='font-semibold text-foreground block mb-1'>
                                Key Achievements:
                              </span>
                              <ul className='list-disc pl-4 space-y-1 text-primary'>
                                {content.achievements.map((a, i) => (
                                  <li key={i}>{a}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {(content as unknown as Record<string, unknown>).candidateEvidence ? (
                            <div className='rounded bg-muted/50 p-2.5 border border-border/50 text-[11px] italic'>
                              <span className='font-semibold text-foreground not-italic'>
                                Candidate Evidence:{' '}
                              </span>
                              &ldquo;
                              {String(
                                (content as unknown as Record<string, unknown>).candidateEvidence
                              )}
                              &rdquo;
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Sub-Tab: Education */}
            <TabsContent value='education' className='space-y-4 pt-4'>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/50'>
                <div>
                  <h2 className='text-base font-semibold text-foreground'>
                    Education & Credentials
                  </h2>
                  <p className='text-xs text-muted-foreground'>
                    Degrees, institutions, and fields of study verified in your Knowledge Bank.
                  </p>
                </div>
                <Button
                  size='sm'
                  onClick={() => handleOpenAdd('education')}
                  className='gap-1.5 shrink-0'
                >
                  <Icons.add className='h-4 w-4' /> Add Education
                </Button>
              </div>

              {approvedEducation.length === 0 ? (
                <Card className='border-dashed'>
                  <CardContent className='flex flex-col items-center justify-center py-10 text-center space-y-3'>
                    <div className='rounded-full bg-muted p-3 text-muted-foreground'>
                      <Icons.page className='h-6 w-6' />
                    </div>
                    <div className='space-y-1'>
                      <h3 className='font-semibold text-sm'>No education records added yet</h3>
                      <p className='text-xs text-muted-foreground max-w-sm'>
                        Record your degrees and academic history to complete your candidate
                        background.
                      </p>
                    </div>
                    <Button
                      size='sm'
                      onClick={() => handleOpenAdd('education')}
                      className='gap-1.5'
                    >
                      <Icons.add className='h-3.5 w-3.5' /> Add Education
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className='space-y-4'>
                  {approvedEducation.map((edu) => {
                    const content = edu.content as EducationKnowledgeContent;
                    return (
                      <Card key={edu.id} className='border-border/70 shadow-xs'>
                        <CardHeader className='pb-2'>
                          <div className='flex items-start justify-between gap-3'>
                            <div>
                              <CardTitle className='text-base'>
                                {content.degree} in {content.fieldOfStudy}
                              </CardTitle>
                              <CardDescription>{content.institution}</CardDescription>
                            </div>
                            <div className='flex items-center gap-2'>
                              {content.startDate && (
                                <Badge variant='outline' className='text-xs'>
                                  {content.startDate} – {content.endDate || 'Present'}
                                </Badge>
                              )}
                              <Button
                                size='sm'
                                variant='ghost'
                                onClick={() => handleOpenEdit(edu)}
                                className='h-7 px-2 text-xs gap-1'
                                title='Edit Education'
                              >
                                <Icons.edit className='h-3.5 w-3.5' /> Edit
                              </Button>
                              <Button
                                size='sm'
                                variant='ghost'
                                onClick={() =>
                                  handleDeleteKnowledgeItem(
                                    edu.id,
                                    `${content.degree} at ${content.institution}`
                                  )
                                }
                                className='h-7 px-2 text-xs text-destructive hover:text-destructive gap-1'
                                title='Delete Education'
                              >
                                <Icons.trash className='h-3.5 w-3.5' />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        {content.details && (
                          <CardContent className='text-xs text-muted-foreground pt-1'>
                            {content.details}
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Sub-Tab: Projects */}
            <TabsContent value='projects' className='space-y-4 pt-4'>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/50'>
                <div>
                  <h2 className='text-base font-semibold text-foreground'>
                    Projects & Portfolio Work
                  </h2>
                  <p className='text-xs text-muted-foreground'>
                    Key technical projects, system architectures, and implementations.
                  </p>
                </div>
                <Button
                  size='sm'
                  onClick={() => handleOpenAdd('project')}
                  className='gap-1.5 shrink-0'
                >
                  <Icons.add className='h-4 w-4' /> Add Project
                </Button>
              </div>

              {approvedProjects.length === 0 ? (
                <Card className='border-dashed'>
                  <CardContent className='flex flex-col items-center justify-center py-10 text-center space-y-3'>
                    <div className='rounded-full bg-muted p-3 text-muted-foreground'>
                      <Icons.code className='h-6 w-6' />
                    </div>
                    <div className='space-y-1'>
                      <h3 className='font-semibold text-sm'>No projects added yet</h3>
                      <p className='text-xs text-muted-foreground max-w-sm'>
                        Showcase personal projects, open-source work, and key engineering systems
                        you built.
                      </p>
                    </div>
                    <Button size='sm' onClick={() => handleOpenAdd('project')} className='gap-1.5'>
                      <Icons.add className='h-3.5 w-3.5' /> Add Project
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className='space-y-4'>
                  {approvedProjects.map((proj) => {
                    const content = proj.content as ProjectKnowledgeContent;
                    return (
                      <Card key={proj.id} className='border-border/70 shadow-xs'>
                        <CardHeader className='pb-2'>
                          <div className='flex items-start justify-between gap-3'>
                            <div>
                              <CardTitle className='text-base'>{content.name}</CardTitle>
                              <CardDescription>{content.description}</CardDescription>
                            </div>
                            <div className='flex items-center gap-2'>
                              <Button
                                size='sm'
                                variant='ghost'
                                onClick={() => handleOpenEdit(proj)}
                                className='h-7 px-2 text-xs gap-1'
                                title='Edit Project'
                              >
                                <Icons.edit className='h-3.5 w-3.5' /> Edit
                              </Button>
                              <Button
                                size='sm'
                                variant='ghost'
                                onClick={() => handleDeleteKnowledgeItem(proj.id, content.name)}
                                className='h-7 px-2 text-xs text-destructive hover:text-destructive gap-1'
                                title='Delete Project'
                              >
                                <Icons.trash className='h-3.5 w-3.5' />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className='space-y-2 text-xs text-muted-foreground'>
                          {content.technologies && content.technologies.length > 0 && (
                            <div className='flex flex-wrap gap-1.5'>
                              {content.technologies.map((t) => (
                                <Badge key={t} variant='outline' className='text-[10px]'>
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {content.contributions && (
                            <p>
                              <span className='font-semibold text-foreground'>Contributions: </span>
                              {content.contributions}
                            </p>
                          )}
                          {content.outcomes && (
                            <p>
                              <span className='font-semibold text-foreground'>Outcomes: </span>
                              {content.outcomes}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Tab 2: Candidate Knowledge Bank (Canonical Store) */}
        <TabsContent value='knowledge' className='pt-2'>
          <KnowledgeBankWorkspace candidateId={activeCandidateId} />
        </TabsContent>

        {/* Tab 3: Formatted Master Resume Preview */}
        <TabsContent value='resume' className='pt-2'>
          <Card className='max-w-4xl mx-auto border-border shadow-xs'>
            <CardContent className='p-8 space-y-6 text-foreground font-sans'>
              {approvedExperiences.length === 0 &&
              approvedEducation.length === 0 &&
              approvedSkills.length === 0 ? (
                <div className='py-12 text-center space-y-3'>
                  <Icons.page className='mx-auto h-10 w-10 text-muted-foreground/40' />
                  <h3 className='text-base font-semibold text-foreground'>
                    No Master Resume Content Yet
                  </h3>
                  <p className='text-xs text-muted-foreground max-w-sm mx-auto'>
                    Add your experience, skills, or ingest a resume into the Knowledge Bank to
                    automatically compile your Master Resume.
                  </p>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => setActiveTab('profile')}
                    className='gap-1.5 mt-2'
                  >
                    <Icons.user className='h-3.5 w-3.5' /> Edit Profile & Identity
                  </Button>
                </div>
              ) : (
                <>
                  <div className='border-b border-border/80 pb-4 text-center space-y-1.5'>
                    <h2 className='text-2xl font-bold tracking-tight'>{name || profile.name}</h2>
                    <div className='flex items-center justify-center gap-3 text-xs text-muted-foreground'>
                      <span>{profile.email}</span>
                      {phone && <span>• {phone}</span>}
                      {location && <span>• {location}</span>}
                    </div>
                    {targetRoles && (
                      <div className='pt-1 text-xs font-medium text-primary'>
                        Targeting: {targetRoles}
                      </div>
                    )}
                  </div>

                  {summary && (
                    <div className='space-y-2'>
                      <h3 className='text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-1'>
                        Professional Summary
                      </h3>
                      <p className='text-xs leading-relaxed text-foreground/90'>{summary}</p>
                    </div>
                  )}

                  {approvedExperiences.length > 0 && (
                    <div className='space-y-3'>
                      <h3 className='text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-1'>
                        Work Experience
                      </h3>
                      {approvedExperiences.map((exp) => {
                        const content = exp.content as ExperienceKnowledgeContent;
                        return (
                          <div key={exp.id} className='space-y-1 text-xs'>
                            <div className='flex justify-between font-semibold'>
                              <span>
                                {content.role} — {content.employer}
                              </span>
                              <span className='text-muted-foreground'>
                                {content.startDate} –{' '}
                                {content.isCurrent ? 'Present' : content.endDate}
                              </span>
                            </div>
                            {content.responsibilities && (
                              <ul className='list-disc pl-4 space-y-0.5 text-muted-foreground'>
                                {content.responsibilities.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {approvedEducation.length > 0 && (
                    <div className='space-y-3'>
                      <h3 className='text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-1'>
                        Education
                      </h3>
                      {approvedEducation.map((edu) => {
                        const content = edu.content as EducationKnowledgeContent;
                        return (
                          <div key={edu.id} className='flex justify-between text-xs'>
                            <div>
                              <p className='font-semibold'>
                                {content.degree} in {content.fieldOfStudy}
                              </p>
                              <p className='text-muted-foreground'>{content.institution}</p>
                            </div>
                            <span className='text-muted-foreground'>
                              {content.startDate} – {content.endDate || 'Present'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(technicalSkills.length > 0 ||
                    toolSkills.length > 0 ||
                    softSkills.length > 0) && (
                    <div className='space-y-2'>
                      <h3 className='text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-1'>
                        Core Skills
                      </h3>
                      <div className='text-xs space-y-1 text-muted-foreground'>
                        {technicalSkills.length > 0 && (
                          <p>
                            <span className='font-semibold text-foreground'>Technical:</span>{' '}
                            {technicalSkills
                              .map((s) => (s.content as SkillKnowledgeContent).name)
                              .join(', ')}
                          </p>
                        )}
                        {toolSkills.length > 0 && (
                          <p>
                            <span className='font-semibold text-foreground'>Tools & Cloud:</span>{' '}
                            {toolSkills
                              .map((s) => (s.content as SkillKnowledgeContent).name)
                              .join(', ')}
                          </p>
                        )}
                        {softSkills.length > 0 && (
                          <p>
                            <span className='font-semibold text-foreground'>Soft Skills:</span>{' '}
                            {softSkills
                              .map((s) => (s.content as SkillKnowledgeContent).name)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Centralized Knowledge Item Dialog */}
      <KnowledgeItemDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingItem(null);
            setDialogSkillCategory(undefined);
          }
        }}
        editingItem={editingItem}
        defaultCategory={dialogCategory}
        defaultSkillCategory={dialogSkillCategory}
        onSave={handleSaveKnowledgeItem}
        isSaving={addKnowledgeMutation.isPending || updateKnowledgeMutation.isPending}
      />

      {/* Real Local Device Resume Upload Dialog */}
      <ResumeUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        candidateId={profile.id}
      />
    </div>
  );
}
