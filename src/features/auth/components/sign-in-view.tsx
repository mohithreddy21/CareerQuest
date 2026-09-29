import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SignIn as ClerkSignInForm } from '@clerk/nextjs';
import Link from 'next/link';
import { InteractiveGridPattern } from './interactive-grid';

export default function SignInViewPage() {
  const hasClerkKey = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes('example')
  );

  return (
    <div className='relative flex min-h-screen flex-col items-center justify-center overflow-hidden md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <Link
        href='/auth/sign-up'
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          'absolute top-4 right-4 hidden md:top-8 md:right-8 z-30'
        )}
      >
        Sign Up
      </Link>
      <div className='relative hidden h-full flex-col p-10 lg:flex dark:border-r'>
        <div className='absolute inset-0 bg-sidebar' />
        <div className='text-sidebar-foreground relative z-20 flex items-center text-xl font-bold tracking-tight'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='mr-2.5 h-6 w-6 text-primary'
          >
            <path d='M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' />
            <rect width='20' height='14' x='2' y='6' rx='2' />
          </svg>
          CareerQuest
        </div>
        <InteractiveGridPattern
          className={cn(
            'mask-[radial-gradient(400px_circle_at_center,white,transparent)]',
            'inset-x-0 inset-y-[0%] h-full skew-y-12 opacity-40'
          )}
        />
        <div className='text-sidebar-foreground relative z-20 mt-auto'>
          <blockquote className='space-y-2'>
            <p className='text-lg font-medium leading-relaxed'>
              &ldquo;CareerQuest streamlined my entire job search with verifiable facts, grounded
              resume tailoring, and structured pipeline tracking.&rdquo;
            </p>
            <footer className='text-sidebar-foreground/70 text-sm'>
              AI-Powered Candidate Workspace
            </footer>
          </blockquote>
        </div>
      </div>
      <div className='flex h-full items-center justify-center p-4 lg:p-8'>
        <div className='flex w-full max-w-md flex-col items-center justify-center space-y-6'>
          {hasClerkKey ? (
            <ClerkSignInForm />
          ) : (
            <div className='w-full rounded-2xl border bg-card p-8 shadow-sm text-card-foreground'>
              <div className='mb-6 space-y-2 text-center'>
                <h1 className='text-2xl font-bold tracking-tight'>Welcome to CareerQuest</h1>
                <p className='text-sm text-muted-foreground'>Sign in to your candidate workspace</p>
              </div>

              <div className='space-y-4 rounded-xl border border-dashed border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-sm'>
                <div className='flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    width='18'
                    height='18'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  >
                    <circle cx='12' cy='12' r='10' />
                    <line x1='12' x2='12' y1='8' y2='12' />
                    <line x1='12' x2='12' y1='16' y2='16.01' />
                  </svg>
                  Authentication Setup Required
                </div>
                <p className='text-xs leading-relaxed text-amber-800/90 dark:text-amber-300/80'>
                  To enable live authentication, configure your Clerk API credentials in{' '}
                  <code className='rounded bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 font-mono text-[11px]'>
                    .env.local
                  </code>
                  :
                </p>
                <div className='rounded bg-muted p-2.5 font-mono text-xs text-foreground'>
                  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
                  <br />
                  CLERK_SECRET_KEY=sk_test_...
                </div>
                <p className='text-xs text-muted-foreground'>
                  Unauthenticated access to dashboard routes is strictly prevented. Once keys are
                  configured, the Clerk sign-in form will activate automatically.
                </p>
              </div>

              <div className='mt-6 text-center text-sm text-muted-foreground'>
                Don&apos;t have an account?{' '}
                <Link
                  href='/auth/sign-up'
                  className='font-medium text-primary underline underline-offset-4 hover:opacity-80'
                >
                  Sign up
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
