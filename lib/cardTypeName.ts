import type { StudyLanguage } from '@/types'
import { languageDisplayName } from '@/lib/studyLanguages'

interface CardTypeNameContext {
  studyLanguage?: string | null;
  outputLanguage?: string | null;
  cardType?: {
    language?: string | null;
    output_language?: string | null;
  };
  languages: StudyLanguage[];
}

/**
 * Card Type 名の言語プレースホルダーを、実行時の言語設定を優先して解決する。
 * 解決できないプレースホルダーは、管理画面での編集を妨げないようそのまま残す。
 */
export function renderCardTypeName(
  name: string,
  ctx: CardTypeNameContext,
): string {
  const studyLanguage = ctx.studyLanguage || ctx.cardType?.language
  const outputLanguage = ctx.outputLanguage || ctx.cardType?.output_language

  return name
    .replaceAll(
      '{study_language}',
      studyLanguage
        ? languageDisplayName(studyLanguage, ctx.languages)
        : '{study_language}',
    )
    .replaceAll(
      '{output_language}',
      outputLanguage
        ? languageDisplayName(outputLanguage, ctx.languages)
        : '{output_language}',
    )
}
