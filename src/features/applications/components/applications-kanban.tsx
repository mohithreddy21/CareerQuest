'use client';

import { useMemo, useState } from 'react';
import {
  Kanban,
  KanbanBoard as KanbanBoardPrimitive,
  KanbanColumn,
  KanbanItem,
  KanbanOverlay
} from '@/components/ui/kanban';
import { Badge } from '@/components/ui/badge';
import { ApplicationWithJob } from '../api/types';
import { APPLICATION_STAGES, APPLICATION_STATUS_LABELS, ApplicationStatus } from '@/types/domain';
import { ApplicationCard } from './application-card';
import { useMutation } from '@tanstack/react-query';
import { updateApplicationStatusMutation } from '../api/mutations';
import { toast } from 'sonner';

export function ApplicationsKanban({ applications }: { applications: ApplicationWithJob[] }) {
  const statusMutation = useMutation({
    ...updateApplicationStatusMutation,
    onSuccess: (_, variables) => {
      toast.success(`Application moved to ${APPLICATION_STATUS_LABELS[variables.status]}.`);
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to move application';
      toast.error(msg);
    }
  });

  // Group applications into stages
  const initialColumns = useMemo(() => {
    const cols: Record<ApplicationStatus, ApplicationWithJob[]> = {
      discovered: [],
      interested: [],
      preparing: [],
      applied: [],
      interview: [],
      offer: [],
      rejected: [],
      withdrawn: []
    };
    applications.forEach((app) => {
      if (cols[app.status]) {
        cols[app.status].push(app);
      } else {
        cols.discovered.push(app);
      }
    });
    return cols;
  }, [applications]);

  const [columns, setColumns] = useState(initialColumns);
  const [prevApplications, setPrevApplications] = useState(applications);

  if (applications !== prevApplications) {
    setPrevApplications(applications);
    setColumns(initialColumns);
  }

  const handleValueChange = (newColumns: Record<ApplicationStatus, ApplicationWithJob[]>) => {
    // Detect which item changed column
    for (const [colStatus, items] of Object.entries(newColumns) as [
      ApplicationStatus,
      ApplicationWithJob[]
    ][]) {
      for (const item of items) {
        if (item.status !== colStatus) {
          // Status changed!
          item.status = colStatus;
          statusMutation.mutate({
            id: item.id,
            status: colStatus,
            note: `Dragged to ${APPLICATION_STATUS_LABELS[colStatus]}`
          });
          break;
        }
      }
    }
    setColumns(newColumns);
  };

  return (
    <div className='w-full'>
      <Kanban
        value={columns}
        onValueChange={handleValueChange}
        getItemValue={(item) => item.id}
        autoScroll={false}
      >
        <div className='w-full overflow-x-auto pb-4'>
          <KanbanBoardPrimitive className='flex flex-col items-start gap-4 md:flex-row min-w-max'>
            {APPLICATION_STAGES.map((stage) => {
              const items = columns[stage] || [];
              return (
                <KanbanColumn
                  key={stage}
                  value={stage}
                  className='w-full shrink-0 md:w-[280px] bg-muted/40 rounded-xl p-3 border border-border/60'
                >
                  <div className='flex items-center justify-between pb-3'>
                    <div className='flex items-center gap-2'>
                      <span className='text-xs font-semibold uppercase tracking-wider text-foreground'>
                        {APPLICATION_STATUS_LABELS[stage]}
                      </span>
                      <Badge variant='secondary' className='h-5 px-1.5 text-[10px]'>
                        {items.length}
                      </Badge>
                    </div>
                  </div>

                  <div className='flex flex-col gap-2.5 min-h-[140px]'>
                    {items.length === 0 ? (
                      <div className='flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 p-4 text-center'>
                        <span className='text-[11px] text-muted-foreground'>No applications</span>
                      </div>
                    ) : (
                      items.map((app) => (
                        <KanbanItem key={app.id} value={app.id} asHandle>
                          <ApplicationCard application={app} />
                        </KanbanItem>
                      ))
                    )}
                  </div>
                </KanbanColumn>
              );
            })}
          </KanbanBoardPrimitive>
        </div>

        <KanbanOverlay>
          {({ value }) => {
            const allApps = Object.values(columns).flat();
            const app = allApps.find((a) => a.id === value);
            if (!app) return null;
            return <ApplicationCard application={app} isDragOverlay />;
          }}
        </KanbanOverlay>
      </Kanban>
    </div>
  );
}
