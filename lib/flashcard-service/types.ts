export interface IFlashcardService {
  ping(): Promise<{ connected: boolean; version?: number }>
  getDecks(): Promise<string[]>
  createDeck(deckName: string): Promise<number>
  addNotes(notes: AnkiNote[]): Promise<number[]>
  updateNoteFields(noteId: number, fields: Record<string, string>): Promise<void>
  findNotes(query: string): Promise<number[]>
  storeMediaFile(filename: string, base64Data: string): Promise<string>
}

export interface AnkiNote {
  deckName: string
  modelName: string
  fields: Record<string, string>
  tags?: string[]
}