import type { NextApiRequest, NextApiResponse } from 'next'
import { GoogleGenAI, Modality } from "@google/genai"

interface GoogleAIRequest {
  imageUrl: string;
  prompt: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const requestData: GoogleAIRequest = req.body

    if (!requestData.imageUrl || !requestData.prompt) {
      return res.status(400).json({ error: 'Both imageUrl and prompt are required' })
    }

    console.log('Sending request to Google AI with data:', requestData)

    // Initialize Google AI
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })

    // Fetch and convert image to base64
    const response = await fetch(requestData.imageUrl)
    const imageArrayBuffer = await response.arrayBuffer()
    const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64')

    // Generate content using Gemini with image generation capability
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64ImageData,
          },
        },
        { text: requestData.prompt }
      ],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    })

    console.log('Received response from Google AI:', result)

    if (!result.candidates || result.candidates.length === 0) {
      console.error('Unexpected response structure:', result)
      throw new Error('Invalid response from Google AI')
    }

    const firstCandidate = result.candidates[0]
    if (!firstCandidate?.content?.parts) {
      console.error('Invalid candidate structure:', firstCandidate)
      throw new Error('Invalid response structure from Google AI')
    }

    // Process both text and image parts
    let responseText = ''
    let generatedImageData = null

    for (const part of firstCandidate.content.parts) {
      if (part.text) {
        responseText = part.text
      } else if (part.inlineData) {
        generatedImageData = part.inlineData.data
      }
    }

    // If we have a generated image, convert it to a data URL
    let imageUrl = null
    if (generatedImageData) {
      imageUrl = `data:image/png;base64,${generatedImageData}`
    }

    res.status(200).json({ 
      text: responseText,
      imageUrl: imageUrl,
      candidates: result.candidates
    })

  } catch (error) {
    console.error('Error processing request:', error)
    res.status(500).json({
      error: 'Failed to process request',
      message: error instanceof Error ? error.message : String(error)
    })
  }
} 