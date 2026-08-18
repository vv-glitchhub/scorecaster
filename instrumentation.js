export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerNodeRuntimeSecrets } = await import("./instrumentation-node.js");
  await registerNodeRuntimeSecrets();
}
