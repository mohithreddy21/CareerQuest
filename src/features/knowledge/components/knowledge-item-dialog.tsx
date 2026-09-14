'use client';

import React, { useState } from 'react';
import {
  KnowledgeCategory,
  KnowledgeItem,
  SkillKnowledgeContent,
  ExperienceKnowledgeContent,
  ProjectKnowledgeContent,
  EducationKnowledgeContent,
  CertificationKnowledgeContent,
  AchievementKnowledgeContent
} from '@/types/knowledge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export interface KnowledgeItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: KnowledgeItem | null;
  defaultCategory?: KnowledgeCategory;
  onSave: (category: KnowledgeCategory, content: Record<string, unknown>, itemId?: string) => void;
  isSaving?: boolean;
}

interface InnerFormProps {
  editingItem?: KnowledgeItem | null;
  defaultCategory: KnowledgeCategory;
  onSave: (category: KnowledgeCategory, content: Record<string, unknown>, itemId?: string) => void;
  onClose: () => void;
  isSaving: boolean;
}

function KnowledgeItemForm({
  editingItem,
  defaultCategory,
  onSave,
  onClose,
  isSaving
}: InnerFormProps) {
  const initialCategory = editingItem?.category || defaultCategory;
  const [category, setCategory] = useState<KnowledgeCategory>(initialCategory);

  // Skill state
  const skillContent =
    editingItem?.category === 'skill' ? (editingItem.content as SkillKnowledgeContent) : null;
  const [skillName, setSkillName] = useState(skillContent?.name || '');
  const [skillCategory, setSkillCategory] = useState<'technical' | 'tools' | 'soft' | 'other'>(
    skillContent?.category || 'technical'
  );
  const [skillYears, setSkillYears] = useState(skillContent?.yearsOfExperience?.toString() || '');
  const [skillProficiency, setSkillProficiency] = useState<
    'beginner' | 'intermediate' | 'advanced' | 'expert'
  >(skillContent?.proficiency || 'advanced');

  // Experience state
  const expContent =
    editingItem?.category === 'experience'
      ? (editingItem.content as ExperienceKnowledgeContent)
      : null;
  const [expEmployer, setExpEmployer] = useState(expContent?.employer || '');
  const [expRole, setExpRole] = useState(expContent?.role || '');
  const [expLocation, setExpLocation] = useState(expContent?.location || '');
  const [expStartDate, setExpStartDate] = useState(expContent?.startDate || '');
  const [expEndDate, setExpEndDate] = useState(expContent?.endDate || '');
  const [expResponsibilities, setExpResponsibilities] = useState(
    expContent?.responsibilities?.join('\n') || ''
  );

  // Project state
  const projContent =
    editingItem?.category === 'project' ? (editingItem.content as ProjectKnowledgeContent) : null;
  const [projName, setProjName] = useState(projContent?.name || '');
  const [projDesc, setProjDesc] = useState(projContent?.description || '');
  const [projTech, setProjTech] = useState(projContent?.technologies?.join(', ') || '');

  // Education state
  const eduContent =
    editingItem?.category === 'education'
      ? (editingItem.content as EducationKnowledgeContent)
      : null;
  const [eduInstitution, setEduInstitution] = useState(eduContent?.institution || '');
  const [eduDegree, setEduDegree] = useState(eduContent?.degree || '');
  const [eduField, setEduField] = useState(eduContent?.fieldOfStudy || '');

  // Certification state
  const certContent =
    editingItem?.category === 'certification'
      ? (editingItem.content as CertificationKnowledgeContent)
      : null;
  const [certName, setCertName] = useState(certContent?.name || '');
  const [certIssuer, setCertIssuer] = useState(certContent?.issuer || '');
  const [certDate, setCertDate] = useState(certContent?.issueDate || '');
  const [certId, setCertId] = useState(certContent?.credentialId || '');

  // Achievement state
  const achContent =
    editingItem?.category === 'achievement'
      ? (editingItem.content as AchievementKnowledgeContent)
      : null;
  const [achTitle, setAchTitle] = useState(achContent?.title || '');
  const [achDesc, setAchDesc] = useState(achContent?.description || '');
  const [achMetric, setAchMetric] = useState(achContent?.metric || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let content: Record<string, unknown> = {};

    if (category === 'skill') {
      content = {
        name: skillName.trim(),
        category: skillCategory,
        proficiency: skillProficiency,
        yearsOfExperience: skillYears ? parseInt(skillYears, 10) : undefined
      };
    } else if (category === 'experience') {
      content = {
        employer: expEmployer.trim(),
        role: expRole.trim(),
        location: expLocation.trim(),
        startDate: expStartDate.trim(),
        endDate: expEndDate.trim() || undefined,
        isCurrent: !expEndDate.trim(),
        responsibilities: expResponsibilities
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        achievements: []
      };
    } else if (category === 'project') {
      content = {
        name: projName.trim(),
        description: projDesc.trim(),
        technologies: projTech
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        contributions: ''
      };
    } else if (category === 'education') {
      content = {
        institution: eduInstitution.trim(),
        degree: eduDegree.trim(),
        fieldOfStudy: eduField.trim()
      };
    } else if (category === 'certification') {
      content = {
        name: certName.trim(),
        issuer: certIssuer.trim(),
        issueDate: certDate.trim(),
        credentialId: certId.trim() || undefined
      };
    } else if (category === 'achievement') {
      content = {
        title: achTitle.trim(),
        description: achDesc.trim(),
        metric: achMetric.trim() || undefined
      };
    }

    onSave(category, content, editingItem?.id);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <DialogHeader>
        <DialogTitle>{editingItem ? 'Edit Knowledge Item' : 'Add New Knowledge Asset'}</DialogTitle>
        <DialogDescription className='text-xs'>
          Add verified career facts to your canonical Knowledge Bank.
        </DialogDescription>
      </DialogHeader>

      {/* Category Selector (only disabled if editing) */}
      <div className='space-y-1.5'>
        <Label className='text-xs'>Asset Category</Label>
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as KnowledgeCategory)}
          disabled={Boolean(editingItem)}
        >
          <SelectTrigger className='text-xs'>
            <SelectValue placeholder='Select category' />
          </SelectTrigger>
          <SelectContent className='text-xs'>
            <SelectItem value='skill'>Skill</SelectItem>
            <SelectItem value='experience'>Experience</SelectItem>
            <SelectItem value='project'>Project</SelectItem>
            <SelectItem value='education'>Education</SelectItem>
            <SelectItem value='certification'>Certification</SelectItem>
            <SelectItem value='achievement'>Achievement</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Form Fields according to Category */}
      {category === 'skill' && (
        <div className='space-y-3 pt-1'>
          <div className='space-y-1'>
            <Label htmlFor='skill-name' className='text-xs'>
              Skill Name *
            </Label>
            <Input
              id='skill-name'
              required
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              placeholder='e.g. TypeScript, Redis, GraphQL'
              className='text-xs'
            />
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <div className='space-y-1'>
              <Label className='text-xs'>Category</Label>
              <Select
                value={skillCategory}
                onValueChange={(v) =>
                  setSkillCategory(v as 'technical' | 'tools' | 'soft' | 'other')
                }
              >
                <SelectTrigger className='text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className='text-xs'>
                  <SelectItem value='technical'>Technical</SelectItem>
                  <SelectItem value='tools'>Tools & Cloud</SelectItem>
                  <SelectItem value='soft'>Soft Skills</SelectItem>
                  <SelectItem value='other'>Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Proficiency</Label>
              <Select
                value={skillProficiency}
                onValueChange={(v) =>
                  setSkillProficiency(v as 'beginner' | 'intermediate' | 'advanced' | 'expert')
                }
              >
                <SelectTrigger className='text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className='text-xs'>
                  <SelectItem value='beginner'>Beginner</SelectItem>
                  <SelectItem value='intermediate'>Intermediate</SelectItem>
                  <SelectItem value='advanced'>Advanced</SelectItem>
                  <SelectItem value='expert'>Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='skill-years' className='text-xs'>
              Years of Experience (Optional)
            </Label>
            <Input
              id='skill-years'
              type='number'
              min='0'
              max='50'
              value={skillYears}
              onChange={(e) => setSkillYears(e.target.value)}
              placeholder='e.g. 5'
              className='text-xs'
            />
          </div>
        </div>
      )}

      {category === 'experience' && (
        <div className='space-y-3 pt-1'>
          <div className='grid grid-cols-2 gap-2'>
            <div className='space-y-1'>
              <Label htmlFor='exp-role' className='text-xs'>
                Role / Title *
              </Label>
              <Input
                id='exp-role'
                required
                value={expRole}
                onChange={(e) => setExpRole(e.target.value)}
                placeholder='Senior Full-Stack Engineer'
                className='text-xs'
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='exp-employer' className='text-xs'>
                Employer / Company *
              </Label>
              <Input
                id='exp-employer'
                required
                value={expEmployer}
                onChange={(e) => setExpEmployer(e.target.value)}
                placeholder='Veloce Labs'
                className='text-xs'
              />
            </div>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='exp-loc' className='text-xs'>
              Location
            </Label>
            <Input
              id='exp-loc'
              value={expLocation}
              onChange={(e) => setExpLocation(e.target.value)}
              placeholder='San Francisco, CA (Hybrid)'
              className='text-xs'
            />
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <div className='space-y-1'>
              <Label htmlFor='exp-start' className='text-xs'>
                Start Date (YYYY-MM) *
              </Label>
              <Input
                id='exp-start'
                required
                value={expStartDate}
                onChange={(e) => setExpStartDate(e.target.value)}
                placeholder='2022-03'
                className='text-xs'
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='exp-end' className='text-xs'>
                End Date (Leave blank for current)
              </Label>
              <Input
                id='exp-end'
                value={expEndDate}
                onChange={(e) => setExpEndDate(e.target.value)}
                placeholder='Present'
                className='text-xs'
              />
            </div>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='exp-resp' className='text-xs'>
              Responsibilities (one per line)
            </Label>
            <Textarea
              id='exp-resp'
              rows={3}
              value={expResponsibilities}
              onChange={(e) => setExpResponsibilities(e.target.value)}
              placeholder='Led architecture of core workspace dashboard...'
              className='text-xs leading-relaxed'
            />
          </div>
        </div>
      )}

      {category === 'project' && (
        <div className='space-y-3 pt-1'>
          <div className='space-y-1'>
            <Label htmlFor='proj-name' className='text-xs'>
              Project Name *
            </Label>
            <Input
              id='proj-name'
              required
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              placeholder='OpenMetric Dashboard'
              className='text-xs'
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='proj-desc' className='text-xs'>
              Description *
            </Label>
            <Textarea
              id='proj-desc'
              required
              rows={2}
              value={projDesc}
              onChange={(e) => setProjDesc(e.target.value)}
              placeholder='Open-source telemetry ingestion engine...'
              className='text-xs leading-relaxed'
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='proj-tech' className='text-xs'>
              Technologies (Comma-separated)
            </Label>
            <Input
              id='proj-tech'
              value={projTech}
              onChange={(e) => setProjTech(e.target.value)}
              placeholder='Next.js, TypeScript, Tailwind CSS'
              className='text-xs'
            />
          </div>
        </div>
      )}

      {category === 'education' && (
        <div className='space-y-3 pt-1'>
          <div className='space-y-1'>
            <Label htmlFor='edu-inst' className='text-xs'>
              Institution *
            </Label>
            <Input
              id='edu-inst'
              required
              value={eduInstitution}
              onChange={(e) => setEduInstitution(e.target.value)}
              placeholder='University of California, Berkeley'
              className='text-xs'
            />
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <div className='space-y-1'>
              <Label htmlFor='edu-degree' className='text-xs'>
                Degree *
              </Label>
              <Input
                id='edu-degree'
                required
                value={eduDegree}
                onChange={(e) => setEduDegree(e.target.value)}
                placeholder='Bachelor of Science'
                className='text-xs'
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='edu-field' className='text-xs'>
                Field of Study *
              </Label>
              <Input
                id='edu-field'
                required
                value={eduField}
                onChange={(e) => setEduField(e.target.value)}
                placeholder='Computer Science'
                className='text-xs'
              />
            </div>
          </div>
        </div>
      )}

      {category === 'certification' && (
        <div className='space-y-3 pt-1'>
          <div className='space-y-1'>
            <Label htmlFor='cert-name' className='text-xs'>
              Certification Name *
            </Label>
            <Input
              id='cert-name'
              required
              value={certName}
              onChange={(e) => setCertName(e.target.value)}
              placeholder='AWS Certified Solutions Architect'
              className='text-xs'
            />
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <div className='space-y-1'>
              <Label htmlFor='cert-issuer' className='text-xs'>
                Issuer *
              </Label>
              <Input
                id='cert-issuer'
                required
                value={certIssuer}
                onChange={(e) => setCertIssuer(e.target.value)}
                placeholder='Amazon Web Services'
                className='text-xs'
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='cert-date' className='text-xs'>
                Issue Date *
              </Label>
              <Input
                id='cert-date'
                required
                value={certDate}
                onChange={(e) => setCertDate(e.target.value)}
                placeholder='2023-04'
                className='text-xs'
              />
            </div>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='cert-id' className='text-xs'>
              Credential ID (Optional)
            </Label>
            <Input
              id='cert-id'
              value={certId}
              onChange={(e) => setCertId(e.target.value)}
              placeholder='AWS-PSA-994821'
              className='text-xs'
            />
          </div>
        </div>
      )}

      {category === 'achievement' && (
        <div className='space-y-3 pt-1'>
          <div className='space-y-1'>
            <Label htmlFor='ach-title' className='text-xs'>
              Achievement Title *
            </Label>
            <Input
              id='ach-title'
              required
              value={achTitle}
              onChange={(e) => setAchTitle(e.target.value)}
              placeholder='Latency & Performance Optimization'
              className='text-xs'
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='ach-desc' className='text-xs'>
              Description *
            </Label>
            <Textarea
              id='ach-desc'
              required
              rows={2}
              value={achDesc}
              onChange={(e) => setAchDesc(e.target.value)}
              placeholder='Reduced p95 page load times from 2.4s to 420ms...'
              className='text-xs leading-relaxed'
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='ach-metric' className='text-xs'>
              Metric / Highlight (Optional)
            </Label>
            <Input
              id='ach-metric'
              value={achMetric}
              onChange={(e) => setAchMetric(e.target.value)}
              placeholder='p95 2.4s → 420ms (-82%)'
              className='text-xs'
            />
          </div>
        </div>
      )}

      <DialogFooter className='pt-2'>
        <Button type='button' variant='outline' size='sm' onClick={onClose}>
          Cancel
        </Button>
        <Button type='submit' size='sm' disabled={isSaving}>
          {editingItem ? 'Save Updates' : 'Add to Knowledge Bank'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function KnowledgeItemDialog({
  open,
  onOpenChange,
  editingItem,
  defaultCategory = 'skill',
  onSave,
  isSaving = false
}: KnowledgeItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        {open && (
          <KnowledgeItemForm
            key={editingItem?.id || `new-${defaultCategory}`}
            editingItem={editingItem}
            defaultCategory={defaultCategory}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
            isSaving={isSaving}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
