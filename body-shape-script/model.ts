import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

interface ModelOptions {
	originalPositions?: Float32Array | number[]
	color?: THREE.Color | number | string
	gender?: 'male' | 'female'
	container?: HTMLElement
}

export class Model {
	private mesh: THREE.Mesh
	private geometry: THREE.BufferGeometry
	private originalPositions: Float32Array
	private offset_meshes: THREE.Mesh[]
	private scaleFactors: number[]
	private gender: string

	// Scene components
	private scene: THREE.Scene
	private camera: THREE.PerspectiveCamera
	private renderer: THREE.WebGLRenderer
	private controls: OrbitControls
	private container: HTMLElement | null = null
	private animationFrameId: number | null = null

	/**
	 * Creates a new Model instance
	 * @param mesh The base THREE.Mesh to use
	 * @param offset_meshes Array of offset meshes for deformations
	 * @param options Additional options for the model
	 */
	constructor(
		mesh: THREE.Mesh,
		offset_meshes: THREE.Mesh[],
		options: ModelOptions = {},
	) {
		this.mesh = mesh
		this.geometry = mesh.geometry as THREE.BufferGeometry
		this.offset_meshes = offset_meshes
		this.gender = options.gender || 'female'
		this.container = options.container || null

		// Initialize scale factors to zero
		this.scaleFactors = new Array(offset_meshes.length).fill(0)

		// Store original positions for resetting
		const positionAttribute = this.geometry.getAttribute('position')
		if (options.originalPositions) {
			this.originalPositions = new Float32Array(options.originalPositions)
		} else if (positionAttribute) {
			this.originalPositions = new Float32Array(positionAttribute.array)
		} else {
			this.originalPositions = new Float32Array()
			console.warn('No position attribute found in mesh geometry')
		}

		// Set color if provided
		if (options.color && mesh.material instanceof THREE.MeshBasicMaterial) {
			mesh.material.color = new THREE.Color(options.color)
		}

		// Initialize scene components
		this.scene = new THREE.Scene()
		this.scene.background = new THREE.Color(0xf0f0f0)

		// Setup camera with default values (will be updated if container is provided)
		this.camera = new THREE.PerspectiveCamera(45, 1, 0.002, 1000)
		this.camera.position.set(0, 1, 0.05)
		this.camera.lookAt(0, 1, 0)

		// Setup renderer with default values (will be updated if container is provided)
		this.renderer = new THREE.WebGLRenderer({ antialias: true })
		this.renderer.setPixelRatio(window.devicePixelRatio)

		// Setup controls
		this.controls = new OrbitControls(this.camera, this.renderer.domElement)
		this.controls.enableDamping = true
		this.controls.dampingFactor = 0.05
		this.controls.target.set(0, 1, 0)

		// Add lights to the scene
		this.setupLights()

		// Add grid helper
		const gridHelper = new THREE.GridHelper(10, 10)
		gridHelper.position.y = 1
		this.scene.add(gridHelper)

		// Add mesh to scene
		this.scene.add(this.mesh)

		// If container is provided, initialize the renderer
		if (this.container) {
			this.initializeRenderer()
		}
	}

	/**
	 * Sets up lights for the scene
	 */
	private setupLights(): void {
		// Add ambient light
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
		this.scene.add(ambientLight)

		// Add directional light
		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
		directionalLight.position.set(1, 1, 1)
		this.scene.add(directionalLight)
	}

	/**
	 * Initializes the renderer and attaches it to the container
	 */
	private initializeRenderer(): void {
		if (!this.container) return

		// Clear any existing content
		while (this.container.firstChild) {
			this.container.removeChild(this.container.firstChild)
		}

		// Set renderer size based on container
		this.renderer.setSize(
			this.container.clientWidth,
			this.container.clientHeight,
		)

		// Update camera aspect ratio
		this.camera.aspect =
			this.container.clientWidth / this.container.clientHeight
		this.camera.updateProjectionMatrix()

		// Append renderer to container
		this.container.appendChild(this.renderer.domElement)

		// Add resize listener
		window.addEventListener('resize', this.handleResize)

		// Start animation loop
		this.startAnimationLoop()
	}

	/**
	 * Handles window resize events
	 */
	private handleResize = (): void => {
		if (!this.container) return

		const width = this.container.clientWidth
		const height = this.container.clientHeight

		this.camera.aspect = width / height
		this.camera.updateProjectionMatrix()

		this.renderer.setSize(width, height)
	}

	/**
	 * Starts the animation loop
	 */
	private startAnimationLoop(): void {
		const animate = () => {
			this.animationFrameId = requestAnimationFrame(animate)

			// Update controls
			this.controls.update()

			this.draw(this.scene, this.camera, this.renderer)

			// Render scene
			this.renderer.render(this.scene, this.camera)
		}

		animate()
	}

