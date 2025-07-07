import Page from '@/components/page'
import Section from '@/components/section'
import { useState, useRef, useEffect } from 'react'

interface GeneratedImage {
	url: string;
	width: number;
	height: number;
	content_type: string;
}

interface FalAIResponse {
	images: GeneratedImage[];
	timings: {
		inference: number;
	};
	seed: number;
	has_nsfw_concepts: boolean[];
	prompt: string;
}

interface UserImage {
	id: number | string;
	name: string;
	src: string;
	uploadDate: string;
	uploading?: boolean;
}

interface LoadingStep {
	id: number;
	title: string;
	status: 'pending' | 'loading' | 'completed' | 'error';
	imageUrl?: string;
}

interface LoadingModalProps {
	steps: LoadingStep[];
	currentStep: number;
}

interface ImageModalProps {
	image: GeneratedImage | null;
	onClose: () => void;
}

const ImageModal = ({ image, onClose }: ImageModalProps) => {
	if (!image) return null;

	return (
		<div 
			className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
			onClick={onClose}
		>
			<div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
				<img 
					src={image.url} 
					alt="Full size preview"
					className="w-auto h-auto max-w-[90vw] max-h-[90vh] object-contain"
					style={{ maxWidth: '90vw', maxHeight: '90vh' }}
				/>
				<button
					onClick={onClose}
					className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition"
				>
					<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
	);
};

