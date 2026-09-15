// Bound the whole RPC prompt, including acknowledgement, not just generation.
export async function turn(pi, message, budgetMs = 90000) {
  let timer;
  try {
    await Promise.race([pi.prompt(message, budgetMs), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Turn exceeded ${budgetMs}ms budget`)), budgetMs);
    })]);
  } catch (error) { await pi.close(); throw error; }
  finally { clearTimeout(timer); }
}