	/**
	 * Stops the animation loop
	 */
	private stopAnimationLoop(): void {
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId)
			this.animationFrameId = null
		}
	}

	/**
	 * Sets a scale factor for a specific deformation
	 * @param index The index of the deformation
	 * @param value The scale factor value
	 */
	setScalefactor(index: number, value: number): void {
		if (index >= 0 && index < this.scaleFactors.length) {
			this.scaleFactors[index] = value
			this.updateGeometry()
		} else {
			console.warn(
				`Scale factor index ${index} out of bounds (0-${
					this.scaleFactors.length - 1
				})`,
			)
		}
	}

	/**
	 * Updates the geometry based on the current scale factors
	 */
	private updateGeometry(): void {
		// Get position attribute from geometry
		const positionAttribute = this.geometry.getAttribute('position')
		if (!positionAttribute) {
			console.warn('Position attribute is undefined in updateGeometry')
			return
		}

		const positions = positionAttribute.array as Float32Array

		// Reset positions to original mean mesh
		for (let i = 0; i < positions.length; i++) {
			positions[i] = this.originalPositions[i]
		}

		// Apply each offset mesh based on scale factors
		for (let i = 0; i < this.offset_meshes.length; i++) {
			const scaleFactor = this.scaleFactors[i]

			if (scaleFactor !== 0) {
				const offsetMesh = this.offset_meshes[i]
				const offsetGeometry = offsetMesh.geometry as THREE.BufferGeometry
				const offsetPositionAttribute = offsetGeometry.getAttribute('position')

				if (
					offsetPositionAttribute &&
					offsetPositionAttribute.array.length === positions.length
				) {
					const offsetPositions = offsetPositionAttribute.array as Float32Array

					// Apply scaled offsets to each vertex
					for (let j = 0; j < positions.length; j++) {
						positions[j] +=
							(offsetPositions[j] - this.originalPositions[j]) * scaleFactor
					}
				}
			}
		}

		// Mark the attribute as needing an update
		positionAttribute.needsUpdate = true
		this.geometry.computeVertexNormals()
	}

	/**
	 * Attaches the model to a container element
	 * @param container The HTML element to attach to
	 */
	attachToContainer(container: HTMLElement): void {
		this.container = container
		this.initializeRenderer()
	}

	/**
	 * Detaches the model from its container
	 */
	detach(): void {
		this.stopAnimationLoop()

		if (this.container) {
			// Remove renderer from container
			if (this.renderer.domElement.parentElement === this.container) {
				this.container.removeChild(this.renderer.domElement)
			}

			// Remove resize listener
			window.removeEventListener('resize', this.handleResize)

			this.container = null
		}
	}

	/**
	 * Gets the mesh with current deformations applied
	 * @returns The current mesh
	 */
	getMesh(): THREE.Mesh {
		return this.mesh
	}

	/**
	 * Gets the current gender of the model
	 * @returns The gender string
	 */
	getGender(): string {
		return this.gender
	}

	/**
	 * Sets the gender of the model
	 * @param gender The gender to set
	 */
	setGender(gender: string): void {
		this.gender = gender
	}

	/**
	 * Gets the scene
	 * @returns The THREE.Scene
	 */
	getScene(): THREE.Scene {
		return this.scene
	}

	/**
	 * Gets the camera
	 * @returns The THREE.PerspectiveCamera
	 */
	getCamera(): THREE.PerspectiveCamera {
		return this.camera
	}

	/**
	 * Gets the renderer
	 * @returns The THREE.WebGLRenderer
	 */
	getRenderer(): THREE.WebGLRenderer {
		return this.renderer
	}

	/**
	 * Gets the controls
	 * @returns The OrbitControls
	 */
	getControls(): OrbitControls {
		return this.controls
	}

	/**
	 * Cleans up resources when the model is no longer needed
	 */
	dispose(): void {
		this.detach()

		// Dispose of geometry and materials
		if (this.geometry) {
			this.geometry.dispose()
		}

		if (this.mesh.material) {
			if (Array.isArray(this.mesh.material)) {
				this.mesh.material.forEach((material) => material.dispose())
			} else {
				this.mesh.material.dispose()
			}
		}

		// Dispose of offset mesh geometries
		this.offset_meshes.forEach((offsetMesh) => {
			if (offsetMesh.geometry) {
				offsetMesh.geometry.dispose()
			}
		})

		// Dispose of renderer
		this.renderer.dispose()
	}

	/**
	 * Draws the model with the current deformations
	 * This method is maintained for compatibility with existing code
	 */
	draw(
		scene?: THREE.Scene,
		camera?: THREE.Camera,
		renderer?: THREE.WebGLRenderer,
	): void {
		// If external scene, camera, and renderer are provided, use them
		if (scene && camera && renderer) {
			renderer.render(scene, camera)
		}
		// Otherwise use internal components
		else if (this.scene && this.camera && this.renderer) {
			this.renderer.render(this.scene, this.camera)
		}
	}
}
