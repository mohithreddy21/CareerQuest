'use client';

import { ApplicationWithJob } from '../api/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { APPLICATION_STAGES, APPLICATION_STATUS_LABELS, ApplicationStatus } from '@/types/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateApplicationStatusMutation,
  updateApplicationArchiveMutation
} from '../api/mutations';
import { applicationKeys } from '../api/queries';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

export function ApplicationCard({
  application,
  isDragOverlay = false
}: {
  application: ApplicationWithJob;
  isDragOverlay?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    ...updateApplicationStatusMutation,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      toast.success(`Application moved to ${APPLICATION_STATUS_LABELS[variables.status]}.`);
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to move application';
      toast.error(msg);
    }
  });

  const archiveMutation = useMutation({
    ...updateApplicationArchiveMutation,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      toast.success(
        variables.isArchived
          ? 'Application archived and hidden from active views.'
          : 'Application unarchived and restored to active views.'
      );
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to update archive status';
      toast.error(msg);
    }
  });

  const handleStatusChange = (status: ApplicationStatus) => {
    if (status === application.status) return;
    statusMutation.mutate({
      id: application.id,
      status,
      note: `Moved to ${APPLICATION_STATUS_LABELS[status]}`
    });
  };

  return (
    <Card
      className={`group relative border-border/70 bg-card transition-all hover:border-primary/40 hover:shadow-xs ${
        isDragOverlay ? 'rotate-1 shadow-lg ring-2 ring-primary/40' : ''
      }`}
    >
      <CardContent className='p-3.5 space-y-2.5'>
        <div className='flex items-start justify-between gap-2'>
          <div className='space-y-0.5'>
            <Link
              href={`/dashboard/applications/${application.id}`}
              className='font-semibold text-sm text-foreground hover:text-primary transition-colors line-clamp-1'
              onPointerDown={(e) => e.stopPropagation()}
            >
              {application.job.title}
            </Link>
            <p className='text-xs font-medium text-muted-foreground'>{application.job.company}</p>
          </div>

          {/* Accessible non-drag status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7 w-7 p-0 text-muted-foreground hover:text-foreground'
                  aria-label={`Change status for ${application.job.title}`}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Icons.ellipsis className='h-4 w-4' />
                </Button>
              }
            />
            <DropdownMenuContent align='end' className='w-48'>
              <DropdownMenuLabel className='text-xs'>Move to Stage</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {APPLICATION_STAGES.map((st) => (
                <DropdownMenuItem
                  key={st}
                  disabled={st === application.status || statusMutation.isPending}
                  onClick={() => handleStatusChange(st)}
                  className='text-xs'
                >
                  <span
                    className={`mr-2 h-2 w-2 rounded-full ${
                      st === application.status ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  />
                  {APPLICATION_STATUS_LABELS[st]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push(`/dashboard/applications/${application.id}`)}
                className='text-xs'
              >
                <Icons.edit className='mr-2 h-3.5 w-3.5' /> Prepare Application
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/dashboard/jobs/${application.job.id}`)}
                className='text-xs'
              >
                <Icons.search className='mr-2 h-3.5 w-3.5' /> View Job Match
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  archiveMutation.mutate({
                    id: application.id,
                    isArchived: !application.isArchived
                  })
                }
                disabled={archiveMutation.isPending}
                className='text-xs text-muted-foreground hover:text-foreground'
              >
                <Icons.archive className='mr-2 h-3.5 w-3.5' />
                {application.isArchived ? 'Unarchive Application' : 'Archive Application'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className='flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground'>
          <span>{application.job.location}</span>
          <span>•</span>
          <span className='capitalize'>{application.job.workArrangement}</span>
          {application.dateApplied && (
            <>
              <span>•</span>
              <span>Applied {application.dateApplied.slice(0, 10)}</span>
            </>
          )}
        </div>

        {application.notes && (
          <p className='text-[11px] text-muted-foreground/80 line-clamp-1 italic'>
            &ldquo;{application.notes}&rdquo;
          </p>
        )}

        {/* Follow-up / Interview / Score Indicators */}
        <div className='flex flex-wrap items-center gap-1.5 pt-0.5'>
          {application.matchScoreAtApplication !== undefined && (
            <Badge
              variant='outline'
              className='text-[10px] font-mono bg-primary/5 text-primary border-primary/20'
            >
              {application.matchScoreAtApplication}% match
            </Badge>
          )}

          {application.followUpDate && application.followUpStatus === 'pending' && (
            <Badge
              variant='outline'
              className={`text-[10px] gap-1 ${
                new Date(application.followUpDate).getTime() <= new Date().setHours(23, 59, 59, 999)
                  ? 'bg-rose-500/10 text-rose-700 border-rose-500/30 font-semibold'
                  : 'bg-blue-500/10 text-blue-700 border-blue-500/20'
              }`}
            >
              <Icons.notification className='h-2.5 w-2.5' />
              {new Date(application.followUpDate).getTime() <= new Date().setHours(23, 59, 59, 999)
                ? 'Follow-up Due'
                : `Follow-up ${application.followUpDate.slice(5)}`}
            </Badge>
          )}

          {application.interviewStages?.some((s) => s.status === 'scheduled') && (
            <Badge
              variant='outline'
              className='text-[10px] gap-1 bg-purple-500/10 text-purple-700 border-purple-500/20'
            >
              <Icons.calendar className='h-2.5 w-2.5' />
              Interview Scheduled
            </Badge>
          )}
        </div>

        <div className='flex items-center justify-between pt-1 border-t border-border/40'>
          <Badge variant='outline' className='text-[10px] font-normal capitalize'>
            {application.job.source}
          </Badge>
          <Link
            href={`/dashboard/applications/${application.id}`}
            className='inline-flex items-center text-[11px] text-muted-foreground hover:text-foreground font-medium'
            onPointerDown={(e) => e.stopPropagation()}
          >
            Details <Icons.chevronRight className='ml-1 h-3 w-3' />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
