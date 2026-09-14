// Experiment only. Both arms load the unchanged production extension.
import extension from '../../internal/launcher/extension.ts';
export default function (pi: any) {
  extension(pi);
  if (process.env.TMAX_ATTENTION === 'joint') pi.on('before_agent_start', async (event: any) => ({
    systemPrompt: event.systemPrompt + '\nWhile acting, keep implementation correctness, what measurements mean, intended use, and how a reader will interpret the result jointly in view. Let each inform the same developing work.'
  }));
}
