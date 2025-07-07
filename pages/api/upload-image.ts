import { NextApiRequest, NextApiResponse } from 'next'
import { S3 } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import formidable from 'formidable'
import fs from 'fs'

export const config = {
	api: {
		bodyParser: false,
	},
}

// Formidable has changed its API in recent versions
// This helper function extracts the file regardless of version
const getFormidableFile = (files: formidable.Files): any => {
	// For newer versions of formidable (v2+)
	if (files.image && Array.isArray(files.image)) {
		return files.image[0]
	}

	// For older versions of formidable
	if (files.image) {
		return files.image
	}

	// If image is not found, try to get the first file
	const fileKey = Object.keys(files)[0]
	if (fileKey && files[fileKey]) {
		if (Array.isArray(files[fileKey])) {
			return files[fileKey]![0]
		}
		return files[fileKey]
	}

	return null
}

const s3Client = new S3({
	endpoint: process.env.DO_SPACES_ENDPOINT || '',
	region: process.env.DO_SPACES_REGION || '',
	credentials: {
		accessKeyId: process.env.DO_SPACES_KEY || '',
		secretAccessKey: process.env.DO_SPACES_SECRET || '',
	},
})

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	try {
		// Create a new formidable instance with options
		const form = formidable({
			keepExtensions: true,
			maxFileSize: 10 * 1024 * 1024, // 10MB limit
		})

		// Parse the form
		const [fields, files] = await new Promise<
			[formidable.Fields, formidable.Files]
		>((resolve, reject) => {
			form.parse(req, (err, fields, files) => {
				if (err) reject(err)
				resolve([fields, files])
			})
		})

		// Log the files object to help debug
		console.log('Files received:', JSON.stringify(files, null, 2))

		// Get the file using our helper function
		const file = getFormidableFile(files)

		if (!file) {
			return res.status(400).json({ error: 'No file uploaded' })
		}

		// Check for filepath (or path in newer versions)
		const filepath = file.filepath || file.path

		if (!filepath) {
			console.error('File object structure:', file)
			return res.status(400).json({
				error: 'Invalid file object, missing filepath',
				fileObject: JSON.stringify(file, null, 2),
			})
		}

		// Generate a unique filename
		const timestamp = Date.now()
		const originalFilename = file.originalFilename || file.name || 'unnamed'
		const filename = `user-uploads/${timestamp}-${originalFilename}`

		// Read the file
		const fileContent = fs.readFileSync(filepath)

		// Upload to DigitalOcean Spaces
		const upload = new Upload({
			client: s3Client,
			params: {
				Bucket: process.env.DO_SPACES_BUCKET || '',
				Key: filename,
				Body: fileContent,
				ACL: 'public-read',
				ContentType: file.mimetype || file.type || 'application/octet-stream',
			},
		})

		await upload.done()

		// Construct the public URL
		const endpoint = process.env.DO_SPACES_ENDPOINT || ''
		const bucket = process.env.DO_SPACES_BUCKET || ''

		let fileUrl = ''
		if (endpoint && bucket) {
			fileUrl = `${endpoint.replace(
				'https://',
				`https://${bucket}.`,
			)}${filename}`
		} else {
			throw new Error(
				'Missing DO_SPACES_ENDPOINT or DO_SPACES_BUCKET environment variables',
			)
		}

		return res.status(200).json({
			success: true,
			url: fileUrl,
			filename: originalFilename,
			id: timestamp,
		})
	} catch (error) {
		console.error('Upload error:', error)
		return res.status(500).json({
			error: 'Upload failed',
			details: error instanceof Error ? error.message : String(error),
		})
	}
}
