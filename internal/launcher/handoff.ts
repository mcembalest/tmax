// A handoff joins Pi's native session events to Herdr's existing terminals.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

type Task = { id: string; task: string; pane?: string };
type Result = { status: string; text: string; session?: string };
const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8"));
async function save(path: string, value: unknown) {
  const temporary = path + "." + randomUUID();
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, path);
}

export default function handoffs(pi: ExtensionAPI, run: (args: string[], signal?: AbortSignal) => Promise<string>, extensions: string[]) {
  pi.registerFlag("tmax-task", { type: "string", description: "Internal handoff record" });
  let childPath: string | undefined;
  let ctx: ExtensionContext | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let checking = false, assigned = false, returned = false, closed = false;
  const queued = new Set<string>();
  let child: Task | undefined;
  let candidate: Result | undefined;

  async function finish(result: Result) {
    if (!childPath || returned) return;
    returned = true;
    try { await save(childPath + ".result", result); }
    catch (error) { returned = false; throw error; }
  }
  async function collect() {
    if (checking || closed || !ctx?.isIdle() || childPath) return;
    const current = ctx, session = ctx.sessionManager.getSessionFile();
    checking = true;
    try {
      const branch = ctx.sessionManager.getBranch();
      const delivered = new Set(branch.flatMap((entry: any) => entry.type === "custom_message" && entry.customType === "tmax_results" ? entry.details?.ids ?? [] : []));
      const tasks = branch.filter((entry: any) => entry.type === "custom" && entry.customType === "tmax_task") as any[];
      const results: { id: string; task: string; pane?: string; result: Result }[] = [];
      for (const entry of tasks) {
        const { path, id } = entry.data;
        if (delivered.has(id) || queued.has(id)) continue;
        const task = await read<Task>(path);
        let result = await read<Result>(path + ".result").catch(() => undefined);
        if (!result && !task.pane) result = { status: "launch_uncertain", text: "Startup was interrupted before the helper panel was recorded. Inspect the workspace before retrying." };
        if (!result && task.pane) {
          try { await run(["agent", "get", task.pane]); }
          catch (error) {
            // A transport failure is uncertainty, not evidence the helper died.
            if (/agent_not_running|agent_not_found|pane_not_found|unknown_pane/.test(String(error))) {
              result = { status: "interrupted", text: "The helper panel or agent disappeared before returning a result. Its work is not confirmed complete." };
              await save(path + ".result", result);
            }
          }
        }
        if (result) results.push({ id, task: task.task, pane: task.pane, result });
      }
      // Re-check after I/O: never splice a result between a tool call and its reply.
      if (!closed && ctx === current && ctx.sessionManager.getSessionFile() === session && ctx.isIdle() && results.length) {
        for (const result of results) queued.add(result.id);
        pi.sendMessage({ customType: "tmax_results", display: true,
          content: "Helper results returned. Treat findings as observations, verify what matters, and incorporate them into your reply. Panels remain available; do not close a panel the user is using.\n" + JSON.stringify(results),
          details: { ids: results.map(result => result.id) },
        }, { triggerTurn: true });
      }
    } catch (error) { ctx?.ui.notify("Could not collect helper results: " + String(error), "warning"); }
    finally { checking = false; }
  }

  pi.on("session_start", async (_event, context) => {
    childPath = pi.getFlag("tmax-task") as string | undefined;
    ctx = context; closed = false; queued.clear();
    if (timer) clearInterval(timer);
    if (childPath) {
      child = await read<Task>(childPath);
      returned = !!await read<Result>(childPath + ".result").catch(() => undefined);
      assigned = !!await read(childPath + ".accepted").catch(() => undefined);
      if (!["startup", "reload"].includes(_event.reason)) await finish({ status: "handed_over", text: "The helper switched conversations. Automatic return for this assignment has stopped; keep the panel open." });
    }
    else if (ctx.sessionManager?.getSessionFile()) { timer = setInterval(collect, 1000); timer.unref(); }
  });
  pi.on("session_shutdown", () => { closed = true; if (timer) clearInterval(timer); });
  pi.on("input", async event => {
    if (!child || returned) return;
    if (!assigned && event.text === child.task) { assigned = true; await save(childPath! + ".accepted", true); }
    else if (event.source === "interactive") await finish({ status: "handed_over", text: "The user is working in the helper panel. Automatic result return has stopped for this assignment; keep the panel open." });
  });
  pi.on("agent_end", async (event, context) => {
    if (!child || !assigned || returned) return;
    const last = [...event.messages].reverse().find(message => message.role === "assistant");
    if (!last || last.role !== "assistant") return;
    // A canceled/error turn is never relabeled as successful work.
    const status = last.stopReason === "aborted" || last.stopReason === "error" ? last.stopReason : "returned";
    const content = last.content.filter(part => part.type === "text").map(part => part.text).join("\n");
    candidate = { status, text: content || last.errorMessage || "The helper returned no text.", session: context.sessionManager.getSessionFile() };
  });
  pi.on("agent_settled", async () => { if (candidate) await finish(candidate); });
  pi.registerTool({
    name: "split_work", label: "Split work",
    description: "Give a focused task to another Pi in a new panel and keep talking here. Findings return automatically to this conversation when it is idle. Choose fresh context (default) for a self-contained task, or fork when this conversation is needed. Both share files; coordinate edits. The panel stays available. Use only when the user's task calls for delegation.",
    parameters: Type.Object({ task: Type.String({ minLength: 1 }), context: Type.Optional(Type.Union([Type.Literal("fresh"), Type.Literal("fork")])) }),
    async execute(_id, args, signal, _update, context) {
      if (childPath) throw new Error("Return findings here; nested splitting is not supported yet");
      if (signal?.aborted) throw new Error("Canceled before splitting");
      const session = context.sessionManager.getSessionFile();
      if (!session) throw new Error("Save this Pi conversation before splitting work");
      const id = randomUUID(), dir = session + ".tmax", path = join(dir, id + ".json");
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const task: Task = { id, task: args.task };
      await save(path, task);
      pi.appendEntry("tmax_task", { id, path });
      try {
        const split = JSON.parse(await run(["pane", "split", "--current", "--direction", "right", "--cwd", context.cwd, "--no-focus"], signal));
        task.pane = split.result.pane.pane_id;
        await save(path, task);
        const options = ["--offline", ...extensions, "--tmax-task", path];
        if (args.context === "fork") options.push("--fork", session);
        else options.push("--session", join(dir, id + ".jsonl"));
        if (context.model) options.push("--provider", context.model.provider, "--model", context.model.id);
        await run(["agent", "start", "helper-" + id.slice(0, 8), "--kind", "pi", "--pane", task.pane!, "--", ...options], signal);
        await run(["agent", "prompt", task.pane!, task.task], signal);
        return { content: [{ type: "text", text: `Work started in ${task.pane}. Continue with the user; the result will return automatically. Do not poll or wait on it.` }], details: { id, pane: task.pane } };
      } catch (error) {
        await save(path + ".result", { status: "launch_uncertain", text: String(error) + ". A submitted launch may still be running; inspect the panel before retrying." });
        throw error;
      }
    },
  });
}
