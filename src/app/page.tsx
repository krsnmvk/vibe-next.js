import { caller } from '@/trpc/server';

export default async function Home() {
  const data = await caller.hello({ text: 'Krisno Mukti' });

  return (
    <div>
      <h1>Home Page</h1>

      {JSON.stringify(data, null, 2)}
    </div>
  );
}
