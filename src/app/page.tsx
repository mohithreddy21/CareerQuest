import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Page() {
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session?.userId ?? null;
  } catch {
    userId = null;
  }

  if (userId) {
    redirect('/dashboard/overview');
  }

  redirect('/auth/sign-in');
}
