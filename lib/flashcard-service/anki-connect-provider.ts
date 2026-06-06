import type { IFlashcardService, AnkiNote } from './types'

interface AnkiConnectResponse<T> {
  result: T;
  error: string | null;
}

export class AnkiConnectProvider implements IFlashcardService {
  private url: string;

  constructor(ankiConnectUrl: string) {
    this.url = ankiConnectUrl;
  }

  private async invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, version: 6, params }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = (await response.json()) as AnkiConnectResponse<T>;
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data.result;
    } catch (error) {
      console.error(`AnkiConnect Error (${action}):`, error);
      throw error;
    }
  }

  async ping(): Promise<{ connected: boolean; version?: number }> {
    try {
      const version = await this.invoke<number>('version');
      return { connected: version === 6, version };
    } catch {
      return { connected: false };
    }
  }

  async getDecks(): Promise<string[]> {
    return await this.invoke<string[]>('deckNames');
  }

  async addNotes(notes: AnkiNote[]): Promise<number[]> {
    const result = await this.invoke<(number | null)[]>('addNotes', { notes });
    return result.filter((id): id is number => id !== null);
  }

  async storeMediaFile(filename: string, base64Data: string): Promise<string> {
    return await this.invoke<string>('storeMediaFile', { filename, data: base64Data });
  }
}
