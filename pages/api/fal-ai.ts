import type { NextApiRequest, NextApiResponse } from 'next'
import { fal } from "@fal-ai/client"

type ImageSize = "square_hd" | "square" | "portrait_4_3" | "portrait_16_9" | "landscape_4_3" | "landscape_16_9"
type OutputFormat = "jpeg" | "png"
type Gender = "" | "male" | "female" | "non-binary"
type WorkflowType = "user_hair" | "target_hair"

interface FalAIRequest {
  prompt: string;
  image_size?: ImageSize;
  num_inference_steps?: number;
  guidance_scale?: number;
  num_images?: number;
  enable_safety_checker?: boolean;
  output_format?: OutputFormat;
  control_lora_strength?: number;
  control_lora_image_url?: string;
  loras?: Array<{ path: string }>;
}

interface TryOnRequest {
  human_image_url: string;
  garment_image_url: string;
}

interface FaceSwapRequest {
  face_image_0: string;
  gender_0?: Gender;
  target_image: string;
  workflow_type?: WorkflowType;
}

interface FaceSwapResponse {
  image: {
    url: string;
    content_type?: string;
    file_name?: string;
    file_size?: number;
    width?: number;
    height?: number;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { endpoint } = req.query

  try {
    if (endpoint === 'face-swap') {
      const requestData: FaceSwapRequest = req.body

      if (!requestData.face_image_0 || !requestData.target_image) {
        return res.status(400).json({ error: 'Both face_image_0 and target_image are required' })
      }

      console.log('Sending request to Fal AI Face Swap with data:', requestData)

      const result = await fal.subscribe("easel-ai/advanced-face-swap", {
        input: {
          face_image_0: requestData.face_image_0 as any,
          gender_0: requestData.gender_0 || "",
          target_image: requestData.target_image as any,
          workflow_type: requestData.workflow_type || "user_hair"
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log) => log.message).forEach(console.log)
          }
        },
      })

      console.log('Received response from Fal AI Face Swap:', result)

      if (!result.data || !result.data.image) {
        console.error('Unexpected response structure:', result)
        throw new Error('Invalid response from Fal AI Face Swap')
      }

      const response: FaceSwapResponse = result.data
      res.status(200).json(response)
    } else if (endpoint === 'try-on') {
      const requestData: TryOnRequest = req.body

      if (!requestData.human_image_url || !requestData.garment_image_url) {
        return res.status(400).json({ error: 'Both human_image_url and garment_image_url are required' })
      }

      console.log('Sending request to Fal AI Try-On with data:', requestData)

      const result = await fal.subscribe("fal-ai/kling/v1-5/kolors-virtual-try-on", {
        input: {
          human_image_url: requestData.human_image_url,
          garment_image_url: requestData.garment_image_url
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log) => log.message).forEach(console.log)
          }
        },
      })

      console.log('Received response from Fal AI Try-On:', result)

      if (!result.data) {
        console.error('Unexpected response structure:', result)
        throw new Error('Invalid response from Fal AI Try-On')
      }

      res.status(200).json(result.data)
    } else {
      // Original image generation endpoint
      const requestData: FalAIRequest = req.body

      if (!requestData.prompt) {
        return res.status(400).json({ error: 'Prompt is required' })
      }

      console.log('Sending request to Fal AI with data:', requestData)

      const result = await fal.subscribe("fal-ai/flux-control-lora-canny", {
        input: {
          prompt: requestData.prompt,
          image_size: requestData.image_size || "square_hd",
          num_inference_steps: requestData.num_inference_steps || 28,
          guidance_scale: requestData.guidance_scale || 3.5,
          num_images: requestData.num_images || 4,
          enable_safety_checker: requestData.enable_safety_checker ?? true,
          output_format: requestData.output_format || "jpeg",
          control_lora_strength: requestData.control_lora_strength || 1,
          control_lora_image_url: requestData.control_lora_image_url,
          loras: requestData.loras
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log) => log.message).forEach(console.log)
          }
        },
      })

      console.log('Received response from Fal AI:', result)

      if (!result.data || !result.data.images) {
        console.error('Unexpected response structure:', result)
        throw new Error('Invalid response from Fal AI')
      }

      res.status(200).json(result.data)
    }
  } catch (error) {
    console.error('Error processing request:', error)
    res.status(500).json({
      error: 'Failed to process request',
      message: error instanceof Error ? error.message : String(error)
    })
  }
} 