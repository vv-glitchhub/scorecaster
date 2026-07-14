import * as SecureStore from "expo-secure-store";

const CHUNK_SIZE = 1800;

function manifestKey(key: string) {
  return `${key}:manifest`;
}

function chunkKey(key: string, index: number) {
  return `${key}:chunk:${index}`;
}

async function readChunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(manifestKey(key));
  const count = Number(raw);
  return Number.isInteger(count) && count > 0 && count <= 64 ? count : 0;
}

async function clearChunks(key: string): Promise<void> {
  const count = await readChunkCount(key);
  await Promise.all(
    Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(chunkKey(key, index)))
  );
  await SecureStore.deleteItemAsync(manifestKey(key));
  await SecureStore.deleteItemAsync(key);
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await readChunkCount(key);
    if (!count) return SecureStore.getItemAsync(key);

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index)))
    );

    if (chunks.some((chunk) => chunk === null)) {
      await clearChunks(key);
      return null;
    }

    return chunks.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    await clearChunks(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunks = Array.from(
      { length: Math.ceil(value.length / CHUNK_SIZE) },
      (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE)
    );

    if (chunks.length > 64) throw new Error("Secure session is unexpectedly large");

    await Promise.all(
      chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk))
    );
    await SecureStore.setItemAsync(manifestKey(key), String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    await clearChunks(key);
  }
};
