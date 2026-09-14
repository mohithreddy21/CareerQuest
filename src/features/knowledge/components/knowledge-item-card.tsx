'use client';

import {
  KnowledgeItem,
  KnowledgeStatus,
  SkillKnowledgeContent,
  ExperienceKnowledgeContent,
  ProjectKnowledgeContent,
  EducationKnowledgeContent,
  CertificationKnowledgeContent,
  AchievementKnowledgeContent
} from '@/types/domain';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { ProvenancePopover } from './provenance-popover';
import { cn } from '@/lib/utils';

export interface KnowledgeItemCardProps {
  item: KnowledgeItem;
  onEdit: (item: KnowledgeItem) => void;
  onStatusChange: (id: string, status: KnowledgeStatus) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export function KnowledgeItemCard({
  item,
  onEdit,
  onStatusChange,
  onDelete,
  className
}: KnowledgeItemCardProps) {
  const isArchived = item.status === 'archived';

  const getTitle = () => {
    switch (item.category) {
      case 'skill':
        return (item.content as SkillKnowledgeContent).name;
      case 'experience':
        return `${(item.content as ExperienceKnowledgeContent).role} at ${(item.content as ExperienceKnowledgeContent).employer}`;
      case 'project':
        return (item.content as ProjectKnowledgeContent).name;
      case 'education':
        return `${(item.content as EducationKnowledgeContent).degree} — ${(item.content as EducationKnowledgeContent).institution}`;
      case 'certification':
        return (item.content as CertificationKnowledgeContent).name;
      case 'achievement':
        return (item.content as AchievementKnowledgeContent).title;
      default:
        return 'Knowledge Item';
    }
  };

  return (
    <Card
      className={cn(
        'border-border/70 shadow-xs transition-all hover:border-primary/40',
        isArchived && 'opacity-60 bg-muted/20 border-dashed',
        className
      )}
    >
      <CardContent className='p-4 space-y-3'>
        {/* Card Header: Category, Title, Status & Actions */}
        <div className='flex items-start justify-between gap-2'>
          <div className='space-y-1 flex-1 min-w-0'>
            <div className='flex flex-wrap items-center gap-1.5'>
              <Badge variant='outline' className='text-[10px] capitalize font-semibold px-1.5 py-0'>
                {item.category}
              </Badge>
              {item.status === 'approved' && (
                <span className='inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400'>
                  <Icons.circleCheck className='h-3 w-3' /> Verified
                </span>
              )}
              {isArchived && (
                <Badge variant='secondary' className='text-[10px] text-muted-foreground'>
                  Archived
                </Badge>
              )}
            </div>
            <h3 className='text-sm font-semibold text-foreground tracking-tight truncate'>
              {getTitle()}
            </h3>
          </div>

          <div className='flex items-center gap-1 shrink-0'>
            <ProvenancePopover provenance={item.provenance} itemTitle={getTitle()} />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant='ghost' size='sm' className='h-7 w-7 p-0'>
                    <Icons.ellipsis className='h-4 w-4 text-muted-foreground' />
                  </Button>
                }
              />
              <DropdownMenuContent align='end' className='text-xs'>
                <DropdownMenuItem onClick={() => onEdit(item)}>
                  <Icons.edit className='mr-1.5 h-3.5 w-3.5' /> Edit Details
                </DropdownMenuItem>
                {isArchived ? (
                  <DropdownMenuItem onClick={() => onStatusChange(item.id, 'approved')}>
                    <Icons.refresh className='mr-1.5 h-3.5 w-3.5 text-emerald-600' /> Reactivate
                    Asset
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onStatusChange(item.id, 'archived')}>
                    <Icons.eyeOff className='mr-1.5 h-3.5 w-3.5 text-amber-600' /> Archive
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => onDelete(item.id)}
                  className='text-rose-600 dark:text-rose-400'
                >
                  <Icons.trash className='mr-1.5 h-3.5 w-3.5' /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content Details based on Category */}
        <div className='text-xs text-muted-foreground space-y-2 pt-1'>
          {item.category === 'skill' && (
            <SkillContentDetails content={item.content as SkillKnowledgeContent} />
          )}
          {item.category === 'experience' && (
            <ExperienceContentDetails content={item.content as ExperienceKnowledgeContent} />
          )}
          {item.category === 'project' && (
            <ProjectContentDetails content={item.content as ProjectKnowledgeContent} />
          )}
          {item.category === 'education' && (
            <EducationContentDetails content={item.content as EducationKnowledgeContent} />
          )}
          {item.category === 'certification' && (
            <CertificationContentDetails content={item.content as CertificationKnowledgeContent} />
          )}
          {item.category === 'achievement' && (
            <AchievementContentDetails content={item.content as AchievementKnowledgeContent} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SkillContentDetails({ content }: { content: SkillKnowledgeContent }) {
  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Badge variant='secondary' className='text-[10px] capitalize font-medium'>
        Type: {content.category}
      </Badge>
      {content.proficiency && (
        <span className='text-[11px] text-foreground/80 font-medium capitalize'>
          Level: {content.proficiency}
        </span>
      )}
      {content.yearsOfExperience && (
        <span className='text-[11px] text-muted-foreground'>
          • {content.yearsOfExperience} yrs exp
        </span>
      )}
    </div>
  );
}

function ExperienceContentDetails({ content }: { content: ExperienceKnowledgeContent }) {
  return (
    <div className='space-y-1.5'>
      <div className='flex flex-wrap items-center justify-between text-[11px] font-medium text-foreground/80'>
        <span>{content.location || 'Location Not Specified'}</span>
        <span>
          {content.startDate} – {content.isCurrent ? 'Present' : content.endDate}
        </span>
      </div>
      {content.responsibilities.length > 0 && (
        <ul className='list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground leading-relaxed'>
          {content.responsibilities.slice(0, 2).map((r, i) => (
            <li key={i} className='line-clamp-2'>
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectContentDetails({ content }: { content: ProjectKnowledgeContent }) {
  return (
    <div className='space-y-1.5'>
      <p className='line-clamp-2 text-[11px] leading-relaxed'>{content.description}</p>
      <div className='flex flex-wrap gap-1 pt-1'>
        {content.technologies.slice(0, 4).map((tech) => (
          <Badge key={tech} variant='secondary' className='text-[9px] px-1.5 py-0'>
            {tech}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function EducationContentDetails({ content }: { content: EducationKnowledgeContent }) {
  return (
    <div className='space-y-1 text-[11px]'>
      <p className='font-medium text-foreground/80'>Field: {content.fieldOfStudy}</p>
      <p className='text-muted-foreground'>
        {content.startDate} – {content.endDate || 'Graduated'}
      </p>
      {content.details && <p className='italic text-[10px] line-clamp-1'>{content.details}</p>}
    </div>
  );
}

function CertificationContentDetails({ content }: { content: CertificationKnowledgeContent }) {
  return (
    <div className='space-y-1 text-[11px]'>
      <p className='font-medium text-foreground/80'>
        Issued by {content.issuer} • {content.issueDate}
      </p>
      {content.credentialId && (
        <p className='text-[10px] font-mono text-muted-foreground'>ID: {content.credentialId}</p>
      )}
    </div>
  );
}

function AchievementContentDetails({ content }: { content: AchievementKnowledgeContent }) {
  return (
    <div className='space-y-1.5'>
      {content.metric && (
        <Badge
          variant='outline'
          className='text-[10px] font-semibold border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'
        >
          {content.metric}
        </Badge>
      )}
      <p className='text-[11px] leading-relaxed text-foreground/90'>{content.description}</p>
      {content.sourceContext && (
        <p className='text-[10px] text-muted-foreground'>Context: {content.sourceContext}</p>
      )}
    </div>
  );
}
