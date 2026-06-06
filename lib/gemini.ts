import { GoogleGenerativeAI } from "@google/generative-ai";
import { getChinesePrompt } from "./prompts/chinese";
import { getJapanesePrompt } from "./prompts/japanese";
import { getEnglishPrompt } from "./prompts/english";
import { getItVocabPrompt } from "./prompts/it-vocab";
import { FormType, LanguageType } from "@/types";

if (!process.env.GEMINI_API_KEY) {
  console.warn("Missing GEMINI_API_KEY in environment variables");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export interface GenerateOptions {
  word?: string;
  term?: string;
  form_type: FormType;
  language?: LanguageType;
  topics?: string[];
}

export const generateCardContent = async (options: GenerateOptions, retries = 2): Promise<Record<string, unknown>> => {
  try {
    let prompt = "";
    
    if (options.form_type === FormType.LANGUAGE && options.word && options.language) {
      if (options.language === LanguageType.CHINESE) {
        prompt = getChinesePrompt(options.word);
      } else if (options.language === LanguageType.JAPANESE) {
        prompt = getJapanesePrompt(options.word);
      } else if (options.language === LanguageType.ENGLISH) {
        prompt = getEnglishPrompt(options.word);
      } else {
        throw new Error(`Unsupported language: ${options.language}`);
      }
    } else if (options.form_type === FormType.IT && options.term) {
      prompt = getItVocabPrompt(options.term, options.topics);
    } else {
      throw new Error("Invalid parameters for generating content");
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      }
    });

    const responseText = result.response.text();
    
    // Parse JSON
    try {
      const parsedData = JSON.parse(responseText);
      return parsedData;
    } catch {
      console.error("Failed to parse Gemini JSON response:", responseText);
      throw new Error("Invalid JSON format from Gemini");
    }
    
  } catch (error) {
    if (retries > 0) {
      console.warn(`Gemini generation failed, retrying... (${retries} left)`);
      return generateCardContent(options, retries - 1);
    }
    throw error;
  }
};
