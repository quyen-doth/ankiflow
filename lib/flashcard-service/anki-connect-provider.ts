import type { IFlashcardService, AnkiNote, CreateModelParams } from './types'

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

  async createDeck(deckName: string): Promise<number> {
    return await this.invoke<number>('createDeck', { deck: deckName });
  }

  async addNotes(notes: AnkiNote[]): Promise<number[]> {
    const result = await this.invoke<(number | null)[]>('addNotes', { notes });
    return result.filter((id): id is number => id !== null);
  }

  async updateNoteFields(noteId: number, fields: Record<string, string>): Promise<void> {
    await this.invoke<null>('updateNoteFields', {
      note: { id: noteId, fields },
    });
  }

  async findNotes(query: string): Promise<number[]> {
    return await this.invoke<number[]>('findNotes', { query });
  }

  async findCards(query: string): Promise<number[]> {
    return await this.invoke<number[]>('findCards', { query });
  }

  async suspend(cardIds: number[]): Promise<boolean> {
    if (cardIds.length === 0) return true;
    return await this.invoke<boolean>('suspend', { cards: cardIds });
  }

  async unsuspend(cardIds: number[]): Promise<boolean> {
    if (cardIds.length === 0) return true;
    return await this.invoke<boolean>('unsuspend', { cards: cardIds });
  }

  async changeDeck(cardIds: number[], deckName: string): Promise<void> {
    if (cardIds.length === 0) return;
    await this.invoke<null>('changeDeck', { cards: cardIds, deck: deckName });
  }

  async deleteDecks(deckNames: string[], cardsToo = false): Promise<void> {
    if (deckNames.length === 0) return;
    await this.invoke<null>('deleteDecks', { decks: deckNames, cardsToo });
  }

  async storeMediaFile(filename: string, base64Data: string): Promise<string> {
    return await this.invoke<string>('storeMediaFile', { filename, data: base64Data });
  }

  async getModelNames(): Promise<string[]> {
    return await this.invoke<string[]>('modelNames');
  }

  async createModel(params: CreateModelParams): Promise<void> {
    await this.invoke<unknown>('createModel', {
      modelName: params.modelName,
      inOrderFields: params.inOrderFields,
      css: params.css || '',
      isCloze: false,
      cardTemplates: params.cardTemplates,
    });
  }
}
