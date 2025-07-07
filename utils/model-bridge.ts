// This file creates a bridge between the legacy Model class and our modern TypeScript code

import { Model } from '@/body-shape-script/model'
import { LegacyModel } from '@/body-shape-script/types'
import * as THREE from 'three'

// Define interfaces to match the legacy code structure
interface LegacyMesh {
	Positions: Float32Array
	Indices: Uint16Array
	Normals?: Float32Array
	TexCoords: Float32Array
	structured: {
		x: number[][]
		tri?: number[][]
		vrt2tri?: any[]
	}
}

// Create a wrapper for the legacy Model class
export class ModelBridge {
	private legacyModel: LegacyModel
	private threeMesh: THREE.Mesh | null = null
	private scene: THREE.Scene

	constructor(legacyModel: LegacyModel, scene: THREE.Scene) {
		this.legacyModel = legacyModel
		this.scene = scene
		this.createThreeMesh()
	}

	private createThreeMesh() {
		// Create a THREE.js geometry from the legacy model
		const geometry = new THREE.BufferGeometry()

		// Set vertices
		const positions = this.legacyModel.mesh.Positions
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

		// Set normals if available
		if (this.legacyModel.mesh.Normals) {
			geometry.setAttribute(
				'normal',
				new THREE.BufferAttribute(this.legacyModel.mesh.Normals, 3),
			)
		}

		// Set indices
		geometry.setIndex(
			new THREE.BufferAttribute(this.legacyModel.mesh.Indices, 1),
		)

		// Create material
		const material = new THREE.MeshPhongMaterial({
			color: 0xdddddd,
			specular: 0x222222,
			shininess: 25,
			flatShading: false,
		})

		// Create mesh
		this.threeMesh = new THREE.Mesh(geometry, material)
		this.scene.add(this.threeMesh)
	}

	public setScalefactor(index: number, value: number) {
		if (index >= 0 && index < this.legacyModel.number_of_offset_meshes) {
			this.legacyModel.setScalefactor(index, value)
			this.updateGeometry()
		}
	}

	public setColor(color: number) {
		if (this.threeMesh) {
			;(this.threeMesh.material as THREE.MeshPhongMaterial).color.setHex(color)
		}
	}

	private updateGeometry() {
		// This would need to be implemented based on how the legacy model updates
		// For now, we'll just update the mesh's position to show something changed
		if (this.threeMesh) {
			this.threeMesh.position.set(0, 0, 0)
			this.threeMesh.rotation.set(0, 0, 0)
		}
	}
}
