import type { NextApiRequest, NextApiResponse } from 'next'
import Replicate from "replicate"

interface ReplicateRequest {
  swap_image: string;
  input_image: string;
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const requestData: ReplicateRequest = req.body

    if (!requestData.swap_image || !requestData.input_image) {
      return res.status(400).json({ error: 'Both swap_image and input_image are required' })
    }

    console.log('Sending request to Replicate AI with data:', requestData)

    const output:any = await replicate.run(
      "cdingram/face-swap:d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111",
      {
        input: {
          swap_image: requestData.swap_image,
          input_image: requestData.input_image
        }
      }
    )
    console.log("url ",output.url()); //=> "http://example.com"

    console.log('Received response from Replicate AI:', output)

    res.status(200).json({ output: output.url() })
  } catch (error) {
    console.error('Error generating face swap with Replicate AI:', error)
    res.status(500).json({
      error: 'Failed to generate face swap',
      message: error instanceof Error ? error.message : String(error)
    })
  }
} 