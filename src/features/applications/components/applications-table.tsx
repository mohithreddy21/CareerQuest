'use client';

import { ApplicationWithJob } from '../api/types';
import { APPLICATION_STAGES, APPLICATION_STATUS_LABELS, ApplicationStatus } from '@/types/domain';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateApplicationStatusMutation,
  updateApplicationArchiveMutation
} from '../api/mutations';
import { applicationKeys } from '../api/queries';
import Link from 'next/link';
import { toast } from 'sonner';

export function ApplicationsTable({ applications }: { applications: ApplicationWithJob[] }) {
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    ...updateApplicationStatusMutation,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      toast.success(`Status updated to ${APPLICATION_STATUS_LABELS[variables.status]}.`);
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to update status';
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

  return (
    <div className='rounded-xl border border-border/70 overflow-x-auto bg-card shadow-xs'>
      <Table>
        <TableHeader className='bg-muted/40'>
          <TableRow>
            <TableHead className='font-semibold text-xs min-w-[140px]'>Company</TableHead>
            <TableHead className='font-semibold text-xs min-w-[180px]'>Role / Location</TableHead>
            <TableHead className='font-semibold text-xs text-center min-w-[90px]'>
              Match Score
            </TableHead>
            <TableHead className='font-semibold text-xs min-w-[140px]'>Stage / Status</TableHead>
            <TableHead className='font-semibold text-xs min-w-[110px]'>Date Applied</TableHead>
            <TableHead className='font-semibold text-xs min-w-[140px]'>Follow-Up</TableHead>
            <TableHead className='font-semibold text-xs min-w-[90px]'>Source</TableHead>
            <TableHead className='font-semibold text-xs min-w-[110px]'>Last Activity</TableHead>
            <TableHead className='text-right font-semibold text-xs min-w-[90px]'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((app) => {
            const isFollowUpDue =
              app.followUpDate &&
              app.followUpStatus === 'pending' &&
              new Date(app.followUpDate).getTime() <= new Date().setHours(23, 59, 59, 999);

            const lastStatusEntry = app.statusHistory?.[app.statusHistory.length - 1];
            const lastActivityDate = lastStatusEntry?.timestamp
              ? lastStatusEntry.timestamp.slice(0, 10)
              : app.dateDiscovered.slice(0, 10);

            return (
              <TableRow key={app.id} className='hover:bg-muted/30 transition-colors'>
                <TableCell className='font-semibold text-xs text-foreground'>
                  {app.job.company}
                </TableCell>

                <TableCell className='font-medium text-xs'>
                  <Link
                    href={`/dashboard/applications/${app.id}`}
                    className='text-foreground hover:text-primary transition-colors font-semibold'
                  >
                    {app.job.title}
                  </Link>
                  <div className='text-[11px] text-muted-foreground'>
                    {app.job.location} ({app.job.workArrangement})
                  </div>
                </TableCell>

                <TableCell className='text-center'>
                  {app.matchScoreAtApplication !== undefined ? (
                    <Badge
                      variant='outline'
                      className='text-[10px] font-mono bg-primary/5 text-primary border-primary/20'
                    >
                      {app.matchScoreAtApplication}%
                    </Badge>
                  ) : (
                    <span className='text-[11px] text-muted-foreground'>—</span>
                  )}
                </TableCell>

                <TableCell>
                  <Select
                    value={app.status}
                    onValueChange={(val) =>
                      statusMutation.mutate({
                        id: app.id,
                        status: val as ApplicationStatus
                      })
                    }
                    disabled={statusMutation.isPending}
                  >
                    <SelectTrigger className='h-7 w-32 text-xs'>
                      <SelectValue>{APPLICATION_STATUS_LABELS[app.status]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {APPLICATION_STAGES.map((st) => (
                        <SelectItem key={st} value={st} className='text-xs'>
                          {APPLICATION_STATUS_LABELS[st]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                <TableCell className='text-xs text-muted-foreground'>
                  {app.dateApplied ? app.dateApplied.slice(0, 10) : '—'}
                </TableCell>

                <TableCell>
                  {app.followUpDate ? (
                    <div className='flex items-center gap-1.5'>
                      <Badge
                        variant='outline'
                        className={`text-[10px] gap-1 ${
                          isFollowUpDue
                            ? 'bg-rose-500/10 text-rose-700 border-rose-500/30 font-semibold'
                            : app.followUpStatus === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-700 border-blue-500/20'
                        }`}
                      >
                        {isFollowUpDue ? (
                          <>
                            <Icons.warning className='h-2.5 w-2.5' /> Due
                          </>
                        ) : app.followUpStatus === 'completed' ? (
                          <>
                            <Icons.check className='h-2.5 w-2.5' /> Done
                          </>
                        ) : (
                          <>
                            <Icons.notification className='h-2.5 w-2.5' />{' '}
                            {app.followUpDate.slice(5)}
                          </>
                        )}
                      </Badge>
                    </div>
                  ) : (
                    <span className='text-[11px] text-muted-foreground'>None set</span>
                  )}
                </TableCell>

                <TableCell>
                  <Badge variant='outline' className='text-[10px] capitalize font-normal'>
                    {app.job.source}
                  </Badge>
                </TableCell>

                <TableCell className='text-xs text-muted-foreground font-mono'>
                  {lastActivityDate}
                </TableCell>

                <TableCell className='text-right'>
                  <div className='flex items-center justify-end gap-1'>
                    <Link
                      href={`/dashboard/applications/${app.id}`}
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'sm' }),
                        'h-7 px-2 text-xs'
                      )}
                    >
                      Open
                    </Link>
                    <Link
                      href={`/dashboard/jobs/${app.job.id}`}
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'sm' }),
                        'h-7 w-7 p-0 text-muted-foreground'
                      )}
                      title='View Job Match'
                    >
                      <Icons.search className='h-3.5 w-3.5' />
                    </Link>
                    <button
                      type='button'
                      onClick={() =>
                        archiveMutation.mutate({
                          id: app.id,
                          isArchived: !app.isArchived
                        })
                      }
                      disabled={archiveMutation.isPending}
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'sm' }),
                        'h-7 w-7 p-0',
                        app.isArchived
                          ? 'text-amber-600'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      title={app.isArchived ? 'Unarchive Opportunity' : 'Archive Opportunity'}
                      aria-label={app.isArchived ? 'Unarchive Opportunity' : 'Archive Opportunity'}
                    >
                      <Icons.archive className='h-3.5 w-3.5' />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
