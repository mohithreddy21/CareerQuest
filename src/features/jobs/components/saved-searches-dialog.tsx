'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import { savedSearchKeys, savedSearchesQueryOptions } from '../api/queries';
import {
  createSavedSearchAction,
  updateSavedSearchAction,
  toggleSavedSearchAction,
  deleteSavedSearchAction,
  executeSavedSearchAction
} from '../api/saved-search-actions';
import { SavedSearch, SavedSearchExecutionResult } from '@/types/domain';

interface SavedSearchesDialogProps {
  initialFilterPrefill?: {
    query?: string;
    locations?: string[];
    workArrangements?: string[];
    minMatchScore?: number;
  };
  triggerLabel?: string;
  triggerVariant?: 'default' | 'outline' | 'secondary' | 'ghost';
  defaultMode?: 'list' | 'create';
}

export function SavedSearchesDialog({
  initialFilterPrefill,
  triggerLabel = 'Saved Searches',
  triggerVariant = 'outline',
  defaultMode = 'list'
}: SavedSearchesDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'list' | 'create' | 'edit' | 'results'>(defaultMode);
  const [selectedSearch, setSelectedSearch] = useState<SavedSearch | null>(null);
  const [executionResult, setExecutionResult] = useState<SavedSearchExecutionResult | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [locations, setLocations] = useState('');
  const [workArrangements, setWorkArrangements] = useState<string[]>([]);
  const [minMatchScore, setMinMatchScore] = useState<string>('');
  const [minSalary, setMinSalary] = useState<string>('');
  const [alertFrequency, setAlertFrequency] = useState<string>('weekly');
  const [isEnabled, setIsEnabled] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Queries & Mutations
  const { data: savedSearches = [], isLoading } = useQuery({
    ...savedSearchesQueryOptions(),
    enabled: open
  });

  const toggleMutation = useMutation({
    mutationFn: (params: { id: string; isEnabled: boolean }) => toggleSavedSearchAction(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedSearchKeys.all });
      toast.success('Saved search updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to toggle saved search');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSavedSearchAction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedSearchKeys.all });
      toast.success('Saved search deleted');
      setMode('list');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete saved search');
    }
  });

  const executeMutation = useMutation({
    mutationFn: (savedSearchId: string) =>
      executeSavedSearchAction({ savedSearchId, isManual: true }),
    onSuccess: (res) => {
      setExecutionResult(res);
      setMode('results');
      queryClient.invalidateQueries({ queryKey: savedSearchKeys.all });
      toast.success(
        `Found ${res.totalMatchCount ?? res.totalMatching} matching opportunities (${res.newMatchCount ?? res.newAlertCount} new)`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Execution failed');
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const locArray = locations
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);

      const parsedScore = minMatchScore ? parseInt(minMatchScore, 10) : null;
      const parsedSalary = minSalary ? parseInt(minSalary, 10) : null;

      if (mode === 'create') {
        return createSavedSearchAction({
          name: name.trim(),
          query: query.trim() || null,
          locations: locArray,
          workArrangements: workArrangements as ('remote' | 'hybrid' | 'onsite')[],
          roleCategories: [],
          seniorityLevels: [],
          skills: [],
          minSalary: parsedSalary,
          currency: 'USD',
          minMatchScore: parsedScore,
          alertFrequency: alertFrequency as 'instant' | 'daily' | 'weekly' | 'never',
          isEnabled
        });
      } else if (mode === 'edit' && selectedSearch) {
        return updateSavedSearchAction({
          id: selectedSearch.id,
          name: name.trim(),
          query: query.trim() || null,
          locations: locArray,
          workArrangements: workArrangements as ('remote' | 'hybrid' | 'onsite')[],
          minSalary: parsedSalary,
          minMatchScore: parsedScore,
          alertFrequency: alertFrequency as 'instant' | 'daily' | 'weekly' | 'never',
          isEnabled,
          filterVersion: selectedSearch.filterVersion
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedSearchKeys.all });
      toast.success(mode === 'create' ? 'Saved search created' : 'Saved search updated');
      setMode('list');
      resetForm();
    },
    onError: (err: Error) => {
      setFormError(err.message || 'Failed to save search');
    }
  });

  const resetForm = () => {
    setName('');
    setQuery('');
    setLocations('');
    setWorkArrangements([]);
    setMinMatchScore('');
    setMinSalary('');
    setAlertFrequency('weekly');
    setIsEnabled(true);
    setFormError(null);
    setSelectedSearch(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    if (initialFilterPrefill) {
      setQuery(initialFilterPrefill.query || '');
      setLocations((initialFilterPrefill.locations || []).join(', '));
      setWorkArrangements(initialFilterPrefill.workArrangements || []);
      if (initialFilterPrefill.minMatchScore) {
        setMinMatchScore(initialFilterPrefill.minMatchScore.toString());
      }
    }
    setMode('create');
  };

  const handleOpenEdit = (search: SavedSearch) => {
    setSelectedSearch(search);
    setName(search.name);
    setQuery(search.query || '');
    setLocations((search.locations || []).join(', '));
    setWorkArrangements(search.workArrangements || []);
    setMinMatchScore(search.minMatchScore ? search.minMatchScore.toString() : '');
    setMinSalary(search.minSalary ? search.minSalary.toString() : '');
    setAlertFrequency(search.alertFrequency || 'weekly');
    setIsEnabled(search.isEnabled !== false);
    setFormError(null);
    setMode('edit');
  };

  const toggleArrangement = (val: string) => {
    setWorkArrangements((prev) =>
      prev.includes(val) ? prev.filter((item) => item !== val) : [...prev, val]
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen && defaultMode === 'create') {
          handleOpenCreate();
        }
      }}
    >
      <DialogTrigger render={<Button variant={triggerVariant} size='sm' className='gap-1.5' />}>
        <Icons.search className='h-3.5 w-3.5' />
        <span>{triggerLabel}</span>
      </DialogTrigger>
      <DialogContent className='max-w-2xl sm:max-w-3xl max-h-[90vh] overflow-y-auto'>
        {/* LIST VIEW */}
        {mode === 'list' && (
          <>
            <DialogHeader>
              <div className='flex items-center justify-between pr-6'>
                <div>
                  <DialogTitle>Saved Searches</DialogTitle>
                  <DialogDescription>
                    Manage reusable job searches and automated notification triggers.
                  </DialogDescription>
                </div>
                <Button size='sm' onClick={handleOpenCreate} className='gap-1.5'>
                  <Icons.add className='h-4 w-4' />
                  <span>New Search</span>
                </Button>
              </div>
            </DialogHeader>

            <div className='mt-4 space-y-3'>
              {isLoading ? (
                <div className='py-8 text-center text-sm text-muted-foreground'>
                  Loading saved searches...
                </div>
              ) : savedSearches.length === 0 ? (
                <div className='rounded-xl border border-dashed p-8 text-center'>
                  <Icons.search className='mx-auto h-8 w-8 text-muted-foreground/50' />
                  <p className='mt-2 font-medium text-sm'>No saved searches yet</p>
                  <p className='text-xs text-muted-foreground mt-1'>
                    Save job queries to automatically detect and receive alerts for new matches.
                  </p>
                  <Button size='sm' variant='outline' onClick={handleOpenCreate} className='mt-4'>
                    Create Your First Search
                  </Button>
                </div>
              ) : (
                savedSearches.map((search) => (
                  <div
                    key={search.id}
                    className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-card/60 hover:bg-card transition-colors'
                  >
                    <div className='space-y-1.5 min-w-0 flex-1'>
                      <div className='flex items-center gap-2 flex-wrap'>
                        <h4 className='font-semibold text-sm truncate'>{search.name}</h4>
                        <Badge
                          variant={search.isEnabled ? 'default' : 'secondary'}
                          className='text-[10px] px-1.5 py-0'
                        >
                          {search.isEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge
                          variant='outline'
                          className='text-[10px] uppercase font-mono px-1.5 py-0'
                        >
                          {search.alertFrequency}
                        </Badge>
                        {search.minMatchScore ? (
                          <Badge
                            variant='outline'
                            className='text-[10px] px-1.5 py-0 text-emerald-600 dark:text-emerald-400'
                          >
                            {search.minMatchScore}%+ fit
                          </Badge>
                        ) : null}
                      </div>

                      <div className='flex items-center gap-3 text-xs text-muted-foreground flex-wrap'>
                        {search.query && <span>Query: &quot;{search.query}&quot;</span>}
                        {search.locations && search.locations.length > 0 && (
                          <span>Loc: {search.locations.join(', ')}</span>
                        )}
                        {search.workArrangements && search.workArrangements.length > 0 && (
                          <span>Arrangement: {search.workArrangements.join(', ')}</span>
                        )}
                      </div>

                      <div className='text-[11px] text-muted-foreground/70'>
                        {search.lastExecutedAt
                          ? `Last run: ${new Date(search.lastExecutedAt).toLocaleDateString()} (${search.lastMatchCount} matches)`
                          : 'Not run yet'}
                      </div>
                    </div>

                    <div className='flex items-center gap-2 self-end sm:self-center'>
                      <Switch
                        checked={search.isEnabled}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: search.id, isEnabled: checked })
                        }
                        aria-label={`Toggle ${search.name}`}
                      />

                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => executeMutation.mutate(search.id)}
                        disabled={executeMutation.isPending}
                        className='h-8 px-2.5 text-xs gap-1'
                      >
                        <Icons.trendingUp className='h-3.5 w-3.5' />
                        <span>Run Now</span>
                      </Button>

                      <Button
                        size='icon'
                        variant='ghost'
                        className='h-8 w-8 text-muted-foreground hover:text-foreground'
                        onClick={() => handleOpenEdit(search)}
                        aria-label='Edit search'
                      >
                        <Icons.edit className='h-3.5 w-3.5' />
                      </Button>

                      <Button
                        size='icon'
                        variant='ghost'
                        className='h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10'
                        onClick={() => {
                          if (confirm(`Delete saved search "${search.name}"?`)) {
                            deleteMutation.mutate(search.id);
                          }
                        }}
                        aria-label='Delete search'
                      >
                        <Icons.trash className='h-3.5 w-3.5' />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* CREATE / EDIT VIEW */}
        {(mode === 'create' || mode === 'edit') && (
          <>
            <DialogHeader>
              <DialogTitle>
                {mode === 'create' ? 'Create Saved Search' : 'Edit Saved Search'}
              </DialogTitle>
              <DialogDescription>
                Configure criteria to monitor opportunities in CareerQuest&apos;s catalog.
              </DialogDescription>
            </DialogHeader>

            {formError && (
              <div className='p-3 text-xs bg-destructive/10 text-destructive rounded-lg border border-destructive/20'>
                {formError}
              </div>
            )}

            <div className='space-y-4 py-2 text-sm'>
              <div className='space-y-1.5'>
                <label htmlFor='search-name-input' className='font-medium text-xs'>
                  Search Name *
                </label>
                <Input
                  id='search-name-input'
                  placeholder='e.g. Senior Frontend Engineer (Remote)'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className='space-y-1.5'>
                <label htmlFor='search-query-input' className='font-medium text-xs'>
                  Keywords / Skills
                </label>
                <Input
                  id='search-query-input'
                  placeholder='e.g. React TypeScript Python'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className='space-y-1.5'>
                <label htmlFor='search-locations-input' className='font-medium text-xs'>
                  Locations (comma-separated)
                </label>
                <Input
                  id='search-locations-input'
                  placeholder='e.g. San Francisco, CA, Remote, New York, NY'
                  value={locations}
                  onChange={(e) => setLocations(e.target.value)}
                />
              </div>

              <div className='space-y-1.5'>
                <span className='font-medium text-xs'>Work Arrangements</span>
                <div className='flex gap-2'>
                  {['remote', 'hybrid', 'onsite'].map((arr) => (
                    <Button
                      key={arr}
                      type='button'
                      size='sm'
                      variant={workArrangements.includes(arr) ? 'default' : 'outline'}
                      className='capitalize text-xs h-8'
                      onClick={() => toggleArrangement(arr)}
                    >
                      {arr}
                    </Button>
                  ))}
                </div>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div className='space-y-1.5'>
                  <label htmlFor='search-min-match-input' className='font-medium text-xs'>
                    Minimum Match Fit Score (%)
                  </label>
                  <Input
                    id='search-min-match-input'
                    type='number'
                    min='0'
                    max='100'
                    placeholder='e.g. 80'
                    value={minMatchScore}
                    onChange={(e) => setMinMatchScore(e.target.value)}
                  />
                </div>

                <div className='space-y-1.5'>
                  <label htmlFor='search-min-salary-input' className='font-medium text-xs'>
                    Minimum Salary (USD)
                  </label>
                  <Input
                    id='search-min-salary-input'
                    type='number'
                    min='0'
                    step='5000'
                    placeholder='e.g. 150000'
                    value={minSalary}
                    onChange={(e) => setMinSalary(e.target.value)}
                  />
                </div>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2'>
                <div className='space-y-1.5'>
                  <label htmlFor='search-frequency-select' className='font-medium text-xs'>
                    Alert Frequency
                  </label>
                  <select
                    id='search-frequency-select'
                    value={alertFrequency}
                    onChange={(e) => setAlertFrequency(e.target.value)}
                    className='w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring'
                  >
                    <option value='instant'>Instant (as jobs are ingested)</option>
                    <option value='daily'>Daily Summary</option>
                    <option value='weekly'>Weekly Digest</option>
                    <option value='never'>Never (Manual Execution Only)</option>
                  </select>
                </div>

                <div className='flex items-center justify-between p-3 rounded-lg border bg-muted/30 self-end'>
                  <div>
                    <span className='font-medium text-xs block'>Enable Alerts</span>
                    <span className='text-[11px] text-muted-foreground'>
                      Participate in search alerts
                    </span>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={setIsEnabled}
                    aria-label='Enable search alerts'
                  />
                </div>
              </div>
            </div>

            <DialogFooter className='gap-2 mt-4'>
              <Button variant='outline' onClick={() => setMode('list')}>
                Cancel
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!name.trim() || saveMutation.isPending}
              >
                {saveMutation.isPending
                  ? 'Saving...'
                  : mode === 'create'
                    ? 'Create Search'
                    : 'Update Search'}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* RESULTS VIEW */}
        {mode === 'results' && executionResult && (
          <>
            <DialogHeader>
              <div className='flex items-center justify-between pr-6'>
                <div>
                  <DialogTitle>Search Results: {executionResult.savedSearch?.name}</DialogTitle>
                  <DialogDescription>
                    Execution evaluated at{' '}
                    {new Date(
                      executionResult.evaluatedAt || executionResult.executedAt
                    ).toLocaleTimeString()}
                  </DialogDescription>
                </div>
                <Button size='sm' variant='outline' onClick={() => setMode('list')}>
                  Back to Searches
                </Button>
              </div>
            </DialogHeader>

            <div className='mt-3 flex items-center gap-2'>
              <Badge variant='outline' className='text-xs'>
                Total Matches: {executionResult.totalMatchCount ?? executionResult.totalMatching}
              </Badge>
              <Badge variant='default' className='text-xs bg-emerald-600'>
                Newly Relevant: {executionResult.newMatchCount ?? executionResult.newAlertCount}
              </Badge>
            </div>

            <div className='mt-4 space-y-2.5 max-h-[50vh] overflow-y-auto pr-1'>
              {(executionResult.opportunities || []).length === 0 ? (
                <div className='py-8 text-center text-sm text-muted-foreground'>
                  No opportunities currently match this saved search.
                </div>
              ) : (
                (executionResult.opportunities || []).map((opp) => (
                  <div
                    key={opp.job.id}
                    className='p-3.5 rounded-xl border bg-card/60 flex items-center justify-between gap-3'
                  >
                    <div className='min-w-0 flex-1 space-y-1'>
                      <div className='flex items-center gap-2'>
                        <h4 className='font-semibold text-sm truncate'>{opp.job.title}</h4>
                        <span className='text-xs text-muted-foreground'>• {opp.job.company}</span>
                        {(executionResult.newOpportunities || []).some(
                          (no: { job: { id: string } }) => no.job.id === opp.job.id
                        ) && (
                          <Badge variant='default' className='text-[10px] bg-sky-600 px-1.5 py-0'>
                            New Match
                          </Badge>
                        )}
                      </div>
                      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                        <span>{opp.job.location}</span>
                        <span>•</span>
                        <span className='capitalize'>{opp.job.workArrangement}</span>
                        <span>•</span>
                        <span className='text-primary font-medium'>
                          Priority: {opp.priority?.priorityScore ?? '-'}
                        </span>
                      </div>
                    </div>

                    <a
                      href={`/dashboard/discover?search=${encodeURIComponent(opp.job.company)}`}
                      className='text-xs font-medium text-primary hover:underline flex items-center gap-1 shrink-0'
                      onClick={() => setOpen(false)}
                    >
                      <span>View</span>
                      <Icons.chevronRight className='h-3 w-3' />
                    </a>
                  </div>
                ))
              )}
            </div>

            <DialogFooter className='mt-4'>
              <Button onClick={() => setMode('list')}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
