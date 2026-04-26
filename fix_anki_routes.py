import os

base_dir = "/Users/hong-quyen/Documents/study/flashcard/ankiflow"

def replace_in_file(path, old_str, new_str):
    full_path = os.path.join(base_dir, path)
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    content = content.replace(old_str, new_str)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)

# 1. connect/route.ts
replace_in_file("app/api/anki/connect/route.ts", 
    "import { ankiConnect } from '@/lib/anki-connect';", 
    "import { flashcardService } from '@/lib/flashcard-service';")
replace_in_file("app/api/anki/connect/route.ts", 
    "ankiConnect.checkConnection()", 
    "(await flashcardService.ping()).connected")

# 2. decks/route.ts
replace_in_file("app/api/anki/decks/route.ts", 
    "import { ankiConnect } from '@/lib/anki-connect';", 
    "import { flashcardService } from '@/lib/flashcard-service';")
replace_in_file("app/api/anki/decks/route.ts", 
    "ankiConnect.getDecks()", 
    "flashcardService.getDecks()")

# 3. create/route.ts
replace_in_file("app/api/anki/create/route.ts", 
    "import { ankiConnect } from '@/lib/anki-connect';", 
    "import { flashcardService } from '@/lib/flashcard-service';")
replace_in_file("app/api/anki/create/route.ts", 
    "ankiConnect.addNotes(notes)", 
    "flashcardService.addNotes(notes)")

# 4. audio/route.ts (Wait, audio uses lib/audio-service.ts now, not lib/anki-connect.ts)
replace_in_file("lib/audio-service.ts",
    "import { ankiConnect } from '@/lib/anki-connect';",
    "import { flashcardService } from '@/lib/flashcard-service';")
replace_in_file("lib/audio-service.ts",
    "ankiConnect.storeMediaFile",
    "flashcardService.storeMediaFile")

# Also write the proper anki-connect-provider.ts
with open(os.path.join(base_dir, "lib/flashcard-service/anki-connect-provider.ts"), "w", encoding="utf-8") as f:
    f.write("""import type { IFlashcardService, AnkiNote } from './types'

interface AnkiConnectResponse<T> {
  result: T;
  error: string | null;
}

export class AnkiConnectProvider implements IFlashcardService {
  private url: string;

  constructor(ankiConnectUrl: string) {
    this.url = ankiConnectUrl;
  }

  private async invoke<T>(action: string, params: Record<string, any> = {}): Promise<T> {
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
    } catch (error) {
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
""")

print("DONE")
