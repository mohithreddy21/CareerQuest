'use client';

import { useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { userSettingsQueryOptions } from '../api/queries';
import { updateSettingsMutation } from '../api/mutations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import { DocumentsManagementCard } from './documents-management-card';

export default function SettingsPage() {
  const { data: settings } = useSuspenseQuery(userSettingsQueryOptions());

  const [targetRoles, setTargetRoles] = useState(settings.targetRoles.join(', '));
  const [locations, setLocations] = useState(settings.preferredLocations.join(', '));
  const [salaryMin, setSalaryMin] = useState(String(settings.targetSalaryMin));
  const [privateMode, setPrivateMode] = useState(settings.privateMode);
  const [notifyOnHighMatch, setNotifyOnHighMatch] = useState(settings.notifyOnHighMatch);
  const [autoExtract, setAutoExtract] = useState(settings.autoExtractRequirements);

  const mutation = useMutation({
    ...updateSettingsMutation,
    onSuccess: () => {
      toast.success('Preferences saved successfully.');
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to save preferences';
      toast.error(msg);
    }
  });

  const handleSave = () => {
    mutation.mutate({
      updates: {
        targetRoles: targetRoles
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean),
        preferredLocations: locations
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
        targetSalaryMin: Number(salaryMin) || 160000,
        privateMode,
        notifyOnHighMatch,
        autoExtractRequirements: autoExtract
      }
    });
  };

  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-4xl'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Settings & Search Preferences
        </h1>
        <p className='text-sm text-muted-foreground'>
          Configure your target job filters, AI assistance behavior, and career privacy preferences.
        </p>
      </div>

      {/* Search Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Job Search Targets</CardTitle>
          <CardDescription>
            These parameters drive the match scoring and recommendations on your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <label htmlFor='setting-target-roles' className='text-xs font-medium text-foreground'>
              Target Roles (Comma-separated)
            </label>
            <Input
              id='setting-target-roles'
              value={targetRoles}
              onChange={(e) => setTargetRoles(e.target.value)}
              placeholder='e.g. Senior Full-Stack Engineer, Staff Engineer'
            />
          </div>

          <div className='space-y-2'>
            <label htmlFor='setting-locations' className='text-xs font-medium text-foreground'>
              Preferred Locations (Comma-separated)
            </label>
            <Input
              id='setting-locations'
              value={locations}
              onChange={(e) => setLocations(e.target.value)}
              placeholder='e.g. San Francisco, CA, Remote, New York, NY'
            />
          </div>

          <div className='space-y-2'>
            <label htmlFor='setting-salary-min' className='text-xs font-medium text-foreground'>
              Minimum Annual Salary Target (USD)
            </label>
            <Input
              id='setting-salary-min'
              type='number'
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder='165000'
            />
          </div>
        </CardContent>
      </Card>

      {/* AI Assistant Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>AI Assistance Preferences</CardTitle>
          <CardDescription>
            Configure how CareerQuest analyzes postings and formulates resume revisions.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between space-x-2'>
            <div className='space-y-0.5'>
              <label htmlFor='setting-auto-extract' className='text-xs font-medium text-foreground'>
                Automatic Requirement Extraction
              </label>
              <p className='text-xs text-muted-foreground'>
                Automatically parse responsibilities and requirements when importing any URL.
              </p>
            </div>
            <Switch
              id='setting-auto-extract'
              checked={autoExtract}
              onCheckedChange={setAutoExtract}
            />
          </div>

          <div className='flex items-center justify-between space-x-2 pt-3 border-t border-border/50'>
            <div className='space-y-0.5'>
              <label
                htmlFor='setting-notify-high-match'
                className='text-xs font-medium text-foreground'
              >
                Highlight High-Match Opportunities
              </label>
              <p className='text-xs text-muted-foreground'>
                Highlight roles with 90%+ match scores on the dashboard overview.
              </p>
            </div>
            <Switch
              id='setting-notify-high-match'
              checked={notifyOnHighMatch}
              onCheckedChange={setNotifyOnHighMatch}
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Provenance Controls */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Privacy & Data Controls</CardTitle>
          <CardDescription>
            Your candidate information is treated as private career intelligence.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between space-x-2'>
            <div className='space-y-0.5'>
              <label htmlFor='setting-private-mode' className='text-xs font-medium text-foreground'>
                Strict Privacy Mode
              </label>
              <p className='text-xs text-muted-foreground'>
                Keep profile strictly local and client-isolated during AI analyses.
              </p>
            </div>
            <Switch
              id='setting-private-mode'
              checked={privateMode}
              onCheckedChange={setPrivateMode}
            />
          </div>

          <div className='rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground border border-border/50'>
            <p className='font-medium text-foreground'>Truthfulness Guarantee</p>
            <p className='mt-1'>
              CareerQuest will never fabricate credentials, skills, or job history. Generated
              content is always traceable to candidate-entered source evidence.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className='flex justify-end pt-2'>
        <Button
          size='default'
          disabled={mutation.isPending}
          onClick={handleSave}
          className='shadow-xs'
        >
          <Icons.check className='mr-1.5 h-4 w-4' />
          Save Preferences
        </Button>
      </div>

      {/* Phase 6F: Workspace Documents & Data Lifecycle */}
      <DocumentsManagementCard />
    </div>
  );
}
