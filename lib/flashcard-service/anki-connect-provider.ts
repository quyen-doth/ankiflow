import type { IFlashcardService, AnkiNote, AnkiCardInfo, AnkiNoteInfo, CreateModelParams } from './types'

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
      // ここではログを出さない: ブラウザが AnkiConnect を直接呼び出し 30 秒ごとに poll する —
      // Anki が閉じている / CORS が未許可の場合、失敗のたびに console がスパムされてしまう。
      // Callers が各自処理: ping() はエラーを飲み込み → {connected:false}; export/deck ops は toast を表示。
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
    // Anki が重複と判定しても note の作成を許可する (同じ単語に複数 card type、または
    // 既存の単語から再作成する場合)。そうしないと、1 つの重複 note が addNotes コマンド
    // 全体を失敗させてしまう。
    const notesWithOptions = notes.map((note) => ({
      ...note,
      options: { allowDuplicate: true, duplicateScope: 'deck', ...(note.options ?? {}) },
    }));
    const result = await this.invoke<(number | null)[]>('addNotes', { notes: notesWithOptions });
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

  async notesInfo(noteIds: number[]): Promise<AnkiNoteInfo[]> {
    if (noteIds.length === 0) return [];
    return await this.invoke<AnkiNoteInfo[]>('notesInfo', { notes: noteIds });
  }

  async findCards(query: string): Promise<number[]> {
    return await this.invoke<number[]>('findCards', { query });
  }

  async cardsInfo(cardIds: number[]): Promise<AnkiCardInfo[]> {
    if (cardIds.length === 0) return [];
    return await this.invoke<AnkiCardInfo[]>('cardsInfo', { cards: cardIds });
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

  async updateModelStyling(modelName: string, css: string): Promise<void> {
    await this.invoke<null>('updateModelStyling', {
      model: { name: modelName, css },
    });
  }

  async updateModelTemplates(modelName: string, templates: { Name: string; Front: string; Back: string }[]): Promise<void> {
    // AnkiConnect は `templates` が card template 名をキーとする DICT で、値が
    // { Front, Back } である必要がある。配列を送ると "'list' object has no attribute 'get'" になる。
    const templatesDict: Record<string, { Front: string; Back: string }> = {};
    for (const t of templates) {
      templatesDict[t.Name] = { Front: t.Front, Back: t.Back };
    }
    await this.invoke<null>('updateModelTemplates', {
      model: {
        name: modelName,
        templates: templatesDict,
      },
    });
  }
}
