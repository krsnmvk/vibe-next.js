import * as z from 'zod';
import { inngest } from './client';
import {
  gemini,
  createAgent,
  createTool,
  createNetwork,
  type Tool,
} from '@inngest/agent-kit';
import { Sandbox } from '@e2b/code-interpreter';
import { getSandbox } from './get-sandbox';
import { PROMPT } from '@/prompt';
import { lastAssistantTextMessageContent } from './last-assistant-textmessage-content';
import db from '@/lib/prisma';

type AgentState = {
  summary: string;
  files: { [path: string]: string };
};

export const codeAgentFunction = inngest.createFunction(
  { id: 'code-agent' },
  { event: 'run/code-agent' },

  async ({ event, step }) => {
    const sandboxId = await step.run('get-sandbox-id', async () => {
      const sandbox = await Sandbox.create('vibe-next-js');

      return sandbox.sandboxId;
    });

    const sandboxUrl = await step.run('get-sandbox-url', async () => {
      const sandbox = await getSandbox(sandboxId);

      const host = sandbox.getHost(3000);

      return `https://${host}`;
    });

    const codeAgent = createAgent<AgentState>({
      name: 'code-agent',
      description: 'An expert coding agent',
      system: PROMPT,
      model: gemini({ model: 'gemini-2.0-flash' }),
      tools: [
        createTool({
          name: 'terminal',
          description: 'Use the terminal to us commands',
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run('terminal', async () => {
              const buffers = { stdout: '', stderr: '' };

              try {
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data: string) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data;
                  },
                });

                return result;
              } catch (err) {
                console.error(
                  `Command failed: ${err}\nstdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`
                );
                return `Command failed: ${err}\nstdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`;
              }
            });
          },
        }),

        createTool({
          name: 'createOrUpdateFiles',
          description: 'Create or update files in the sandbox',
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              })
            ),
          }),
          handler: async (
            { files },
            { step, network }: Tool.Options<AgentState>
          ) => {
            const newFiles = await step?.run(
              'createOrUpdateFiles',
              async () => {
                try {
                  const updateFiles = (await network.state.data.files) || {};
                  const sandbox = await getSandbox(sandboxId);

                  for (const file of files) {
                    await sandbox.files.write(file.path, file.content);

                    updateFiles[file.path] = file.content;
                  }

                  return updateFiles;
                } catch (err) {
                  return `Error: ${err}`;
                }
              }
            );

            if (typeof newFiles === 'object') {
              network.state.data.files = newFiles;
            }
          },
        }),

        createTool({
          name: 'readFiles',
          description: 'Read files from the sandbox',
          parameters: z.object({ files: z.array(z.string()) }),
          handler: async ({ files }, { step }) => {
            return await step?.run('readFiles', async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const contents = [];

                for (const file of files) {
                  const content = await sandbox.files.read(file);

                  contents.push({ path: file, content });
                }
              } catch (err) {
                return `Error: ${err}`;
              }
            });
          },
        }),
      ],

      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantTextMessage =
            lastAssistantTextMessageContent(result);

          if (lastAssistantTextMessage && network) {
            if (lastAssistantTextMessage.includes('<task_summary>')) {
              network.state.data.summary = lastAssistantTextMessage;
            }
          }

          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: 'coding-agent-network',
      agents: [codeAgent],
      maxIter: 15,
      router: async ({ network }) => {
        const summary = network.state.data.summary;

        if (summary) return;

        return codeAgent;
      },
    });

    const result = await network.run(event.data.value);

    const isError =
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;

    await step.run('save-result', async () => {
      if (isError) {
        return await db.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something wen't wrong. Please try again",
            role: 'assistant',
            type: 'error',
          },
        });
      }

      return await db.message.create({
        data: {
          content: result.state.data.summary,
          projectId: event.data.projectId,
          role: 'assistant',
          type: 'result',
          fragment: {
            create: {
              title: 'Fragment',
              files: result.state.data.files,
              sandboxUrl: sandboxUrl,
            },
          },
        },
      });
    });

    return {
      url: sandboxUrl,
      title: 'Fragment',
      files: result.state.data.files,
      summary: result.state.data.files,
    };
  }
);
