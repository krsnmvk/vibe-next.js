import * as z from 'zod';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import db from '@/lib/prisma';
import { inngest } from '@/inngest/client';

export const messagesRouter = createTRPCRouter({
  create: baseProcedure
    .input(
      z.object({
        value: z.string().min(1).trim(),
      })
    )
    .mutation(async ({ input }) => {
      const message = await db.message.create({
        data: {
          content: input.value,
          role: 'user',
          type: 'result',
        },
      });

      await inngest.send({
        name: 'run/code-agent',
        data: {
          value: input.value,
        },
      });

      return message;
    }),

  getMany: baseProcedure.query(async () => {
    const messages = await db.message.findMany({
      orderBy: {
        createdAt: 'asc',
      },
    });

    return messages;
  }),
});
