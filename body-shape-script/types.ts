import * as THREE from 'three'

export interface BodyMeasurements {
	height: number
	weight: number
	chest: number
	waist: number
	hips: number
	inseam: number
}

export interface ShapeInfo {
	filenames: string[]
	means: number[]
	covariance: number[][]
}

export interface MeshData {
	vertices: number[][]
	faces: boolean | number[][]
	normals?: number[][]
	texCoords?: number[][]
}

export interface OffsetMesh {
	name: string
	data: MeshData
	scaleFactor: number
}

export interface NormalModel {
	templatePointNormals: number[]
	dtemplatePointNormals: number[][]
}

export type Gender = 'male' | 'female'

export interface ModelOptions {
	color?: number
	textureImage?: HTMLImageElement
	scaleFactors: number[]
}

export interface ShapeData {
	name: string
	vertices: number[][]
	faces: boolean | number[][]
}

export interface LegacyMesh extends THREE.Mesh {
	Positions: Float32Array
	Indices: Uint16Array
	Normals?: Float32Array
	TexCoords: Float32Array
	structured: boolean
}

export interface LegacyModel {
	mesh: LegacyMesh
	offset_meshes: THREE.Mesh[]
	number_of_offset_meshes: number
	setScalefactor(index: number, value: number): void
	setColor(color: THREE.Color): void
}
