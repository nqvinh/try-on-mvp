import { useState, useEffect } from 'react'
import Page from '@/components/page'
import Section from '@/components/section'
import { useRouter } from 'next/router'

const Index = () => {
	const [loading, setLoading] = useState<boolean>(false)
	const [content, setContent] = useState<string | null>(null)
	const [url, setUrl] = useState<string>(
		'https://www.revolve.com/dresses/br/a8e981/?navsrc=left',
	)
	const [imageData, setImageData] = useState<any>(null)
	const [autoScroll, setAutoScroll] = useState<boolean>(false)
	const [scrollStatus, setScrollStatus] = useState<string>('')
	const [products, setProducts] = useState<any[]>([])
	const [userAvatar, setUserAvatar] = useState<string | null>(null)
	const [selectedUserImage, setSelectedUserImage] = useState<any>(null)
	const [selectedProduct, setSelectedProduct] = useState<any>(null)
	const [selectedClothingType, setSelectedClothingType] =
		useState<string>('dresses')
	const [selectedProductImage, setSelectedProductImage] = useState<
		string | null
	>(null)
	const [tryOnHistory, setTryOnHistory] = useState<any[]>([])
	const [showLoadingPopup, setShowLoadingPopup] = useState<boolean>(false)
	const [showCompletionPopup, setShowCompletionPopup] = useState<boolean>(false)
	const [completionResult, setCompletionResult] = useState<any>(null)
	const [galleryView, setGalleryView] = useState<boolean>(false)
	const [currentGalleryImage, setCurrentGalleryImage] = useState<number>(0)
	const [clothImages, setClothImages] = useState<any[]>([])
	const [selectedClothImage, setSelectedClothImage] = useState<any>(null)
	const [isDraggingUser, setIsDraggingUser] = useState<boolean>(false)
	const [isDraggingCloth, setIsDraggingCloth] = useState<boolean>(false)
	const [progress, setProgress] = useState<number>(0)
	const [showCropModal, setShowCropModal] = useState<boolean>(false)
	const [imageToCrop, setImageToCrop] = useState<string | null>(null)
	const [userAvatars, setUserAvatars] = useState<any[]>([])
	const router = useRouter()

	useEffect(() => {
		// Load saved user avatars from localStorage on component mount
		const savedAvatars = localStorage.getItem('user-avatars')
		if (savedAvatars) {
			try {
				const parsedAvatars = JSON.parse(savedAvatars)
				setUserAvatars(parsedAvatars)

				// Load the last selected avatar if available
				const lastSelectedAvatarId = localStorage.getItem('lastSelectedAvatarId')
				if (lastSelectedAvatarId) {
					const lastSelectedAvatar = parsedAvatars.find(
						(avatar: any) => avatar.id.toString() === lastSelectedAvatarId
					)
					if (lastSelectedAvatar) {
						setUserAvatar(lastSelectedAvatar.src)
						setSelectedUserImage({
							id: lastSelectedAvatar.id,
							name: lastSelectedAvatar.name,
							src: lastSelectedAvatar.src,
							uploadDate: lastSelectedAvatar.uploadDate
						})
					}
				} else if (parsedAvatars.length > 0) {
					// If no last selected avatar, use the first one
					setUserAvatar(parsedAvatars[0].src)
					setSelectedUserImage({
						id: parsedAvatars[0].id,
						name: parsedAvatars[0].name,
						src: parsedAvatars[0].src,
						uploadDate: parsedAvatars[0].uploadDate
					})
					localStorage.setItem('lastSelectedAvatarId', parsedAvatars[0].id.toString())
				}
			} catch (error) {
				console.error('Error parsing avatars from localStorage:', error)
				localStorage.removeItem('user-avatars')
			}
		}

		// Load saved cloth images
		const savedClothImages = localStorage.getItem('clothUploadedImages')
		if (savedClothImages) {
			try {
				const parsedClothImages = JSON.parse(savedClothImages)
				setClothImages(parsedClothImages)

				const lastSelectedClothImageId = localStorage.getItem(
					'lastSelectedClothImageId',
				)
				if (lastSelectedClothImageId) {
					const lastSelectedClothImage = parsedClothImages.find(
						(img: { id: number | string }) =>
							img.id.toString() === lastSelectedClothImageId,
					)
					if (lastSelectedClothImage) {
						setSelectedClothImage(lastSelectedClothImage)
					}
				}
			} catch (error) {
				console.error('Error parsing cloth images from localStorage:', error)
				localStorage.removeItem('clothUploadedImages')
			}
		}

		// Auto fetch images with default URL when page loads
		fetchRevolveContent(false)
	}, [])

	useEffect(() => {
		const savedHistory = localStorage.getItem('tryOnHistory')
		if (savedHistory) {
			try {
				setTryOnHistory(JSON.parse(savedHistory))
			} catch (e) {
				console.error('Error parsing try-on history:', e)
			}
		}
	}, [])

	useEffect(() => {
		let timer: NodeJS.Timeout
		if (showLoadingPopup) {
			setProgress(0)
			const startTime = Date.now()
			const duration = 25000 // 25 seconds

			timer = setInterval(() => {
				const elapsed = Date.now() - startTime
				const newProgress = Math.min((elapsed / duration) * 100, 100)
				setProgress(newProgress)

				if (elapsed >= duration) {
					clearInterval(timer)
				}
			}, 100) // Update every 100ms for smooth progress

			return () => {
				clearInterval(timer)
			}
		}
	}, [showLoadingPopup])

	useEffect(() => {
		if (!selectedUserImage && userAvatar) {
			setSelectedUserImage({
				id: 'avatar',
				name: 'Your Avatar',
				src: userAvatar,
				uploadDate: new Date().toISOString(),
			})
		}
	}, [userAvatar, selectedUserImage])

	const fetchRevolveContent = async (scrolled = false) => {
		setLoading(true)
		try {
			// Use the new crawler API server instead of Next.js proxy
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/crawl?url=${encodeURIComponent(url)}`,
			)
			const data = await response.json()

			console.log('API Response:', data) // Debug log

			if (data.error) {
				throw new Error(data.message || data.error)
			}

			setContent(data.content)
			setImageData(data)
			setProducts(data.products || [])
			setScrollStatus('')
		} catch (error) {
			console.error('Error fetching Revolve content:', error)
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error'
			setContent(`<p class="text-red-500">Error: ${errorMessage}</p>`)
			setScrollStatus('')
			setProducts([])
		} finally {
			setLoading(false)
			setAutoScroll(false)
		}
	}

	const handleAutoScroll = async () => {
		setAutoScroll(true)
		setScrollStatus('Starting auto-scroll to load all content...')
		await fetchRevolveContent(true)
	}

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

	const handleImageUpload = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		// This function is no longer needed since we don't allow direct uploads
		return
	}

	const handleSelectUserImage = (avatar: any) => {
		setUserAvatar(avatar.src)
		setSelectedUserImage({
			id: avatar.id,
			name: avatar.name,
			src: avatar.src,
			uploadDate: avatar.uploadDate
		})
		localStorage.setItem('lastSelectedAvatarId', avatar.id.toString())
	}

	const handleDeleteUserImage = (id: number | string) => {
		const updatedAvatars = userAvatars.filter((avatar) => avatar.id !== id)
		setUserAvatars(updatedAvatars)

		if (selectedUserImage && selectedUserImage.id === id) {
			setUserAvatar(null)
			setSelectedUserImage(null)
			localStorage.removeItem('lastSelectedAvatarId')
		}

		// Update localStorage with the filtered list
		localStorage.setItem('user-avatars', JSON.stringify(updatedAvatars))
	}

	const renderUserImageGallery = () => {
		if (userAvatars.length === 0) {
			return (
				<div className="text-center p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
					<p className='text-zinc-500 italic mb-2'>No avatars available. Create one in the body visualizer.</p>
					<button
						onClick={() => router.push('/create-avatar')}
						className='inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition cursor-pointer'
					>
						Create New Avatar
					</button>
				</div>
			)
		}

		return (
			<div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'>
				{userAvatars.map((avatar) => (
					<div
						key={avatar.id}
						className={`relative border rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
							selectedUserImage && selectedUserImage.id === avatar.id
								? 'ring-2 ring-indigo-500 transform scale-105'
								: 'hover:shadow-md'
						}`}
						onClick={() => handleSelectUserImage(avatar)}
					>
						<img
							src={avatar.src}
							alt={avatar.name}
							className='w-full h-32 object-cover'
						/>
						<button
							onClick={(e) => {
								e.stopPropagation()
								handleDeleteUserImage(avatar.id)
							}}
							className='absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600'
							title='Delete avatar'
						>
							×
						</button>
						<div className='p-2 text-xs truncate'>{avatar.name}</div>
					</div>
				))}
			</div>
		)
	}

	const renderSelectedImageFullView = () => {
		// This function is no longer needed since we have inline avatar view
		return null
	}

	const handleClothImageUpload = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0]
		if (!file) return

		// Check image dimensions before proceeding
		const checkImageDimensions = (file: File): Promise<boolean> => {
			return new Promise((resolve) => {
				const img = new Image()
				img.onload = () => {
					const isWidthValid = img.width >= 500
					if (!isWidthValid) {
						alert('Image width must be at least 500px. Please upload a larger image.')
					}
					resolve(isWidthValid)
				}
				img.onerror = () => {
					alert('Error loading image. Please try again.')
					resolve(false)
				}
				img.src = URL.createObjectURL(file)
			})
		}

		// Check image dimensions
		const isValidDimensions = await checkImageDimensions(file)
		if (!isValidDimensions) return

		// Create a temporary ID for this upload
		const tempId = Date.now()

		// First, show a preview using FileReader
		const reader = new FileReader()
		reader.onload = (e) => {
			// Create a temporary preview with local data URL
			const tempImage = {
				id: tempId,
				name: file.name,
				src: e.target?.result as string, // Local preview URL
				uploadDate: new Date().toISOString(),
				uploading: true,
			}

			console.log('Setting temporary image:', tempImage) // Debug log
			const updatedImages = [...clothImages, tempImage]
			setClothImages(updatedImages)
			setSelectedClothImage(tempImage)
		}
		reader.readAsDataURL(file)

		// Then upload to DigitalOcean
		try {
			const formData = new FormData()
			formData.append('image', file)

			const response = await fetch('/api/upload-image', {
				method: 'POST',
				body: formData,
			})

			const data = await response.json()

			if (!response.ok) {
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

			console.log('Setting cloud image:', cloudImage) // Debug log
			setClothImages((prevImages) => {
				const updatedImages = prevImages.map((img) =>
					img.id === tempId ? cloudImage : img,
				)
				localStorage.setItem(
					'clothUploadedImages',
					JSON.stringify(updatedImages),
				)
				return updatedImages
			})

			setSelectedClothImage(cloudImage)
			localStorage.setItem('lastSelectedClothImageId', tempId.toString())
		} catch (error) {
			console.error('Error uploading to DigitalOcean:', error)
			setClothImages((prev) => prev.filter((img) => img.id !== tempId))
			if (selectedClothImage && selectedClothImage.id === tempId) {
				setSelectedClothImage(null)
			}
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error'
			alert('Failed to upload image: ' + errorMessage)
		}
	}

	const handleDeleteClothImage = (id: number | string) => {
		const updatedImages = clothImages.filter((img) => img.id !== id)
		setClothImages(updatedImages)

		if (selectedClothImage && selectedClothImage.id === id) {
			setSelectedClothImage(null)
			// Also remove from localStorage if this was the selected image
			localStorage.removeItem('lastSelectedClothImageId')
		}

		// Update localStorage with the filtered list
		const storageImages = updatedImages.map((img) => ({
			id: img.id,
			name: img.name,
			src: img.src,
			uploadDate: img.uploadDate,
		}))

		localStorage.setItem('clothUploadedImages', JSON.stringify(storageImages))
	}

	const handleSelectClothImage = (image: any) => {
		setSelectedClothImage(image)
		// Save the selected image ID to localStorage
		localStorage.setItem('lastSelectedClothImageId', image.id.toString())
	}

	const handleTryOn = async () => {
		// If no user image is selected, show a message in the UI instead of alert
		if (!selectedUserImage) {
			return
		}

		// Set the selected product image if not already set
		if (selectedClothImage && !selectedProductImage) {
			setSelectedProductImage(selectedClothImage.src)
		}

		// If no product image is selected, show a message in the UI instead of alert
		if (!selectedProductImage) {
			return
		}

		setLoading(true)
		// Show loading popup
		setShowLoadingPopup(true)

		try {
			const response = await fetch('/api/try-on', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					productImageUrl: selectedProductImage,
					userImageUrl: selectedUserImage.src,
					category: selectedClothingType || 'dresses',
				}),
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(
					errorData.error || `API error! status: ${response.status}`,
				)
			}

			const result = await response.json()
			console.log('Try-on result:', result)

			// Hide loading popup
			setShowLoadingPopup(false)

			if (result.success && result.data && result.data.image && result.data.image.url) {
				// Get the product name with fallbacks
				const productName = selectedProduct?.name || 
					selectedClothImage?.name || 
					selectedProductImage.split('/').pop()?.split('.')[0] || 
					'Custom Cloth'

				// Get the product brand with fallback
				const productBrand = selectedProduct?.brand || 'Unknown Brand'

				// Create a new history entry
				const historyEntry = {
					id: result.data.requestId || Date.now().toString(),
					timestamp: new Date().toISOString(),
					userImage: selectedUserImage.src,
					productImage: selectedProductImage,
					category: selectedClothingType || 'dresses',
					resultImage: result.data.image.url,
					resultImageUrl: result.data.image.url,
					productName: productName,
					productBrand: productBrand,
				}

				// Update history in state and localStorage
				const updatedHistory = [...tryOnHistory, historyEntry]
				setTryOnHistory(updatedHistory)
				localStorage.setItem('tryOnHistory', JSON.stringify(updatedHistory))

				// Show completion popup with the same fallback values
				setCompletionResult({
					userImage: selectedUserImage.src,
					productImage: selectedProductImage,
					resultImage: result.data.image.url,
					productName: productName,
					productBrand: productBrand,
				})
				setShowCompletionPopup(true)
			} else {
				throw new Error('Failed to process try-on: Invalid response format')
			}
		} catch (error) {
			console.error('Error during try-on:', error)
			setShowLoadingPopup(false)
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error'
			alert('Failed to process try-on: ' + errorMessage)
		} finally {
			setLoading(false)
		}
	}

	const renderClothImageGallery = () => {
		console.log('Rendering cloth gallery with images:', clothImages) // Debug log
		if (clothImages.length === 0) {
			return (
				<div className="text-center p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
					<p className='text-zinc-500 italic mb-2'>No cloth images uploaded yet.</p>
					<label
						htmlFor='clothImageUpload'
						className='inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition cursor-pointer'
					>
						Upload New Cloth Image
						<input
							type='file'
							id='clothImageUpload'
							accept='image/*'
							onChange={handleClothImageUpload}
							className='hidden'
						/>
					</label>
				</div>
			)
		}

		return (
			<div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'>
				{clothImages.map((image) => {
					console.log('Rendering cloth image:', image) // Debug log
					return (
						<div
							key={image.id}
							className={`relative border rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
								selectedClothImage && selectedClothImage.id === image.id
									? 'ring-2 ring-indigo-500 transform scale-105'
									: 'hover:shadow-md'
							}`}
							onClick={() => handleSelectClothImage(image)}
						>
							<div className="relative w-full h-32">
								<img
									src={image.src}
									alt={image.name || 'Cloth image'}
									className='w-full h-full object-cover'
									onError={(e) => {
										console.error('Error loading image:', image.src, e);
										e.currentTarget.src = 'https://via.placeholder.com/400x400?text=Image+Failed+to+Load';
									}}
								/>
								{image.uploading && (
									<div className='absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center'>
										<div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white'></div>
									</div>
								)}
							</div>
							<button
								onClick={(e) => {
									e.stopPropagation()
									handleDeleteClothImage(image.id)
								}}
								className='absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600'
								title='Delete image'
								disabled={image.uploading}
							>
								×
							</button>
							<div className='p-2 text-xs truncate'>{image.name || 'Unnamed cloth'}</div>
							{selectedUserImage && (
								<button
									onClick={(e) => {
										e.stopPropagation()
										handleSelectClothImage(image)
										setSelectedProductImage(image.src)
										handleTryOn()
									}}
									className='absolute bottom-2 right-2 bg-indigo-600 text-white px-2 py-1 rounded text-xs hover:bg-indigo-700 transition'
									disabled={image.uploading}
								>
									Try On
								</button>
							)}
						</div>
					)
				})}
			</div>
		)
	}

	const renderSelectedClothImageFullView = () => {
		if (!selectedClothImage) {
			return (
				<div className='border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg h-96 flex flex-col items-center justify-center'>
					<p className='text-zinc-500 mb-4'>Select a cloth image to view in full size</p>
					<label
						htmlFor='clothImageUpload'
						className='inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition cursor-pointer'
					>
						Upload New Cloth Image
						<input
							type='file'
							id='clothImageUpload'
							accept='image/*'
							onChange={handleClothImageUpload}
							className='hidden'
						/>
					</label>
				</div>
			)
		}

		return (
			<div className='relative border rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800'>
				<div className='flex justify-between items-center p-3 border-b'>
					<h4 className='font-medium'>{selectedClothImage.name || 'Unnamed cloth'}</h4>
					<span className='text-xs text-zinc-500'>
						Uploaded on{' '}
						{new Date(selectedClothImage.uploadDate || Date.now()).toLocaleDateString()}
					</span>
				</div>

				<div className='relative h-96 flex items-center justify-center'>
					<img
						src={selectedClothImage.src}
						alt={selectedClothImage.name || 'Cloth image'}
						className='max-h-full max-w-full object-contain'
					/>
				</div>

				<div className='p-3 bg-zinc-50 dark:bg-zinc-900 flex justify-between items-center'>
					<p className='text-sm'>
						This image will be used for try-on features. Make sure it shows the
						clothing item clearly.
					</p>
					{selectedUserImage && (
						<button
							onClick={() => {
								setSelectedProductImage(selectedClothImage.src)
								handleTryOn()
							}}
							className='bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition'
							disabled={selectedClothImage.uploading}
						>
							Try On
						</button>
					)}
				</div>
			</div>
		)
	}

	const renderProducts = () => {
		if (!products || products.length === 0) {
			return <p>No products found.</p>
		}

		const openTryOnModal = (product: any) => {
			if (!selectedUserImage) {
				alert('Please select a user image first to try on this item')
				return
			}

			setSelectedProduct(product)
			setSelectedClothingType('dresses') // Default value
			setSelectedProductImage(product.images[0].src) // Default to first image
			handleTryOn() // Directly call handleTryOn instead of showing modal
		}

		return (
			<>
				<div className='product-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
					{products.map((product, index) => (
						<div
							key={index}
							className='product-item border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition'
						>
							<div className='product-images relative'>
								{product.images && product.images.length > 0 ? (
									<a
										href={product.link}
										target='_blank'
										rel='noopener noreferrer'
										className='block'
									>
										<img
											src={product.images[0].src}
											alt={product.images[0].alt}
											className='w-full h-auto object-cover aspect-[2/3]'
										/>
										{product.images.length > 1 && (
											<img
												src={product.images[1].src}
												alt={product.images[1].alt}
												className='w-full h-auto object-cover aspect-[2/3] absolute inset-0 opacity-0 hover:opacity-100 transition-opacity'
											/>
										)}
									</a>
								) : (
									<div className='bg-gray-200 w-full aspect-[2/3] flex items-center justify-center'>
										<span className='text-gray-500'>No image</span>
									</div>
								)}
							</div>
							<div className='product-details p-4'>
								<div className='brand text-sm text-gray-600'>
									{product.brand}
								</div>
								<h4 className='product-name font-medium'>{product.name}</h4>
								<div className='price mt-2 font-semibold'>{product.price}</div>
								<div className='flex space-x-2 mt-3'>
									<a
										href={product.link}
										target='_blank'
										rel='noopener noreferrer'
										className='inline-block px-4 py-2 bg-black text-white text-sm rounded hover:bg-gray-800 transition'
									>
										View Product
									</a>
									<button
										onClick={() =>
											product.images &&
											product.images.length > 0 &&
											openTryOnModal(product)
										}
										disabled={
											!selectedUserImage ||
											!product.images ||
											product.images.length === 0
										}
										className={`px-4 py-2 text-sm rounded transition ${
											selectedUserImage &&
											product.images &&
											product.images.length > 0
												? 'bg-indigo-600 text-white hover:bg-indigo-700'
												: 'bg-gray-300 text-gray-500 cursor-not-allowed'
										}`}
									>
										Try On
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			</>
		)
	}

	// Helper function to convert Blob to base64
	const convertBlobToBase64 = (blob: Blob) => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()
			reader.onloadend = () => resolve(reader.result)
			reader.onerror = reject
			reader.readAsDataURL(blob)
		})
	}

	const handleDragOver = (e: React.DragEvent, type: 'user' | 'cloth') => {
		if (type === 'cloth') {
			e.preventDefault()
			e.stopPropagation()
			setIsDraggingCloth(true)
		}
	}

	const handleDragLeave = (e: React.DragEvent, type: 'user' | 'cloth') => {
		if (type === 'cloth') {
			e.preventDefault()
			e.stopPropagation()
			setIsDraggingCloth(false)
		}
	}

	const handleDrop = async (e: React.DragEvent, type: 'user' | 'cloth') => {
		if (type === 'cloth') {
			e.preventDefault()
			e.stopPropagation()
			setIsDraggingCloth(false)

			const items = e.dataTransfer.items
			if (!items) return

			for (let i = 0; i < items.length; i++) {
				const item = items[i]
				if (item.kind === 'file') {
					const file = item.getAsFile()
					if (file && file.type.startsWith('image/')) {
						await handleClothImageUpload({ target: { files: [file] } } as any)
					}
				} else if (item.kind === 'string') {
					item.getAsString(async (text) => {
						// Check if it's a direct image URL
						if (text.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
							try {
								const response = await fetch(text)
								if (!response.ok) throw new Error('Failed to fetch image')
								const blob = await response.blob()
								if (!blob.type.startsWith('image/')) throw new Error('Not an image file')
								const file = new File([blob], 'image.jpg', { type: blob.type })
								await handleClothImageUpload({ target: { files: [file] } } as any)
							} catch (error) {
								console.error('Error fetching image:', error)
							}
						}
					})
				}
			}
		}
	}

	return (
		<Page>
			<Section>
				{/* User Avatar Section */}
				<div className='mt-6 mb-8 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg'>
					<h3 className='text-lg font-medium mb-3'>Your Avatars</h3>

					<div className='mb-4'>
						<button
							onClick={() => router.push('/create-avatar')}
							className='inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition cursor-pointer'
						>
							Create New Avatar
						</button>
						<p className='text-xs text-zinc-500 mt-1'>
							Create a new avatar in the body visualizer
						</p>
					</div>

					{/* Avatar Gallery */}
					<div className='mb-6'>
						<h4 className='text-sm font-medium mb-2'>Your Avatar Gallery</h4>
						{renderUserImageGallery()}
					</div>

					{/* Full-size selected avatar view */}
					<div className='mb-6'>
						{userAvatar ? (
							<div className='relative border rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800'>
								<div className='flex justify-between items-center p-3 border-b'>
									<h4 className='font-medium'>{selectedUserImage?.name || 'Your Avatar'}</h4>
									<span className='text-xs text-zinc-500'>
										Created on{' '}
										{selectedUserImage?.uploadDate ? new Date(selectedUserImage.uploadDate).toLocaleDateString() : new Date().toLocaleDateString()}
									</span>
								</div>

								<div className='relative h-96 flex items-center justify-center'>
									<img
										src={userAvatar}
										alt='Your avatar'
										className='max-h-full max-w-full object-contain'
									/>
								</div>

								<div className='p-3 bg-zinc-50 dark:bg-zinc-900'>
									<p className='text-sm'>
										This avatar will be used for try-on features.
									</p>
								</div>
							</div>
						) : (
							<div className='border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg h-96 flex items-center justify-center'>
								<p className='text-zinc-500'>No avatar available. Create one in the body visualizer.</p>
							</div>
						)}
					</div>
				</div>

				{/* Cloth Image Upload Section */}
				<div 
					className={`mt-6 mb-8 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg transition-all duration-200 ${
						isDraggingCloth ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : ''
					}`}
					onDragOver={(e) => handleDragOver(e, 'cloth')}
					onDragLeave={(e) => handleDragLeave(e, 'cloth')}
					onDrop={(e) => handleDrop(e, 'cloth')}
				>
					<h3 className='text-lg font-medium mb-3'>Upload Cloth to Try On</h3>

					<div className='mb-4'>
						<label
							htmlFor='clothImageUpload'
							className='inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition cursor-pointer'
						>
							Upload New Cloth Image
							<input
								type='file'
								id='clothImageUpload'
								accept='image/*'
								onChange={handleClothImageUpload}
								className='hidden'
							/>
						</label>
						<p className='text-xs text-zinc-500 mt-1'>
							Upload clear images of clothing items for best results
						</p>
						<p className='text-xs text-zinc-500 mt-1'>
							Drag and drop images or image URLs here
						</p>
					</div>

					{/* Full-size selected cloth image view */}
					<div className='mb-6'>{renderSelectedClothImageFullView()}</div>

					<div className='mt-4'>
						<h4 className='text-sm font-medium mb-2'>Your Cloth Gallery</h4>
						{renderClothImageGallery()}
					</div>
				</div>

				<div className='mt-4'>
					<div className='mb-4'>
						<div className="flex justify-between items-center mb-4">
							<label
								htmlFor='url'
								className='block text-sm font-medium text-zinc-700 dark:text-zinc-300'
							>
								Revolve Page:
							</label>
							
						</div>
						<div className='flex gap-2'>
							<input
								type='text'
								id='url'
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								className='flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-zinc-800'
								placeholder='Enter Revolve URL'
							/>
							<button
								onClick={() => fetchRevolveContent(false)}
								className='px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700 transition'
								disabled={loading || autoScroll}
							>
								{loading && !autoScroll ? 'Getting Images...' : 'Get Images'}
							</button>
						</div>
						{/* <div className='flex mt-2'>
							<button
								onClick={handleAutoScroll}
								className='px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition'
								disabled={loading || autoScroll}
							>
								{autoScroll ? 'Auto-Scrolling...' : 'Auto-Scroll & Load All'}
							</button>
							{scrollStatus && (
								<div className='ml-3 py-2 text-sm text-indigo-600'>
									{scrollStatus}
								</div>
							)}
						</div> */}
						<p className='text-xs text-zinc-500 mt-1'>
							Example: https://www.revolve.com/dresses/br/071409/
						</p>
					</div>

					{imageData && (
						<div className='mb-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded'>
							<p>
								Found {imageData.productCount} products with{' '}
								{products.reduce(
									(count, product) => count + (product.images?.length || 0),
									0,
								)}{' '}
								images
							</p>
						</div>
					)}

					<div className='mt-2 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4'>
						{loading ? (
							<div className='flex justify-center items-center py-8'>
								<div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500'></div>
							</div>
						) : products && products.length > 0 ? (
							renderProducts()
						) : content ? (
							<div className='revolve-content'>
								<div dangerouslySetInnerHTML={{ __html: content }} />
							</div>
						) : (
							<p className='text-zinc-600 dark:text-zinc-400'>
								Enter a URL and click &quot;Crawl Images&quot; to find products
								and images
							</p>
						)}
					</div>

					<p className='mt-4 text-sm text-zinc-600 dark:text-zinc-400'>
						Note: This crawler is for demonstration purposes only. Please
						respect Revolve&apos;s terms of service and robots.txt.
					</p>
				</div>

				{/* Loading Popup */}
				{showLoadingPopup && (
					<div className='fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50'>
						<div className='bg-white rounded-lg p-6 max-w-md w-full text-center text-black'>
							<h3 className='text-xl font-semibold mb-4 text-gray-900'>
								Creating Your Virtual Try-On
							</h3>

							<div className='flex justify-center space-x-4 mb-6'>
								<div className='relative w-24 h-32 border rounded overflow-hidden flex items-center justify-center bg-gray-50'>
									<img
										src={selectedUserImage?.src}
										alt='Your photo'
										className='max-w-full max-h-full object-contain'
									/>
								</div>

								<div className='flex items-center'>
									<div className='animate-pulse text-2xl text-indigo-600'>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											className='h-8 w-8'
											fill='none'
											viewBox='0 0 24 24'
											stroke='currentColor'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M14 5l7 7m0 0l-7 7m7-7H3'
											/>
										</svg>
									</div>
								</div>

								<div className='relative w-24 h-32 border rounded overflow-hidden flex items-center justify-center bg-gray-50'>
									{selectedClothImage && (
										<img
											src={selectedClothImage.src}
											alt='Cloth'
											className='max-w-full max-h-full object-contain'
										/>
									)}
								</div>
							</div>

							<div className='mb-4'>
								<div className='w-full bg-gray-200 rounded-full h-2.5 mb-2'>
									<div
										className='bg-indigo-600 h-2.5 rounded-full transition-all duration-100'
										style={{ width: `${progress}%` }}
									></div>
								</div>
								<p className='text-sm text-gray-600'>
									{Math.round(progress)}% Complete
								</p>
							</div>

							<div className='flex justify-center mb-4'>
								<div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500'></div>
							</div>

							<p className='text-gray-700'>
								Please wait while we create your virtual try-on...
							</p>
							<p className='text-sm text-gray-500 mt-2'>
								This process typically takes about 25 seconds
							</p>
						</div>
					</div>
				)}

				{/* Completion Popup */}
				{showCompletionPopup && completionResult && (
					<div className='fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50'>
						{galleryView ? (
							/* Full-screen Gallery View */
							<div className='fixed inset-0 bg-black flex flex-col items-center justify-center z-50'>
								<button
									onClick={() => {
										console.log('Closing gallery view') // Debug log
										setGalleryView(false)
									}}
									className='absolute top-4 right-4 bg-white bg-opacity-20 rounded-full p-2 text-white hover:bg-opacity-30 transition z-50'
								>
									<svg
										xmlns='http://www.w3.org/2000/svg'
										className='h-6 w-6'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M6 18L18 6M6 6l12 12'
										/>
									</svg>
								</button>

								<div className='relative w-full h-full flex items-center justify-center'>
									{/* Previous button */}
									<button
										onClick={() =>
											setCurrentGalleryImage((prev) =>
												prev === 0 ? 2 : prev - 1,
											)
										}
										className='absolute left-4 bg-white bg-opacity-20 rounded-full p-2 text-white hover:bg-opacity-30 transition'
									>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											className='h-8 w-8'
											fill='none'
											viewBox='0 0 24 24'
											stroke='currentColor'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M15 19l-7-7 7-7'
											/>
										</svg>
									</button>

									{/* Image container */}
									<div className='w-full h-full flex items-center justify-center p-8'>
										{currentGalleryImage === 0 && (
											<img
												src={completionResult.userImage}
												alt='Your photo'
												className='max-w-full max-h-full object-contain'
											/>
										)}
										{currentGalleryImage === 1 && (
											<img
												src={completionResult.productImage}
												alt='Product'
												className='max-w-full max-h-full object-contain'
											/>
										)}
										{currentGalleryImage === 2 &&
											completionResult.resultImage && (
												<img
													src={completionResult.resultImage}
													alt='Result'
													className='max-w-full max-h-full object-contain'
												/>
											)}
										{currentGalleryImage === 2 &&
											!completionResult.resultImage && (
												<div className='text-center text-white'>
													<div className='animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mx-auto mb-4'></div>
													<p className='text-xl'>
														Processing your try-on result...
													</p>
												</div>
											)}
									</div>

									{/* Next button */}
									<button
										onClick={() =>
											setCurrentGalleryImage((prev) =>
												prev === 2 ? 0 : prev + 1,
											)
										}
										className='absolute right-4 bg-white bg-opacity-20 rounded-full p-2 text-white hover:bg-opacity-30 transition'
									>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											className='h-8 w-8'
											fill='none'
											viewBox='0 0 24 24'
											stroke='currentColor'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M9 5l7 7-7 7'
											/>
										</svg>
									</button>
								</div>

								{/* Image indicators */}
								<div className='absolute bottom-8 flex space-x-2'>
									<button
										onClick={() => setCurrentGalleryImage(0)}
										className={`w-3 h-3 rounded-full ${
											currentGalleryImage === 0
												? 'bg-white'
												: 'bg-white bg-opacity-50'
										}`}
										aria-label='View user image'
									></button>
									<button
										onClick={() => setCurrentGalleryImage(1)}
										className={`w-3 h-3 rounded-full ${
											currentGalleryImage === 1
												? 'bg-white'
												: 'bg-white bg-opacity-50'
										}`}
										aria-label='View product image'
									></button>
									<button
										onClick={() => setCurrentGalleryImage(2)}
										className={`w-3 h-3 rounded-full ${
											currentGalleryImage === 2
												? 'bg-white'
												: 'bg-white bg-opacity-50'
										}`}
										aria-label='View result image'
									></button>
								</div>

								{/* Image labels */}
								<div className='absolute bottom-16 text-white font-medium'>
									{currentGalleryImage === 0 && 'Your Photo'}
									{currentGalleryImage === 1 && 'Product'}
									{currentGalleryImage === 2 && 'Result'}
								</div>
							</div>
						) : (
							/* Regular Popup View */
							<div className='bg-white rounded-lg p-6 max-w-3xl w-full text-black relative'>
								<button
									onClick={() => setShowCompletionPopup(false)}
									className='absolute top-3 right-3 text-gray-500 hover:text-gray-700'
								>
									<svg
										xmlns='http://www.w3.org/2000/svg'
										className='h-6 w-6'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M6 18L18 6M6 6l12 12'
										/>
									</svg>
								</button>

								<h3 className='text-xl font-semibold mb-4 text-gray-900'>
									Try-On Complete: {completionResult.productName}
								</h3>

								{/* Input images in a row */}
								<div className='grid grid-cols-2 gap-4 mb-4'>
									<div
										className='border rounded overflow-hidden h-48 flex flex-col cursor-pointer hover:shadow-md transition'
										onClick={() => {
											setCurrentGalleryImage(0)
											setGalleryView(true)
										}}
									>
										<div className='flex-1 bg-gray-50 flex items-center justify-center'>
											<img
												src={completionResult.userImage}
												alt='Your photo'
												className='max-w-full max-h-full object-contain'
											/>
										</div>
										<p className='text-center py-1 bg-gray-100 text-sm'>
											Your Photo (Click to enlarge)
										</p>
									</div>

									<div
										className='border rounded overflow-hidden h-48 flex flex-col cursor-pointer hover:shadow-md transition'
										onClick={() => {
											setCurrentGalleryImage(1)
											setGalleryView(true)
										}}
									>
										<div className='flex-1 bg-gray-50 flex items-center justify-center'>
											<img
												src={completionResult.productImage}
												alt='Product'
												className='max-w-full max-h-full object-contain'
											/>
										</div>
										<p className='text-center py-1 bg-gray-100 text-sm'>
											Product (Click to enlarge)
										</p>
									</div>
								</div>

								{/* Result image larger below */}
								<div
									className='border rounded overflow-hidden mb-6 cursor-pointer hover:shadow-md transition'
									onClick={() => {
										if (completionResult.resultImage) {
											setCurrentGalleryImage(2)
											setGalleryView(true)
										}
									}}
								>
									{completionResult.resultImage ? (
										<div className='flex flex-col'>
											<div
												className='bg-gray-50 flex items-center justify-center'
												style={{ height: '350px' }}
											>
												<img
													src={completionResult.resultImage}
													alt='Result'
													className='max-w-full max-h-full object-contain'
												/>
											</div>
											<p className='text-center py-2 bg-gray-100 text-sm font-medium'>
												Result (Click to enlarge)
											</p>
										</div>
									) : (
										<div
											className='flex items-center justify-center bg-gray-50'
											style={{ height: '350px' }}
										>
											<div className='text-center'>
												<div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4'></div>
												<p className='text-gray-500'>
													Processing your try-on result...
												</p>
											</div>
										</div>
									)}
								</div>

								<div className='flex justify-end space-x-3'>
									<button
										onClick={() => setShowCompletionPopup(false)}
										className='px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100'
									>
										Close
									</button>
									<button
										onClick={() => {
											setShowCompletionPopup(false)
											router.push('/try-on-history')
										}}
										className='px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700'
									>
										View Try-On History
									</button>
								</div>
							</div>
						)}
					</div>
				)}
			</Section>
		</Page>
	)
}

export default Index
