import * as z from 'zod';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import db from '@/lib/prisma';
import { inngest } from '@/inngest/client';
import { generateSlug } from 'random-word-slugs';

export const projectsRouter = createTRPCRouter({
  create: baseProcedure
    .input(
      z.object({
        value: z.string().min(1).max(1000).trim(),
      })
    )
    .mutation(async ({ input }) => {
      const project = await db.project.create({
        data: {
          name: generateSlug(2, {
            format: 'kebab',
          }),
          messages: {
            create: {
              content: input.value,
              role: 'user',
              type: 'result',
            },
          },
        },
      });

      await inngest.send({
        name: 'run/code-agent',
        data: {
          value: input.value,
          projectId: project.id,
        },
      });

      return project;
    }),

  getMany: baseProcedure.query(async () => {
    const projects = await db.project.findMany({
      orderBy: {
        createdAt: 'asc',
      },
    });

    return projects;
  }),
});
