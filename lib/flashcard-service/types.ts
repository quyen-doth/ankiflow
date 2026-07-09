export interface AnkiCardInfo {
  cardId: number
  noteId: number
  deckName: string
  interval: number
  ease: number
  due: number
  lapses: number
  queue: number
  type: number
  /** Unix 秒 — Anki 側でカードが最後に変更された時刻。Optional: 古い AnkiConnect は返さない。 */
  mod?: number
  /** Anki 側での review 総回数。Optional: 古い AnkiConnect は返さない。 */
  reps?: number
}

export interface AnkiNoteInfo {
  noteId: number
  fields: Record<string, { value: string; order: number }>
}

export interface IFlashcardService {
  ping(): Promise<{ connected: boolean; version?: number }>
  getDecks(): Promise<string[]>
  createDeck(deckName: string): Promise<number>
  addNotes(notes: AnkiNote[]): Promise<number[]>
  updateNoteFields(noteId: number, fields: Record<string, string>): Promise<void>
  findNotes(query: string): Promise<number[]>
  notesInfo(noteIds: number[]): Promise<AnkiNoteInfo[]>
  findCards(query: string): Promise<number[]>
  cardsInfo(cardIds: number[]): Promise<AnkiCardInfo[]>
  suspend(cardIds: number[]): Promise<boolean>
  unsuspend(cardIds: number[]): Promise<boolean>
  changeDeck(cardIds: number[], deckName: string): Promise<void>
  deleteDecks(deckNames: string[], cardsToo?: boolean): Promise<void>
  storeMediaFile(filename: string, base64Data: string): Promise<string>
  getModelNames(): Promise<string[]>
  createModel(params: CreateModelParams): Promise<void>
  updateModelStyling(modelName: string, css: string): Promise<void>
  updateModelTemplates(modelName: string, templates: { Name: string; Front: string; Back: string }[]): Promise<void>
}

export interface CreateModelParams {
  modelName: string
  inOrderFields: string[]
  cardTemplates: { Name: string; Front: string; Back: string }[]
  css?: string
}

export interface AnkiNote {
  deckName: string
  modelName: string
  fields: Record<string, string>
  tags?: string[]
  options?: {
    allowDuplicate?: boolean
    duplicateScope?: string
  }
}