import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface GeneratedProductInfo {
  description: string;
  keyFeatures: string[];
  specifications: { [key: string]: string };
}

export async function generateProductInfo(productName: string, category: string): Promise<GeneratedProductInfo> {
  const prompt = `Generate a professional, high-end product description, key features, and technical specifications for a product named "${productName}" in the category "${category}". 
  The style should be similar to premium tech retailers like Startech or Apple. 
  Focus on quality, performance, and user benefits.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: {
            type: Type.STRING,
            description: "A professional, engaging product description (2-3 paragraphs).",
          },
          keyFeatures: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of 4-6 key highlights or features.",
          },
          specifications: {
            type: Type.OBJECT,
            description: "A map of technical specifications (e.g., 'Resolution': '4K', 'Battery': '5000mAh').",
            properties: {
              // We use a flexible object here
            }
          },
        },
        required: ["description", "keyFeatures", "specifications"],
      },
    },
  });

  try {
    return JSON.parse(response.text) as GeneratedProductInfo;
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
    throw new Error("Failed to generate professional product info.");
  }
}
