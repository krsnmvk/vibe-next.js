'use client';

import { Button } from '@/components/ui/button';
import { useTRPC } from '@/trpc/client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function Home() {
  const trpc = useTRPC();
  const { mutate } = useMutation(
    trpc.invoke.mutationOptions({
      onSuccess: () => toast.success('Background job started'),
    })
  );

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <Button type="button" onClick={() => mutate({ email: 'test@test.com' })}>
        Invoke Background Jobs
      </Button>
    </div>
  );
}
