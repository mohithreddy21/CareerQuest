'use client';

import { useState } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import {
  knowledgeBankQueryOptions,
  proposedBatchesQueryOptions,
  knowledgeKeys
} from '../api/queries';
import {
  addKnowledgeItemMutation,
  updateKnowledgeItemMutation,
  updateKnowledgeStatusMutation,
  deleteKnowledgeItemMutation
} from '../api/mutations';
import { KnowledgeCategory, KnowledgeItem } from '@/types/domain';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { KnowledgeItemCard } from './knowledge-item-card';
import { KnowledgeItemDialog } from './knowledge-item-dialog';
import { ResumeUploadDialog } from './resume-upload-dialog';
import { ProposedKnowledgeReview } from './proposed-knowledge-review';
import { toast } from 'sonner';

export interface KnowledgeBankWorkspaceProps {
  candidateId?: string;
}

export function KnowledgeBankWorkspace({ candidateId = 'cand-1' }: KnowledgeBankWorkspaceProps) {
  const queryClient = useQueryClient();

  const { data: bank } = useSuspenseQuery(knowledgeBankQueryOptions(candidateId));
  const { data: proposedBatches } = useSuspenseQuery(proposedBatchesQueryOptions(candidateId));

  // State
  const [activeCategory, setActiveCategory] = useState<KnowledgeCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);

  // Mutations
  const addMutation = useMutation({
    ...addKnowledgeItemMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
      toast.success('Knowledge asset added to Knowledge Bank.');
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to add knowledge item';
      toast.error(msg);
    }
  });

  const updateMutation = useMutation({
    ...updateKnowledgeItemMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
      toast.success('Knowledge asset updated successfully.');
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to update knowledge item';
      toast.error(msg);
    }
  });

  const statusMutation = useMutation({
    ...updateKnowledgeStatusMutation,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
      toast.success(`Knowledge asset marked as ${vars.status}.`);
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to update status';
      toast.error(msg);
    }
  });

  const deleteMutation = useMutation({
    ...deleteKnowledgeItemMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
      toast.success('Knowledge asset removed.');
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to delete knowledge item';
      toast.error(msg);
    }
  });

  // Collect all items across categories into a unified list
  const allItems: KnowledgeItem[] = [
    ...bank.skills,
    ...bank.experiences,
    ...bank.projects,
    ...bank.education,
    ...bank.certifications,
    ...bank.achievements
  ];

  // Filter items
  const filteredItems = allItems.filter((item) => {
    // 1. Status filter
    if (showArchived) {
      if (item.status !== 'archived') return false;
    } else {
      if (item.status !== 'approved') return false;
    }

    // 2. Category filter
    if (activeCategory !== 'all' && item.category !== activeCategory) {
      return false;
    }

    // 3. Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const contentStr = JSON.stringify(item.content).toLowerCase();
      const catMatch = item.category.toLowerCase().includes(q);
      return contentStr.includes(q) || catMatch;
    }

    return true;
  });

  const totalApproved = allItems.filter((i) => i.status === 'approved').length;
  const totalArchived = allItems.filter((i) => i.status === 'archived').length;
  const pendingClaimsCount = proposedBatches.reduce((acc, b) => acc + b.items.length, 0);

  const [dialogCategory, setDialogCategory] = useState<KnowledgeCategory>('skill');

  const handleOpenAdd = (category?: KnowledgeCategory) => {
    setEditingItem(null);
    setDialogCategory(category || (activeCategory === 'all' ? 'skill' : activeCategory));
    setDialogOpen(true);
  };

  const handleEdit = (item: KnowledgeItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleSaveDialog = (
    category: KnowledgeCategory,
    content: Record<string, unknown>,
    itemId?: string
  ) => {
    if (itemId) {
      updateMutation.mutate({ id: itemId, content });
    } else {
      addMutation.mutate({ candidateId, category, content });
    }
  };

  const categories: { label: string; value: KnowledgeCategory | 'all'; count: number }[] = [
    { label: 'All Assets', value: 'all', count: totalApproved },
    {
      label: 'Skills',
      value: 'skill',
      count: bank.skills.filter((i) => i.status === 'approved').length
    },
    {
      label: 'Experience',
      value: 'experience',
      count: bank.experiences.filter((i) => i.status === 'approved').length
    },
    {
      label: 'Projects',
      value: 'project',
      count: bank.projects.filter((i) => i.status === 'approved').length
    },
    {
      label: 'Education',
      value: 'education',
      count: bank.education.filter((i) => i.status === 'approved').length
    },
    {
      label: 'Certifications',
      value: 'certification',
      count: bank.certifications.filter((i) => i.status === 'approved').length
    },
    {
      label: 'Achievements',
      value: 'achievement',
      count: bank.achievements.filter((i) => i.status === 'approved').length
    }
  ];

  return (
    <div className='space-y-6'>
      {/* 1. Header Banner & Actions */}
      <Card className='border-border/70 shadow-xs'>
        <CardContent className='flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between'>
          <div className='space-y-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='text-xl font-bold tracking-tight text-foreground sm:text-2xl'>
                Candidate Knowledge Bank
              </h2>
              <Badge variant='outline' className='text-xs font-semibold'>
                {totalApproved} Verified Assets
              </Badge>
              {pendingClaimsCount > 0 && (
                <Badge
                  variant='default'
                  className='text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white'
                >
                  {pendingClaimsCount} Claims Awaiting Review
                </Badge>
              )}
            </div>
            <p className='text-xs text-muted-foreground max-w-2xl leading-relaxed'>
              Your persistent, canonical repository of approved skills, career history,
              achievements, and credentials. Job-specific resumes and match analyses draw
              exclusively from this verified knowledge store.
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-2 shrink-0'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setUploadDialogOpen(true)}
              className='text-xs gap-1.5 shadow-xs'
            >
              <Icons.upload className='h-3.5 w-3.5' />
              Upload Resume to Ingest
            </Button>
            <Button
              variant='default'
              size='sm'
              onClick={() => handleOpenAdd()}
              className='text-xs gap-1.5 shadow-xs'
            >
              <Icons.add className='h-3.5 w-3.5' />
              Add Knowledge Asset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Proposed Ingestion Review Queue (Rendered if pending claims exist) */}
      <ProposedKnowledgeReview batches={proposedBatches} candidateId={candidateId} />

      {/* 3. Category Filter & Search Bar */}
      <div className='space-y-3'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex flex-wrap items-center gap-1.5'>
            {categories.map((cat) => (
              <Button
                key={cat.value}
                size='sm'
                variant={activeCategory === cat.value ? 'default' : 'outline'}
                onClick={() => setActiveCategory(cat.value)}
                className='h-8 text-xs px-3 gap-1.5 font-medium shadow-2xs'
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    activeCategory === cat.value
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {cat.count}
                </span>
              </Button>
            ))}
          </div>

          <div className='flex items-center gap-2'>
            <Button
              variant={showArchived ? 'secondary' : 'ghost'}
              size='sm'
              onClick={() => setShowArchived(!showArchived)}
              className='h-8 text-xs text-muted-foreground hover:text-foreground gap-1'
            >
              <Icons.eyeOff className='h-3.5 w-3.5' />
              <span>{showArchived ? 'Viewing Archived' : `Archived (${totalArchived})`}</span>
            </Button>
          </div>
        </div>

        <div className='relative'>
          <Icons.search className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Search skills, employers, projects, metrics, or credentials...'
            className='pl-9 text-xs'
          />
        </div>
      </div>

      {/* 4. Knowledge Items Grid */}
      {filteredItems.length > 0 ? (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {filteredItems.map((item) => (
            <KnowledgeItemCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      ) : (
        <Card className='border-dashed border-border/80 p-8 text-center'>
          <div className='max-w-md mx-auto space-y-2'>
            <div className='mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground'>
              <Icons.search className='h-5 w-5' />
            </div>
            <h3 className='text-sm font-semibold text-foreground'>
              {showArchived
                ? 'No Archived Knowledge Assets'
                : searchQuery
                  ? 'No Knowledge Assets Match Your Search'
                  : 'No Assets in this Category'}
            </h3>
            <p className='text-xs text-muted-foreground'>
              {searchQuery
                ? `No items found matching "${searchQuery}". Try a different search term or category.`
                : 'Add a new asset manually or ingest from a resume document to expand your Knowledge Bank.'}
            </p>
            {!showArchived && (
              <div className='pt-2 flex justify-center gap-2'>
                <Button
                  size='sm'
                  onClick={() => handleOpenAdd(activeCategory === 'all' ? 'skill' : activeCategory)}
                  className='text-xs'
                >
                  <Icons.add className='mr-1.5 h-3.5 w-3.5' /> Add Knowledge Asset
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Dialogs */}
      <KnowledgeItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        defaultCategory={dialogCategory}
        onSave={handleSaveDialog}
        isSaving={addMutation.isPending || updateMutation.isPending}
      />

      <ResumeUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        candidateId={candidateId}
      />
    </div>
  );
}
