import { getAdminDb } from "@/lib/firebase/admin";

interface LogParams {
  endpoint: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
  userId?: string | null;
}

export async function logTokenUsage(params: LogParams): Promise<void> {
  try {
    const db = getAdminDb();
    await db.collection("usageLogs").add({
      endpoint: params.endpoint,
      model: params.model,
      inputTokens: params.usage.input_tokens,
      outputTokens: params.usage.output_tokens,
      timestamp: new Date().toISOString(),
      userId: params.userId ?? null,
    });
  } catch (err) {
    console.error("logTokenUsage error:", err);
  }
}
