'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTRPC } from '@/trpc/client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

export default function Home() {
  const [value, setValue] = useState('');

  const trpc = useTRPC();
  const { mutate, isPending } = useMutation(
    trpc.messages.create.mutationOptions({
      onSuccess: () => toast.success('Message created'),
    })
  );

  const { data } = useQuery(trpc.messages.getMany.queryOptions());

  return (
    <div className="p-4 max-w-7xl space-y-3 mx-auto">
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
        Invoke Background Jobs
      </Button>
      <div>{JSON.stringify(data, null, 2)}</div>
    </div>
  );
}
