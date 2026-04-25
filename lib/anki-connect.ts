// lib/anki-connect.ts
// Giao tiếp với AnkiConnect plugin (chạy localhost:8765 trên máy người dùng)

const ANKI_CONNECT_URL = process.env.ANKI_CONNECT_URL || 'http://127.0.0.1:8765';

export interface AnkiConnectResponse<T> {
  result: T;
  error: string | null;
}

export const ankiConnect = {
  /**
   * Helper để gửi request đến AnkiConnect
   */
  async invoke<T>(action: string, params: Record<string, any> = {}): Promise<T> {
    try {
      const response = await fetch(ANKI_CONNECT_URL, {
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
  },

  /**
   * Kiểm tra kết nối với AnkiConnect
   */
  async checkConnection(): Promise<boolean> {
    try {
      const version = await this.invoke<number>('version');
      return version === 6;
    } catch (error) {
      return false;
    }
  },

  /**
   * Lấy danh sách tên tất cả các decks trong Anki
   */
  async getDecks(): Promise<string[]> {
    return await this.invoke<string[]>('deckNames');
  },

  /**
   * Tạo 1 note trong Anki
   * @param note Thông số note gồm deckName, modelName, fields, tags
   */
  async createNote(note: any): Promise<number | null> {
    return await this.invoke<number | null>('addNote', { note });
  },

  /**
   * Tạo nhiều notes cùng lúc trong Anki
   */
  async addNotes(notes: any[]): Promise<(number | null)[]> {
    return await this.invoke<(number | null)[]>('addNotes', { notes });
  },

  /**
   * Lưu media file (audio/image) vào Anki media folder
   * @param filename Tên file cần lưu
   * @param base64 Dữ liệu file dưới dạng chuỗi base64
   */
  async storeMediaFile(filename: string, base64: string): Promise<string> {
    return await this.invoke<string>('storeMediaFile', { filename, data: base64 });
  }
};
