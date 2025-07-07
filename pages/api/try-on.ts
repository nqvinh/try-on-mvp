import type { NextApiRequest, NextApiResponse } from 'next'
import { fal } from "@fal-ai/client"

type TryOnRequest = {
	productImageUrl: string
	userImageUrl: string
	category?: string
}

type TryOnResponse = {
	success: boolean
	data?: any
	error?: string
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<TryOnResponse>,
) {
	// Only allow POST requests
	if (req.method !== 'POST') {
		return res.status(405).json({ success: false, error: 'Method not allowed' })
	}

	try {
		const {
			productImageUrl,
			userImageUrl,
			category = 'dress',
		} = req.body as TryOnRequest

		// Validate required fields
		if (!productImageUrl || !userImageUrl) {
			return res.status(400).json({
				success: false,
				error:
					'Missing required fields: productImageUrl and userImageUrl are required',
			})
		}

		// Call the Fal AI API
		const result = await fal.subscribe("fal-ai/kling/v1-5/kolors-virtual-try-on", {
			input: {
				human_image_url: userImageUrl,
				garment_image_url: productImageUrl
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

		return res.status(200).json({
			success: true,
			data: result.data,
		})
	} catch (error) {
		console.error('Try-on API error:', error)
		return res.status(500).json({
			success: false,
			error:
				error instanceof Error ? error.message : 'An unknown error occurred',
		})
	}
}
