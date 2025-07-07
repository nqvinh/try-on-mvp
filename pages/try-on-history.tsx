import { useState, useEffect } from 'react'
import Link from 'next/link'
import Page from '@/components/page'
import Section from '@/components/section'

export default function TryOnHistory() {
	const [history, setHistory] = useState<any[]>([])
	const [loading, setLoading] = useState(true)
	const [galleryView, setGalleryView] = useState(false)
	const [currentGalleryImage, setCurrentGalleryImage] = useState(0)
	const [selectedEntry, setSelectedEntry] = useState<any>(null)

	useEffect(() => {
		// Load history from localStorage
		const savedHistory = localStorage.getItem('tryOnHistory')
		if (savedHistory) {
			try {
				const parsedHistory = JSON.parse(savedHistory)
				setHistory(parsedHistory)

				// Check for any processing entries and update them
				const processingEntries = parsedHistory.filter(
					(entry: any) => entry.status === 'processing',
				)
				if (processingEntries.length > 0) {
					updateProcessingEntries(processingEntries, parsedHistory)
				}
			} catch (e) {
				console.error('Error parsing try-on history:', e)
			}
		}
		setLoading(false)
	}, [])

	const updateProcessingEntries = async (
		processingEntries: any[],
		allHistory: any[],
	) => {
		for (const entry of processingEntries) {
			try {
				const response = await fetch(`/api/check-try-on-status?id=${entry.id}`)
				if (response.ok) {
					const result = await response.json()
					if (result.success && result.data && result.data.output) {
						// Update this entry in the history
						const updatedHistory = allHistory.map((historyEntry) => {
							if (historyEntry.id === entry.id) {
								return {
									...historyEntry,
									resultImage: result.data.output,
									status: 'completed',
								}
							}
							return historyEntry
						})

						setHistory(updatedHistory)
						localStorage.setItem('tryOnHistory', JSON.stringify(updatedHistory))
					}
				}
			} catch (error) {
				console.error(`Error updating processing entry ${entry.id}:`, error)
			}
		}
	}

	const formatDate = (dateString: string) => {
		const date = new Date(dateString)
		return date.toLocaleString()
	}

	const clearHistory = () => {
		if (confirm('Are you sure you want to clear your try-on history?')) {
			localStorage.removeItem('tryOnHistory')
			setHistory([])
		}
	}

	const renderHistoryImage = (imageSource: any) => {
		// Check if the image source is a base64 string
		if (
			typeof imageSource === 'string' &&
			(imageSource.startsWith('data:image/') ||
				imageSource.startsWith('data:application/'))
		) {
			// It's a base64 image, use it directly
			return imageSource
		} else if (imageSource) {
			// It's a URL, use it as is
			return imageSource
		} else {
			// No image available
			return null
		}
	}

	const openGallery = (entry: any) => {
		setSelectedEntry(entry)
		setCurrentGalleryImage(2) // Start with the result image
		setGalleryView(true)
	}

	return (
		<Page title='Try-On History'>
			{/* Image Gallery Popup */}
			{galleryView && selectedEntry && (
				<div className='fixed inset-0 bg-black flex flex-col items-center justify-center z-50'>
					<button
						onClick={() => {
							console.log('Closing gallery view')
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
								setCurrentGalleryImage((prev) => (prev === 0 ? 2 : prev - 1))
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
									src={renderHistoryImage(selectedEntry.userImage)}
									alt='Your photo'
									className='max-w-full max-h-full object-contain'
								/>
							)}
							{currentGalleryImage === 1 && (
								<img
									src={renderHistoryImage(selectedEntry.productImage)}
									alt='Product'
									className='max-w-full max-h-full object-contain'
								/>
							)}
							{currentGalleryImage === 2 && (
								<img
									src={renderHistoryImage(selectedEntry.resultImage)}
									alt='Result'
									className='max-w-full max-h-full object-contain'
								/>
							)}
						</div>

						{/* Next button */}
						<button
							onClick={() =>
								setCurrentGalleryImage((prev) => (prev === 2 ? 0 : prev + 1))
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
			)}

			<Section>
				<div className='flex justify-between items-center'>
					<h2 className='text-xl font-semibold'>Your Try-On History</h2>
					{history.length > 0 && (
						<button
							onClick={clearHistory}
							className='px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700'
						>
							Clear History
						</button>
					)}
				</div>

				<div className='mt-2'>
					<p className='text-zinc-600 dark:text-zinc-400'>
						View all your previous virtual try-on sessions.
					</p>
				</div>
			</Section>

			<Section>
				{loading ? (
					<div className='text-center py-10'>
						<p className='text-zinc-600 dark:text-zinc-400'>
							Loading your try-on history...
						</p>
					</div>
				) : history.length === 0 ? (
					<div className='text-center py-10 border rounded-lg bg-gray-50 dark:bg-gray-800'>
						<p className='text-zinc-600 dark:text-zinc-400'>
							You haven&apos;t tried on any items yet.
						</p>
						<Link
							href='/'
							className='mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700'
						>
							Try On Some Items
						</Link>
					</div>
				) : (
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
						{history.map((entry, index) => (
							<div
								key={index}
								className='border rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition'
							>
								<div className='p-4 border-b dark:border-gray-700'>
									<h3 className='font-medium text-gray-900 dark:text-gray-100'>
										{entry.productName}
									</h3>
									<p className='text-sm text-zinc-600 dark:text-zinc-400'>
										{entry.productBrand}
									</p>
									<p className='text-xs text-zinc-500 dark:text-zinc-500 mt-1'>
										{formatDate(entry.timestamp)} •{' '}
										{entry.category.replace('_', ' ')}
									</p>
								</div>

								<div className='grid grid-cols-3 gap-1'>
									<div className='aspect-square'>
										<img
											src={renderHistoryImage(entry.userImage)}
											alt='User'
											className='w-full h-full object-cover'
										/>
										<p className='text-xs text-center py-1 bg-gray-100 dark:bg-gray-700'>
											User
										</p>
									</div>
									<div className='aspect-square'>
										<img
											src={renderHistoryImage(entry.productImage)}
											alt='Product'
											className='w-full h-full object-cover'
										/>
										<p className='text-xs text-center py-1 bg-gray-100 dark:bg-gray-700'>
											Product
										</p>
									</div>
									<div className='aspect-square'>
										{renderHistoryImage(entry.resultImage) ? (
											<>
												<img
													src={renderHistoryImage(entry.resultImage)}
													alt='Result'
													className='w-full h-full object-cover'
												/>
												<p className='text-xs text-center py-1 bg-gray-100 dark:bg-gray-700'>
													Result
												</p>
											</>
										) : (
											<div className='w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700'>
												<p className='text-sm text-zinc-500 dark:text-zinc-400'>
													Processing...
												</p>
											</div>
										)}
									</div>
								</div>

								<div className='p-3 flex justify-end'>
									{renderHistoryImage(entry.resultImage) && (
										<button
											onClick={() => openGallery(entry)}
											className='text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300'
										>
											View Full Result
										</button>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</Section>
		</Page>
	)
}
