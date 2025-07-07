import { useState, useEffect, useRef, useCallback } from 'react'
import Page from '@/components/page'
import Section from '@/components/section'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { useRouter } from 'next/router'
import { ModelLoader } from '@/utils/model-loader'
import { MeasurementManager } from '@/utils/measurement-manager'
import { MultivariateGaussian } from '@/utils/multivariate-gaussian'
import debounce from 'lodash/debounce'
import { ShapeLoader } from '@/body-shape-script/shape-loader'
import { Gender } from '@/body-shape-script/types'
import { ModelBridge } from '@/utils/model-bridge'
import { Model } from '@/body-shape-script/model'

const BodyVisualizer = () => {
	const router = useRouter()
	const containerRef = useRef<HTMLDivElement>(null)
	const [gender, setGender] = useState<Gender>('female')
	const [scene, setScene] = useState<THREE.Scene | null>(null)
	const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null)
	const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null)
	const [controls, setControls] = useState<OrbitControls | null>(null)
	const [modelLoader, setModelLoader] = useState<ModelLoader | null>(null)
	const [measurementManager, setMeasurementManager] =
		useState<MeasurementManager | null>(null)
	const [gaussianModel, setGaussianModel] =
		useState<MultivariateGaussian | null>(null)
	const [measurementVersion, setMeasurementVersion] = useState(0)
	const [updateInProgress, setUpdateInProgress] = useState(false)
	const [oldScaleFactors, setOldScaleFactors] = useState<number[]>([])
	const [scaleFactors, setScaleFactors] = useState<number[]>([])
	const [hideBody, setHideBody] = useState(false)
	const [slideCounters, setSlideCounters] = useState<number[]>(Array(6).fill(0))
	const [cachedSliderValues, setCachedSliderValues] = useState<number[]>(
		Array(6).fill(0),
	)
	const diff = 5 // Default difference for scaling
	const [bmi, setBmi] = useState(0)
	const [modelBridge, setModelBridge] = useState<ModelBridge | null>(null)

	// Add these refs for 3D rendering
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
	const sceneRef = useRef<THREE.Scene | null>(null)
	const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
	const controlsRef = useRef<OrbitControls | null>(null)
	const meshRef = useRef<THREE.Mesh | null>(null)
	const modelRef = useRef<any>(null)

	// Initialize Gaussian model when modelLoader is ready
	useEffect(() => {
		if (modelLoader && measurementManager) {
			// Use the measurement manager's mu and sigma for the Gaussian model
			const means = measurementManager.getMu()
			const covariance = measurementManager.getSigma()
			const unconditionedIndices = measurementManager.getUnconditionedIndices()

			const gaussian = new MultivariateGaussian(
				means,
				covariance,
				unconditionedIndices,
			)

			setGaussianModel(gaussian)

			// Initialize cached slider values from measurement manager
			const measurements = measurementManager.getAllMeasurements()
			const newCachedValues = measurements.map((m) => m.value)
			setCachedSliderValues(newCachedValues)

			// Trigger initial measurement update
			setMeasurementVersion((prev) => prev + 1)
		}
	}, [modelLoader, measurementManager])

	const handleMeasurementChange = useCallback(
		debounce((name: string, value: number, index: number) => {
			if (!updateInProgress && gaussianModel && measurementManager) {
				setUpdateInProgress(true)
				setOldScaleFactors(scaleFactors)
				const newScaleFactors = Array(6).fill(0)

				// Condition or uncondition the measurement
				if (value === null) {
					gaussianModel.unconditionOnIndices([index])
					measurementManager.markSliderAsUnfixed(name)
				} else {
					gaussianModel.conditionOnIndices([index], [value])
					measurementManager.markSliderAsFixed(name)
				}

				// Get all values and update sliders
				const allValues = gaussianModel.getAllValues()
				const measurements = measurementManager.getAllMeasurements()

				measurements.forEach((m, i) => {
					let sliderValue = allValues[i]
					if (m.name === 'weight') {
						sliderValue = Math.pow(sliderValue, 3)
					} else if (m.name === 'exercise' || m.name === 'age') {
						sliderValue = sliderValue
					} else {
						sliderValue = sliderValue / 10.0
					}
					newScaleFactors[i] =
						(allValues[i] - gaussianModel.getMeans()[i]) / diff
				})
				setScaleFactors(newScaleFactors)

				// Calculate BMI and handle body visibility
				const bmi = measurementManager.calculateBMI()
				const shouldHideBody = bmi <= 17.5

				if (shouldHideBody !== hideBody) {
					setHideBody(shouldHideBody)
				}

				// Animate model update
				const numberOfIncrements = 8
				let currentIncrement = 0

				const updateModel = () => {
					if (currentIncrement <= numberOfIncrements) {
						const interpolatedFactors = oldScaleFactors.map((old, i) => {
							const end = newScaleFactors[i]
							return old + (currentIncrement / numberOfIncrements) * (end - old)
						})

						// Update model with interpolated factors
						if (modelLoader?.currentModel) {
							interpolatedFactors.forEach((factor, i) => {
								modelLoader.setScalefactor(i, factor)
							})
						}

						currentIncrement++
						setTimeout(updateModel, 30)
					} else {
						setUpdateInProgress(false)
					}
				}

				updateModel()
			}
		}, 100),
		[
			updateInProgress,
			scaleFactors,
			gaussianModel,
			modelLoader,
			diff,
			hideBody,
			measurementManager,
		],
	)

	const handleSliderChange = useCallback(
		(name: string, value: number) => {
			if (!measurementManager) return

			// Update the measurement in the measurement manager
			const measurement = measurementManager.getMeasurement(name)
			if (measurement) {
				measurement.value = value
				measurement.isFixed = true

				// Mark this slider as fixed
				measurementManager.markSliderAsFixed(name)

				// Update conditioned values for statistical model
				measurementManager.updateConditionedValues()

				// Get the measurement index
				const measurementIndex = measurementManager.getMeasurementIndex(name)

				// Update the model bridge if available
				if (modelBridge && measurementIndex !== -1) {
					const scaledValue = measurementManager.getScaledValue(name)
					modelBridge.setScalefactor(measurementIndex, scaledValue / 100.0)
				}

				if (modelRef.current && measurementIndex !== -1) {
					const scaledValue = measurementManager.getScaledValue(name)

					modelRef.current.setScalefactor(measurementIndex, scaledValue / 100.0)
				}

				// Update BMI if needed
				if (name === 'height' || name === 'weight') {
					setBmi(measurementManager.calculateBMI())
				}
			}
		},
		[measurementManager, modelBridge],
	)

	const handleSliderStart = useCallback(
		(index: number) => {
			const newSlideCounters = [...slideCounters]
			newSlideCounters[index] = 0
			setSlideCounters(newSlideCounters)
		},
		[slideCounters],
	)

	const handleSliderStop = useCallback(
		(index: number) => {
			const newSlideCounters = [...slideCounters]
			newSlideCounters[index] = 0
			setSlideCounters(newSlideCounters)
		},
		[slideCounters],
	)

	// Add this new function to handle direct input changes
	const handleInputChange = useCallback(
		(name: string, value: string) => {
			const numValue = parseFloat(value)
			if (!isNaN(numValue)) {
				const measurement = measurementManager?.getMeasurement(name)
				if (measurement) {
					// Clamp value between min and max
					const clampedValue = Math.min(
						Math.max(numValue, measurement.min),
						measurement.max,
					)
					handleSliderChange(name, clampedValue)
				}
			}
		},
		[handleSliderChange],
	)

	useEffect(() => {
		if (!containerRef.current) return
	}, [])

	// Update model when gender changes
	useEffect(() => {
		if (modelLoader) {
			console.log('Gender changed, reloading model...')
			modelLoader.loadModel()
		}
	}, [gender])

	// Update model when measurements change
	useEffect(() => {
		if (
			modelLoader &&
			gaussianModel &&
			measurementManager &&
			!updateInProgress
		) {
			setUpdateInProgress(true)
			setOldScaleFactors(scaleFactors)
			const newScaleFactors = Array(6).fill(0)

			const measurements = measurementManager.getAllMeasurements()
			const fixedMeasurements = measurementManager.getFixedMeasurements()

			// Create measurement object for Gaussian model
			const measurementObj = measurements.reduce(
				(acc, m) => {
					// Convert values based on measurement type before passing to Gaussian model
					let convertedValue = m.value
					if (m.name === 'weight') {
						convertedValue = Math.pow(m.value, 1 / 3)
					} else if (
						m.name === 'height' ||
						(m.name !== 'exercise' && m.name !== 'age')
					) {
						convertedValue = m.value * 10.0
					}
					acc[m.name] = fixedMeasurements.includes(m.name)
						? convertedValue
						: null
					return acc
				},
				{} as { [key: string]: number | null },
			)

			// Get predicted measurements
			const predictedMeasurements =
				gaussianModel.conditionOnMeasurements(measurementObj)

			if (predictedMeasurements) {
				// Update unfixed measurements with predictions
				measurements.forEach((m, i) => {
					if (!fixedMeasurements.includes(m.name)) {
						// Convert back from Gaussian model values to display values
						let displayValue = predictedMeasurements[i]
						if (m.name === 'weight') {
							displayValue = Math.pow(displayValue, 3)
						} else if (m.name !== 'exercise' && m.name !== 'age') {
							displayValue = displayValue / 10.0
						}
						measurementManager.setMeasurement(m.name, displayValue)
					}
				})
			}

			// Calculate scale factors for model updates
			measurements.forEach((m, i) => {
				let gaussianValue = m.value
				if (m.name === 'weight') {
					gaussianValue = Math.pow(m.value, 1 / 3)
				} else if (
					m.name === 'height' ||
					(m.name !== 'exercise' && m.name !== 'age')
				) {
					gaussianValue = m.value * 10.0
				}
				newScaleFactors[i] =
					(gaussianValue - gaussianModel.getMeans()[i]) / diff
			})
			setScaleFactors(newScaleFactors)

			// Calculate BMI and handle body visibility
			let heightVal = 0
			let weightVal = 0
			measurements.forEach((m) => {
				if (m.name === 'weight') {
					weightVal = m.value // Use actual weight value
				} else if (m.name === 'height') {
					heightVal = m.value // Use actual height value
				}
			})

			const bmi = weightVal / Math.pow(heightVal / 100, 2) // Proper BMI calculation
			const shouldHideBody = bmi <= 17.5

			if (shouldHideBody !== hideBody) {
				setHideBody(shouldHideBody)
			}

			// Animate model update
			const numberOfIncrements = 8
			let currentIncrement = 0

			const updateModel = () => {
				if (currentIncrement <= numberOfIncrements) {
					const interpolatedFactors = oldScaleFactors.map((old, i) => {
						const end = newScaleFactors[i]
						return old + (currentIncrement / numberOfIncrements) * (end - old)
					})

					// Update model with interpolated factors
					if (modelLoader.currentModel) {
						interpolatedFactors.forEach((factor, i) => {
							modelLoader.setScalefactor(i, factor)
						})
					}


					
					currentIncrement++
					requestAnimationFrame(updateModel)
				} else {
					setUpdateInProgress(false)
				}
			}

			requestAnimationFrame(updateModel)
		}
	}, [
		measurementVersion,
		modelLoader,
		gaussianModel,
		measurementManager,
		updateInProgress,
		scaleFactors,
		oldScaleFactors,
		diff,
		hideBody,
	])

	const handleUnitChange = () => {
		measurementManager?.toggleUnits()
	}

	useEffect(() => {
		const newMeasurementManager = new MeasurementManager(gender)
		setMeasurementManager(newMeasurementManager)

		// Calculate initial BMI
		setBmi(newMeasurementManager.calculateBMI())

		return () => {
			// Clean up renderer on unmount
			if (rendererRef.current) {
				rendererRef.current.dispose()
			}
		}
	}, [gender])

	useEffect(() => {
		if (measurementManager && containerRef.current) {
			initializeBodyVisualizer()
		}
	}, [measurementManager, containerRef.current])

	useEffect(() => {
		// Hide body if BMI is too low
		setHideBody(bmi <= 17.5)
	}, [bmi])

	// Initialize the body visualizer
	const initializeBodyVisualizer = async () => {
		if (!containerRef.current || !measurementManager) return

		try {
			console.log('Loading shape data for gender:', gender)
			// Load shape data using the ShapeLoader
			const shapeLoader = new ShapeLoader(gender)
			await shapeLoader.loadShapeData()
			console.log('Shape data loaded successfully')

			// Get mean mesh and offset meshes
			const meanShapeData = shapeLoader.getMeanMesh()
			const offsetShapeDatas = shapeLoader.getOffsetMeshes()

			if (meanShapeData && offsetShapeDatas.length > 0) {
				console.log('Creating model from shape data')

				// Create a material for the body
				const material = new THREE.MeshPhongMaterial({
					color: gender === 'female' ? 0xffb6c1 : 0x87cefa,
					shininess: 30,
					flatShading: false,
				})

				// Create geometry from vertices
				const geometry = new THREE.BufferGeometry()

				// Ensure vertices are in the correct format
				const vertices = meanShapeData.vertices.flat()
				geometry.setAttribute(
					'position',
					new THREE.Float32BufferAttribute(vertices, 3),
				)

				// Add face indices if available
				if (Array.isArray(meanShapeData.faces) && meanShapeData.faces.length > 0) {
					const indices = meanShapeData.faces.flat()
					geometry.setIndex(indices)
				}

				// Compute normals for proper lighting
				geometry.computeVertexNormals()

				// Create the mesh
				const bodyMesh = new THREE.Mesh(geometry, material)
				bodyMesh.position.set(0, 1, 0) // Position at center, slightly elevated
				bodyMesh.scale.set(0.01, 0.01, 0.01) // Scale down if needed

				// Create offset meshes
				let offsetMeshes: THREE.Mesh[] = []
				offsetShapeDatas.forEach((data) => {
					const offsetGeometry = new THREE.BufferGeometry()
					offsetGeometry.setAttribute(
						'position',
						new THREE.Float32BufferAttribute(data.vertices.flat(), 3),
					)

					const mesh = new THREE.Mesh(offsetGeometry, material.clone())
					mesh.position.set(0, 1, 0)
					mesh.scale.set(0.01, 0.01, 0.01)
					offsetMeshes.push(mesh)
				})

				// Initialize the Model class with the mesh and offset meshes
				const model = new Model(bodyMesh, offsetMeshes, {
					originalPositions: vertices,
					gender: gender,
					container: containerRef.current,
				})

				// Store the model reference
				modelRef.current = model

				// Initialize with current measurements
				initializeModelWithMeasurements()
			} else {
				console.error('Failed to load shape data properly')
			}

			return () => {
				// Clean up
				if (modelRef.current) {
					modelRef.current.dispose()
				}
			}
		} catch (error) {
			console.error('Failed to initialize body visualizer:', error)
		}
	}

	// Update the initializeModelWithMeasurements function to work with our Model class
	const initializeModelWithMeasurements = useCallback(() => {
		if (!modelRef.current || !measurementManager) return

		const measurements = measurementManager.getAllMeasurements()
		measurements.forEach((measurement) => {
			const name = measurement.name
			const measurementIndex = measurementManager.getMeasurementIndex(name)

			if (measurementIndex !== -1 && modelRef.current) {
				const scaledValue = measurementManager.getScaledValue(name)
				// Use a smaller scale factor to avoid extreme deformations
				modelRef.current.setScalefactor(measurementIndex, scaledValue / 1000.0)
			}
		})
	}, [measurementManager])

	return (
		<Page>
			<Section>
				<div className='max-w-6xl mx-auto'>
					<div className='flex justify-between items-center mb-8'>
						<h1 className='text-3xl font-bold text-center'>
							{gender === 'female' ? 'Female' : 'Male'} Body Visualizer
						</h1>
						<button
							onClick={() => router.push('/')}
							className='px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition'
						>
							Go to Try-On
						</button>
					</div>

					<div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
						{/* 3D Visualization */}
						<div className='space-y-4'>
							<div className='relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden'>
								<div
									ref={containerRef}
									className='w-full h-full'
									style={{ pointerEvents: 'auto' }}
								/>
								<div className='absolute bottom-4 left-4 bg-white bg-opacity-90 px-4 py-2 rounded-lg shadow'>
									<p className='text-sm font-medium'>BMI: {bmi.toFixed(2)}</p>
									<p className='text-xs text-gray-600'>
										{bmi < 18.5
											? 'Underweight'
											: bmi < 25
											? 'Normal weight'
											: bmi < 30
											? 'Overweight'
											: 'Obese'}
									</p>
								</div>
								{hideBody && (
									<div className='absolute inset-0 flex items-center justify-center bg-white bg-opacity-90'>
										<div className='text-center'>
											<p className='text-lg font-medium text-gray-900'>
												Body Hidden
											</p>
											<p className='text-sm text-gray-600'>
												BMI is too low (≤ 17.5)
											</p>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Controls */}
						<div className='space-y-6'>
							<div className='flex justify-between items-center'>
								<h2 className='text-xl font-semibold'>Controls</h2>
								<button
									onClick={() =>
										setGender(gender === 'female' ? 'male' : 'female')
									}
									className='px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition'
								>
									Switch to {gender === 'female' ? 'Male' : 'Female'}
								</button>
							</div>

							<div className='space-y-4'>
								{/* Render sliders in the specified order */}
								{[
									'height',
									'weight',
									'chest',
									'waist',
									'hips',
									'inseam',
									'exercise',
								].map((name, index) => {
									const measurement = measurementManager?.getMeasurement(name)
									if (!measurement) return null

									return (
										<div key={measurement.name}>
											<div className='flex items-center mb-1'>
												<label className='text-sm font-medium text-gray-700 mr-2'>
													{measurement.name.charAt(0).toUpperCase() +
														measurement.name.slice(1)}
													:
												</label>
												<input
													type='text'
													value={Math.round(measurement.value)}
													onChange={(e) =>
														handleInputChange(measurement.name, e.target.value)
													}
													className='w-16 px-2 py-1 border border-gray-300 rounded text-center'
												/>
												<span className='ml-2 text-sm text-gray-700'>
													{measurement.unit}
												</span>
												<span className='ml-2 text-sm text-blue-500'>
													PREDICTED
													<button className='ml-1 text-blue-600 hover:underline'>
														(?)
													</button>
												</span>
											</div>
											<input
												type='range'
												min={measurement.min}
												max={measurement.max}
												value={measurement.value}
												onChange={(e) => {
													const value = Number(e.target.value)
													handleSliderChange(measurement.name, value)
												}}
												onMouseDown={() => handleSliderStart(index)}
												onMouseUp={() => handleSliderStop(index)}
												onTouchStart={() => handleSliderStart(index)}
												onTouchEnd={() => handleSliderStop(index)}
												className='w-full'
											/>
										</div>
									)
								})}

								<button
									onClick={handleUnitChange}
									className='w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition mt-4'
								>
									Switch Units
								</button>
							</div>

							<div className='bg-gray-50 p-4 rounded-lg'>
								<h3 className='font-medium mb-2'>Instructions</h3>
								<ul className='text-sm text-gray-600 space-y-2'>
									<li>• Use the mouse to rotate the 3D model</li>
									<li>• Scroll to zoom in/out</li>
									<li>
										• Adjust measurements using the sliders or input fields
									</li>
									<li>• Switch between male and female models</li>
									<li>• Toggle between metric and imperial units</li>
								</ul>
							</div>
						</div>
					</div>
				</div>
			</Section>
		</Page>
	)
}

export default BodyVisualizer
