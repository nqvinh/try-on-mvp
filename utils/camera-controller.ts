import * as THREE from 'three'

export class CameraController {
  private camera: THREE.PerspectiveCamera
  private target: THREE.Vector3
  private distance: number
  private rotationX: number
  private rotationY: number
  private isDragging: boolean
  private previousMousePosition: { x: number; y: number }

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
    this.target = new THREE.Vector3(0, 0, 0)
    this.distance = 5
    this.rotationX = 0
    this.rotationY = 0
    this.isDragging = false
    this.previousMousePosition = { x: 0, y: 0 }

    this.setupEventListeners()
  }

  private setupEventListeners() {
    document.addEventListener('mousedown', this.onMouseDown.bind(this))
    document.addEventListener('mousemove', this.onMouseMove.bind(this))
    document.addEventListener('mouseup', this.onMouseUp.bind(this))
    document.addEventListener('wheel', this.onMouseWheel.bind(this))
  }

  private onMouseDown(event: MouseEvent) {
    this.isDragging = true
    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY
    }
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.isDragging) return

    const deltaMove = {
      x: event.clientX - this.previousMousePosition.x,
      y: event.clientY - this.previousMousePosition.y
    }

    this.rotationY += deltaMove.x * 0.01
    this.rotationX += deltaMove.y * 0.01

    // Limit vertical rotation
    this.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotationX))

    this.updateCameraPosition()

    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY
    }
  }

  private onMouseUp() {
    this.isDragging = false
  }

  private onMouseWheel(event: WheelEvent) {
    const delta = event.deltaY * 0.01
    this.distance = Math.max(2, Math.min(10, this.distance + delta))
    this.updateCameraPosition()
  }

  private updateCameraPosition() {
    const x = this.distance * Math.cos(this.rotationX) * Math.sin(this.rotationY)
    const y = this.distance * Math.sin(this.rotationX)
    const z = this.distance * Math.cos(this.rotationX) * Math.cos(this.rotationY)

    this.camera.position.set(x, y, z)
    this.camera.lookAt(this.target)
  }

  public update() {
    this.updateCameraPosition()
  }
} 