'use client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { useClerk, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export function UserNav() {
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    (user?.username ? `@${user.username}` : 'Candidate Workspace');

  const displayEmail =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    'Authenticated Candidate';

  const avatarUser = {
    fullName: displayName,
    emailAddresses: [{ emailAddress: displayEmail }],
    imageUrl: user?.imageUrl || ''
  };

  const handleSignOut = async () => {
    await signOut({ redirectUrl: '/auth/sign-in' });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant='ghost' className='relative h-8 w-8 rounded-full' />}
      >
        <UserAvatarProfile user={avatarUser} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56' align='end' sideOffset={10}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col space-y-1'>
              <p className='text-sm leading-none font-medium truncate'>{displayName}</p>
              <p className='text-muted-foreground text-xs leading-none truncate'>{displayEmail}</p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/dashboard/resume')}>
            Profile & Resume
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className='text-destructive focus:text-destructive cursor-pointer'
          onClick={handleSignOut}
        >
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
