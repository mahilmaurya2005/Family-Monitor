import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiClient } from '@family-monitor/api-client';

const QUEUE_KEY = 'family-monitor-sync-queue';

export type QueueItem = {
  path: string;
  payload: unknown;
  createdAt: string;
};

export async function enqueue(item: Omit<QueueItem, 'createdAt'>) {
  const existing = await readQueue();
  await AsyncStorage.setItem(
    QUEUE_KEY,
    JSON.stringify([...existing, { ...item, createdAt: new Date().toISOString() }]),
  );
}

export async function readQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function flushQueue(api: ApiClient) {
  const queue = await readQueue();
  const remaining: QueueItem[] = [];

  for (const item of queue) {
    try {
      await api.replay(item.path, item.payload);
    } catch {
      remaining.push(item);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { attempted: queue.length, remaining: remaining.length };
}
