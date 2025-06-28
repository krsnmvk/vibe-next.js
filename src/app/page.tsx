'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTRPC } from '@/trpc/client';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export default function Home() {
  const [value, setValue] = useState('');

  const router = useRouter();

  const trpc = useTRPC();
  const { mutate, isPending } = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: (data) => router.push(`/projects/${data.id}`),
      onError: (err) => toast.error(err.message),
    })
  );

  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <div className="max-w-7xl mx-auto flex flex-col gap-y-4 items-center justify-center">
        <Input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          type="button"
          onClick={() => mutate({ value: value })}
          disabled={isPending}
        >
          submit
        </Button>
      </div>
    </div>
  );
}