const LoadingModal = ({ steps, currentStep }: LoadingModalProps) => {
	return (
		<div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
			<div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
				<h2 className="text-xl font-bold mb-6 text-center">Generating Your Avatar</h2>
				
				<div className="space-y-8">
					{steps.map((step, index) => (
						<div key={step.id} className="relative">
							{/* Step connector line */}
							{index < steps.length - 1 && (
								<div className="absolute left-4 top-8 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-700" />
							)}
							
							<div className="flex items-start gap-4">
								{/* Step number circle */}
								<div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
									step.status === 'completed' ? 'bg-green-500' :
									step.status === 'loading' ? 'bg-indigo-500' :
									step.status === 'error' ? 'bg-red-500' :
									'bg-zinc-200 dark:bg-zinc-700'
								}`}>
									{step.status === 'completed' ? (
										<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
										</svg>
									) : step.status === 'loading' ? (
										<div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
									) : (
										<span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{index + 1}</span>
									)}
								</div>

								<div className="flex-1">
									<h3 className="font-medium mb-2">{step.title}</h3>
									{step.imageUrl && (
										<div className="mt-2">
											<img 
												src={step.imageUrl} 
												alt={step.title}
												className="w-full h-auto rounded-lg"
											/>
										</div>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

const CreateAvatar = () => {
	const [isLoading, setIsLoading] = useState(false)
	const [result, setResult] = useState<FalAIResponse | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null)
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const [userImages, setUserImages] = useState<UserImage[]>([])
	const [selectedUserImage, setSelectedUserImage] = useState<UserImage | null>(null)
	const [isDraggingUser, setIsDraggingUser] = useState(false)
	const [isFaceSwapping, setIsFaceSwapping] = useState(false)
	const [faceSwapResult, setFaceSwapResult] = useState<string | null>(null)
	const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([])
	const [currentStep, setCurrentStep] = useState(0)

	useEffect(() => {
		// Load saved user images from localStorage on component mount
		const savedImages = localStorage.getItem('userUploadedImages')
		if (savedImages) {
			try {
				const parsedImages = JSON.parse(savedImages)
				setUserImages(parsedImages)

				// Load the last selected image if available
				const lastSelectedImageId = localStorage.getItem('lastSelectedUserImageId')
				if (lastSelectedImageId) {
					const lastSelectedImage = parsedImages.find(
						(img: UserImage) => img.id.toString() === lastSelectedImageId
					)
					if (lastSelectedImage) {
						setSelectedUserImage(lastSelectedImage)
					}
				}
			} catch (error) {
				console.error('Error parsing images from localStorage:', error)
				localStorage.removeItem('userUploadedImages')
			}
		}
	}, [])

	const cropImageToRatio = async (imageUrl: string): Promise<string> => {
		return new Promise((resolve) => {
			const img = new Image()
			img.onload = () => {
				const canvas = document.createElement('canvas')
				const ctx = canvas.getContext('2d')

				// Calculate dimensions for 3:4 ratio
				const originalRatio = img.width / img.height
				const targetRatio = 3/4

				let sourceX = 0
				let sourceY = 0
				let sourceWidth = img.width
				let sourceHeight = img.height

				if (originalRatio > targetRatio) {
					// Image is wider than target ratio, crop sides
					sourceWidth = img.height * targetRatio
					sourceX = (img.width - sourceWidth) / 2
				} else {
					// Image is taller than target ratio, crop bottom
					sourceHeight = img.width / targetRatio
					sourceY = 0 // Keep the top portion
				}

				// Set canvas size to match source dimensions
				canvas.width = sourceWidth
				canvas.height = sourceHeight

				if (ctx) {
					// Draw the cropped portion
					ctx.drawImage(
						img,
						sourceX,
						sourceY,
						sourceWidth,
						sourceHeight,
						0,
						0,
						sourceWidth,
						sourceHeight
					)
				}

				// Convert to base64
				const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.9)
				resolve(croppedImageUrl)
			}
			img.src = imageUrl
		})
	}

	const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file) return

		// Create a temporary ID for this upload
		const tempId = Date.now()

		// First, show a preview using FileReader
		const reader = new FileReader()
		reader.onload = async (e) => {
			const imageUrl = e.target?.result as string
			// Crop the image to 3:4 ratio
			const croppedImageUrl = imageUrl;//await cropImageToRatio(imageUrl)

			// Create a temporary preview with cropped image
			const tempImage = {
				id: tempId,
				name: file.name,
				src: croppedImageUrl, // Use cropped image
				uploadDate: new Date().toISOString(),
				uploading: true,
			}

			const updatedImages = [...userImages, tempImage]
			setUserImages(updatedImages)
			setSelectedUserImage(tempImage)

			// Convert base64 to blob and upload
			try {
				const response = await fetch(croppedImageUrl)
				const blob = await response.blob()
				const croppedFile = new File([blob], file.name, { type: 'image/jpeg' })

				const formData = new FormData()
				formData.append('image', croppedFile)

				const uploadResponse = await fetch('/api/upload-image', {
					method: 'POST',
					body: formData,
				})

				const data = await uploadResponse.json()

				if (!uploadResponse.ok) {
					throw new Error(data.error || 'Upload failed')
				}

				// Update the image with the cloud URL
				const cloudImage = {
					id: tempId,
					name: data.filename,
					src: data.url, // Cloud URL
					uploadDate: new Date().toISOString(),
					uploading: false,
				}

				setUserImages((prevImages) => {
					const updatedImages = prevImages.map((img) =>
						img.id === tempId ? cloudImage : img,
					)
					localStorage.setItem(
						'userUploadedImages',
						JSON.stringify(updatedImages),
					)
					return updatedImages
				})

				setSelectedUserImage(cloudImage)
				localStorage.setItem('lastSelectedUserImageId', tempId.toString())
			} catch (error) {
				console.error('Error uploading to DigitalOcean:', error)
				setUserImages((prev) => prev.filter((img) => img.id !== tempId))
				if (selectedUserImage && selectedUserImage.id === tempId) {
					setSelectedUserImage(null)
				}
				const errorMessage =
					error instanceof Error ? error.message : 'Unknown error'
				alert('Failed to upload image: ' + errorMessage)
			}
		}
		reader.readAsDataURL(file)
	}

	const handleDeleteUserImage = (id: number | string) => {
		const updatedImages = userImages.filter((img) => img.id !== id)
		setUserImages(updatedImages)

		if (selectedUserImage && selectedUserImage.id === id) {
			setSelectedUserImage(null)
			// Also remove from localStorage if this was the selected image
			localStorage.removeItem('lastSelectedUserImageId')
		}

		// Update localStorage with the filtered list
		const storageImages = updatedImages.map((img) => ({
			id: img.id,
			name: img.name,
			src: img.src,
			uploadDate: img.uploadDate,
		}))

		localStorage.setItem('userUploadedImages', JSON.stringify(storageImages))
	}

	const handleSelectUserImage = (image: UserImage) => {
		setSelectedUserImage(image)
		// Save the selected image ID to localStorage
		localStorage.setItem('lastSelectedUserImageId', image.id.toString())
	}

	const renderUserImageGallery = () => {
		if (userImages.length === 0) {
			return <p className='text-zinc-500 italic'>No images uploaded yet.</p>
		}

		return (
			<div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'>
				{userImages.map((image) => (
					<div
						key={image.id}
						className={`relative border rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
							selectedUserImage && selectedUserImage.id === image.id
								? 'ring-2 ring-indigo-500 transform scale-105'
								: 'hover:shadow-md'
						}`}
						onClick={() => handleSelectUserImage(image)}
					>
						<img
							src={image.src}
							alt={image.name}
							className='w-full h-32 object-cover'
						/>
						{image.uploading && (
							<div className='absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center'>
								<div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white'></div>
							</div>
						)}
						<button
							onClick={(e) => {
								e.stopPropagation()
								handleDeleteUserImage(image.id)
							}}
							className='absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600'
							title='Delete image'
							disabled={image.uploading}
						>
							×
						</button>
						<div className='p-2 text-xs truncate'>{image.name}</div>
					</div>
				))}
			</div>
		)
	}

	const renderSelectedImageFullView = () => {
		if (!selectedUserImage) {
			return (
				<div className='border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg h-96 flex items-center justify-center'>
					<p className='text-zinc-500'>Select an image to view in full size</p>
				</div>
			)
		}

		return (
			<div className='relative border rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800'>
				<div className='flex justify-between items-center p-3 border-b'>
					<h4 className='font-medium'>{selectedUserImage.name}</h4>
					<span className='text-xs text-zinc-500'>
						Uploaded on{' '}
						{new Date(selectedUserImage.uploadDate).toLocaleDateString()}
					</span>
				</div>

				<div className='relative h-96 flex items-center justify-center'>
					<img
						src={selectedUserImage.src}
						alt={selectedUserImage.name}
						className='max-h-full max-w-full object-contain'
					/>
				</div>

				<div className='p-3 bg-zinc-50 dark:bg-zinc-900'>
					<p className='text-sm'>
						This image will be used for try-on features. Make sure it shows a
						full body pose.
					</p>
				</div>
			</div>
		)
	}

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDraggingUser(true)
	}

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDraggingUser(false)
	}

	const handleDrop = async (e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDraggingUser(false)

		const items = e.dataTransfer.items
		if (!items) return

		for (let i = 0; i < items.length; i++) {
			const item = items[i]
			if (item.kind === 'file') {
				const file = item.getAsFile()
				if (file && file.type.startsWith('image/')) {
					// Create a proper event object that matches handleImageUpload's expected type
					const event = {
						target: {
							files: [file]
						}
					} as unknown as React.ChangeEvent<HTMLInputElement>
					await handleImageUpload(event)
				}
			} else {
				item.getAsString(async (text) => {
					// Check if it's a direct image URL
					if (text.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
						try {
							const response = await fetch(text)
							if (!response.ok) throw new Error('Failed to fetch image')
							const blob = await response.blob()
							if (!blob.type.startsWith('image/')) throw new Error('Not an image file')
							const file = new File([blob], 'image.jpg', { type: blob.type })
							const event = {
								target: {
									files: [file]
								}
							} as unknown as React.ChangeEvent<HTMLInputElement>
							await handleImageUpload(event)
						} catch (error) {
							console.error('Error fetching image:', error)
						}
					}
				})
			}
		}
	}

	const uploadImageToCloud = async (imageData: string): Promise<string> => {
		try {
			// Convert base64 to blob
			const base64Data = imageData.split(',')[1]
			const blob = await fetch(`data:image/png;base64,${base64Data}`).then(res => res.blob())
			
			// Create form data
			const formData = new FormData()
			formData.append('image', blob, 'body.png')
			
			// Upload to DigitalOcean Spaces using the existing API endpoint
			const response = await fetch('/api/upload-image', {
				method: 'POST',
				body: formData
			})
			
			if (!response.ok) {
				const error = await response.json()
				throw new Error(error.error || 'Failed to upload image')
			}
			
			const data = await response.json()
			return data.url
		} catch (err) {
			console.error('Error uploading image:', err)
			throw err
		}
	}

	const updateLoadingStep = (stepId: number, updates: Partial<LoadingStep>) => {
		setLoadingSteps(prev => prev.map(step => 
			step.id === stepId ? { ...step, ...updates } : step
		))
	}

	const handleCreateBody = async () => {
		try {
			setIsLoading(true)
			setError(null)
			setResult(null)
			setFaceSwapResult(null)
			setSelectedImage(null)

			// Initialize loading steps
			setLoadingSteps([
				{ id: 1, title: 'Generate Body Shape', status: 'loading' },
				{ id: 2, title: 'Generate Body Image', status: 'pending' },
				{ id: 3, title: 'Change Pose', status: 'pending' },
				{ id: 4, title: 'Mapping User Face', status: 'pending' }
			])
			setCurrentStep(0)

			// Step 1: Generate Body Shape
			const iframeWindow = iframeRef.current?.contentWindow
			if (!iframeWindow) {
				throw new Error('Iframe not found')
			}

			iframeWindow.postMessage({ type: 'SAVE_BODY' }, '*')
			const imageData = await new Promise<string>((resolve, reject) => {
				const handleMessage = (event: MessageEvent) => {
					if (event.data.type === 'BODY_SAVED') {
						window.removeEventListener('message', handleMessage)
						resolve(event.data.imageData)
					}
				}
				window.addEventListener('message', handleMessage)
				setTimeout(() => {
					window.removeEventListener('message', handleMessage)
					reject(new Error('Timeout waiting for body save'))
				}, 10000)
			})

			const imageUrl = await uploadImageToCloud(imageData)
			updateLoadingStep(1, { status: 'completed', imageUrl })
			setCurrentStep(1)
			updateLoadingStep(2, { status: 'loading' })

			// Step 2: Generate Body Image
			const response = await fetch('/api/fal-ai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					"prompt": "A beautiful Asian female fashion model posing confidently in a full body shot, form-fitting casual outfit such as a long-sleeve turtleneck top and tailored pants or jeans, entire body fully visible (no cropping), standing in a professional photography studio, soft diffused studio lighting, clean and elegant pose, neutral background, fashion editorial style, sharp focus, natural skin tones, high resolution",
					"image_size": "square_hd",
					"num_inference_steps": 30,
					"guidance_scale": 7,
					"num_images": 1,
					"enable_safety_checker": true,
					"output_format": "jpeg",
					"control_lora_strength": 0.95,
					"control_lora_image_url": imageUrl,
					"loras": [
						{
							"path": "https://civitai.com/api/download/models/800194?type=Model&format=SafeTensor",
							"scale": 0.9
						}
					]
				})
			})

			const data = await response.json()
			if (!response.ok) {
				throw new Error(data.message || 'Failed to generate image')
			}

			setResult(data)
			updateLoadingStep(2, { status: 'completed', imageUrl: data.images[0].url })
			setCurrentStep(2)
			updateLoadingStep(3, { status: 'loading' })

			// Step 3: Change Pose
			if (data.images && data.images.length > 0) {
				const generatedImage = data.images[0]
				
				const googleAIResponse = await fetch('/api/google-ai', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						imageUrl: generatedImage.url,
						prompt: "change pose of this image to a fashion model pose, face direction look at camera. **Absolutely keep the original clothes exactly as they are.** Only change pose and face direction."
					})
				})

				if (!googleAIResponse.ok) {
					throw new Error('Failed to process with Google AI')
				}

				const googleAIData = await googleAIResponse.json()

				if (googleAIData.imageUrl) {
					try {
						const base64Data = googleAIData.imageUrl.split(',')[1]
						const response = await fetch(`data:image/png;base64,${base64Data}`)
						const blob = await response.blob()
						const file = new File([blob], 'pose.png', { type: 'image/png' })

						const formData = new FormData()
						formData.append('image', file)

						const uploadResult = await fetch('/api/upload-image', {
							method: 'POST',
							body: formData,
						})

						if (!uploadResult.ok) {
							throw new Error('Failed to upload pose image')
						}

						const uploadData = await uploadResult.json()
						updateLoadingStep(3, { status: 'completed', imageUrl: uploadData.url })
						setCurrentStep(3)
						updateLoadingStep(4, { status: 'loading' })

						const newPoseImage: GeneratedImage = {
							url: uploadData.url,
							width: generatedImage.width,
							height: generatedImage.height,
							content_type: 'image/jpeg'
						}

						// Step 4: Mapping User Face
						if (selectedUserImage) {
							await handleFaceSwap(newPoseImage)
							if (faceSwapResult) {
								updateLoadingStep(4, { status: 'completed', imageUrl: faceSwapResult })
							}
						}
					} catch (uploadError) {
						console.error('Error uploading pose image:', uploadError)
						if (selectedUserImage) {
							await handleFaceSwap(generatedImage)
							if (faceSwapResult) {
								updateLoadingStep(4, { status: 'completed', imageUrl: faceSwapResult })
							}
						}
					}
				} else if (selectedUserImage) {
					await handleFaceSwap(generatedImage)
					if (faceSwapResult) {
						updateLoadingStep(4, { status: 'completed', imageUrl: faceSwapResult })
					}
				}
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'An error occurred')
			console.error('Error generating image:', err)
			updateLoadingStep(currentStep + 1, { status: 'error' })
		} finally {
			setIsLoading(false)
		}
	}

	const handleFaceSwap = async (generatedImage: GeneratedImage) => {
		if (!selectedUserImage) {
			alert('Please select a user image first')
			return
		}

		try {
			setIsFaceSwapping(true)
			setError(null)

			const response = await fetch('/api/fal-ai?endpoint=face-swap', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					face_image_0: selectedUserImage.src, // User's face image
					target_image: generatedImage.url, // Generated body image
					workflow_type: "user_hair" // Keep user's hair style
				})
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to swap face')
			}

			const data = await response.json()
			console.log("Face swap data:", data)
			
			if (!data.image || !data.image.url) {
				throw new Error('No output in response')
			}

			// The output is a URL string, use it directly
			setFaceSwapResult(data.image.url)

			// Upload the final face-swapped image
			try {
				const uploadResponse = await fetch(data.image.url)
				const blob = await uploadResponse.blob()
				const file = new File([blob], 'avatar.png', { type: 'image/png' })

				const formData = new FormData()
				formData.append('image', file)

				const uploadResult = await fetch('/api/upload-image', {
					method: 'POST',
					body: formData,
				})

				if (!uploadResult.ok) {
					throw new Error('Failed to upload avatar')
				}

				const uploadData = await uploadResult.json()
				
				// Save the avatar to the new storage format
				const newAvatar = {
					id: Date.now(),
					name: `Avatar ${new Date().toLocaleDateString()}`,
					src: uploadData.url,
					uploadDate: new Date().toISOString()
				}

				// Get existing avatars
				const savedAvatars = localStorage.getItem('user-avatars')
				let avatars = []
				if (savedAvatars) {
					try {
						avatars = JSON.parse(savedAvatars)
					} catch (error) {
						console.error('Error parsing avatars from localStorage:', error)
					}
				}

				// Add new avatar and save
				avatars.push(newAvatar)
				localStorage.setItem('user-avatars', JSON.stringify(avatars))
				localStorage.setItem('lastSelectedAvatarId', newAvatar.id.toString())

			} catch (uploadError) {
				console.error('Error in upload process:', uploadError)
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'An error occurred')
			console.error('Error swapping face:', err)
		} finally {
			setIsFaceSwapping(false)
		}
	}

	return (
		<Page>
			<Section>
				<div className="max-w-6xl mx-auto">
					<h1 className="text-3xl font-bold mb-8">Create Avatar</h1>
					
					{/* User Image Upload Section */}
					<div 
						className={`mt-6 mb-8 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg transition-all duration-200 ${
							isDraggingUser ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : ''
						}`}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
					>
						<h3 className='text-lg font-medium mb-3'>Your Images</h3>

						<div className='mb-4'>
							<label
								htmlFor='imageUpload'
								className='inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition cursor-pointer'
							>
								Upload New Image
								<input
									type='file'
									id='imageUpload'
									accept='image/*'
									onChange={handleImageUpload}
									className='hidden'
								/>
							</label>
							<p className='text-xs text-zinc-500 mt-1'>
								Don&apos;t forget to upload clear, well-lit images for best
								results
							</p>
							<p className='text-xs text-zinc-500 mt-1'>
								Drag and drop images or image URLs here
							</p>
						</div>

						{/* Full-size selected image view */}
						<div className='mb-6'>{renderSelectedImageFullView()}</div>

						<div className='mt-4'>
							<h4 className='text-sm font-medium mb-2'>Your Image Gallery</h4>
							{renderUserImageGallery()}
						</div>
					</div>
					
					<div className="w-full aspect-[4/3] mb-8">
						<iframe
							ref={iframeRef}
							src="/3dbody/index.html"
							className="w-full h-full border-2 border-zinc-200 dark:border-zinc-700 rounded-lg"
							title="Body Visualizer"
							style={{
								maxWidth: '100%',
								height: 'auto',
								minHeight: '300px',
								width: '100%'
							}}
							onWheel={(e) => {
								e.preventDefault();
								e.stopPropagation();
							}}
						/>
					</div>

					<div className="flex flex-col items-center gap-4">
						<button
							onClick={handleCreateBody}
							disabled={isLoading}
							className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isLoading ? (isFaceSwapping ? 'Mapping Face...' : 'Generating Body...') : 'Generate Body'}
						</button>

						{error && (
							<div className="text-red-500 mt-2">
								{error}
							</div>
						)}

						{result && result.images && result.images.length > 0 && (
							<div className="mt-8 w-full">
								<div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
									Generated in {result.timings.inference.toFixed(2)}s
								</div>
								<div className="grid grid-cols-1 gap-6">
									{result.images.map((image, index) => (
										<div 
											key={index} 
											className="relative group cursor-pointer"
											onClick={() => {
												const imageToShow = faceSwapResult ? {
													url: faceSwapResult,
													width: 1024,
													height: 1024,
													content_type: 'image/jpeg'
												} : image;
												setSelectedImage(imageToShow);
											}}
										>
											<img 
												src={faceSwapResult || image.url} 
												alt={`Generated fashion model ${index + 1}`}
												className="w-full h-auto rounded-lg shadow-lg transition-transform duration-300 group-hover:scale-105"
												onError={(e) => {
													console.error(`Error loading image ${index}:`, e);
													e.currentTarget.src = 'https://via.placeholder.com/400x400?text=Image+Failed+to+Load';
												}}
											/>
											<div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity duration-300 rounded-lg" />
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			</Section>

			{selectedImage && (
				<ImageModal 
					image={selectedImage} 
					onClose={() => setSelectedImage(null)} 
				/>
			)}

			{isLoading && (
				<LoadingModal 
					steps={loadingSteps}
					currentStep={currentStep}
				/>
			)}
		</Page>
	)
}

export default CreateAvatar 