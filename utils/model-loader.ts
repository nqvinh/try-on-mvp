import * as THREE from 'three'
import { BodyMeasurements, Gender } from '../body-shape-script/types'
import { ShapeLoader } from '../body-shape-script/shape-loader'

export class ModelLoader {
	private scene: THREE.Scene
	public currentModel: THREE.Mesh | null
	private shapeLoader: ShapeLoader
	private scaleFactors: number[] = []
	private isAnimating: boolean = false
	private camera: THREE.PerspectiveCamera
	private isLoading: boolean = false
	private mu: number[] = [170, 60, 90, 70, 95, 75] // Default means
	private diff: number = 100 // Default difference for scaling

	constructor(scene: THREE.Scene, gender: Gender) {
		this.scene = scene
		this.currentModel = null
		this.shapeLoader = new ShapeLoader(gender)
		this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
		this.camera.position.set(0, 0, 4)
		this.camera.lookAt(0, 0, 0)
	}

	public async loadModel() {
		if (this.isLoading) {
			console.log('Model load already in progress, skipping...')
			return
		}

		try {
			this.isLoading = true
			console.log('Starting model load...')

			// Remove existing model if any
			if (this.currentModel) {
				console.log('Removing existing model')
				this.scene.remove(this.currentModel)
				this.currentModel = null
			}

			// Load shape data
			await this.shapeLoader.loadShapeData()
			console.log('Shape data loaded')

			const meanMesh = this.shapeLoader.getMeanMesh()
			if (!meanMesh) {
				console.error('Failed to load mean mesh')
				throw new Error('Failed to load mean mesh')
			}
			console.log('Mean mesh loaded:', meanMesh)
			console.log('Vertices count:', meanMesh.vertices.length)

			// Create base mesh
			const geometry = new THREE.BufferGeometry()
			const vertices = new Float32Array(meanMesh.vertices.flat())
			const indices = new Uint32Array((meanMesh.faces as number[][]).flat())

			console.log(
				'Creating geometry with vertices:',
				vertices.length,
				'indices:',
				indices.length,
			)

			// Scale vertices to a reasonable size
			const scaledVertices = new Float32Array(vertices.length)
			for (let i = 0; i < vertices.length; i += 3) {
				scaledVertices[i] = vertices[i] * 0.5 // Scale X
				scaledVertices[i + 1] = vertices[i + 1] * 0.5 // Scale Y
				scaledVertices[i + 2] = vertices[i + 2] * 0.5 // Scale Z
			}

			geometry.setAttribute(
				'position',
				new THREE.BufferAttribute(scaledVertices, 3),
			)
			geometry.setIndex(new THREE.BufferAttribute(indices, 1))
			geometry.computeVertexNormals()
			geometry.computeBoundingBox()

			// Log geometry details
			console.log('Geometry created:', {
				vertexCount: geometry.attributes.position.count,
				indexCount: geometry.index?.count,
				boundingBox: geometry.boundingBox,
			})

			// Create a simple material first to verify visibility
			const material = new THREE.MeshPhongMaterial({
				color: 0x808080,
				side: THREE.DoubleSide,
				flatShading: true,
				wireframe: false, // Disable wireframe
			})

			this.currentModel = new THREE.Mesh(geometry, material)
			console.log('Created mesh:', this.currentModel)

			// Position model
			this.currentModel.position.set(0, 0, 0)
			this.currentModel.rotation.set(0, 0, 0)
			this.currentModel.scale.set(1, 1, 1)

			// Add to scene
			//this.scene.add(this.currentModel)
			console.log('Added model to scene')

			// Add debug helpers
			const axesHelper = new THREE.AxesHelper(5)
			this.scene.add(axesHelper)

			const box = new THREE.BoxHelper(this.currentModel, 0xff0000) // Red box
			this.scene.add(box)

			// Log model bounds
			const boundingBox = geometry.boundingBox
			console.log('Model bounds:', boundingBox)
			console.log('Model position:', this.currentModel.position)
			console.log('Model scale:', this.currentModel.scale)
			console.log('Model rotation:', this.currentModel.rotation)

			// Center the model
			if (boundingBox) {
				const center = new THREE.Vector3()
				boundingBox.getCenter(center)
				this.currentModel.position.sub(center)
				console.log('Centered model at:', this.currentModel.position)
			}
		} catch (error) {
			console.error('Error loading model:', error)
		} finally {
			this.isLoading = false
		}
	}

	public setScalefactor(index: number, value: number) {
		if (this.scaleFactors[index] !== undefined) {
			this.scaleFactors[index] = value
			if (this.currentModel) {
				// Update model scale based on all scale factors
				const scale =
					1 +
					this.scaleFactors.reduce((a, b) => a + b, 0) /
						this.scaleFactors.length
				this.currentModel.scale.set(scale, scale, scale)

				// Update box helper
				const box = this.scene.children.find(
					(child) => child instanceof THREE.BoxHelper,
				)
				if (box) {
					this.scene.remove(box)
				}
				const newBox = new THREE.BoxHelper(this.currentModel, 0xff0000)
				this.scene.add(newBox)

				// Force update
				this.currentModel.updateMatrix()
				this.currentModel.updateMatrixWorld(true)
			}
		}
	}

	public updateModel(measurements: BodyMeasurements) {
		if (!this.currentModel) return

		// Calculate scale factors
		const heightScale = (measurements.height - this.mu[0]) / this.diff
		const weightScale = (measurements.weight - this.mu[1]) / this.diff
		const chestScale = (measurements.chest - this.mu[2]) / this.diff
		const waistScale = (measurements.waist - this.mu[3]) / this.diff
		const hipsScale = (measurements.hips - this.mu[4]) / this.diff
		const inseamScale = (measurements.inseam - this.mu[5]) / this.diff

		this.scaleFactors = [
			heightScale,
			weightScale,
			chestScale,
			waistScale,
			hipsScale,
			inseamScale,
		]

		// Update model scale
		const scale =
			1 +
			this.scaleFactors.reduce((a, b) => a + b, 0) / this.scaleFactors.length
		this.currentModel.scale.set(scale, scale, scale)

		// Update box helper
		const box = this.scene.children.find(
			(child) => child instanceof THREE.BoxHelper,
		)
		if (box) {
			this.scene.remove(box)
		}
		const newBox = new THREE.BoxHelper(this.currentModel, 0xff0000)
		this.scene.add(newBox)

		// Force update
		this.currentModel.updateMatrix()
		this.currentModel.updateMatrixWorld(true)
	}

	public setColor(color: number) {
		if (this.currentModel) {
			const material = this.currentModel.material as THREE.MeshPhongMaterial
			material.color.setHex(color)
		}
	}
}
