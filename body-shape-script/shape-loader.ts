import { ShapeData, ShapeInfo, Gender } from './types'
import { MeshUtils } from './mesh-utils'
import { shapeInfo, mean, offsetMeshes } from './shape-data'

export class ShapeLoader {
	private gender: Gender
	private shapeInfo: ShapeInfo | null = null
	private meanMesh: ShapeData | null = null
	private offsetMeshes: ShapeData[] = []

	constructor(gender: Gender) {
		this.gender = gender
	}

	public async loadShapeData(): Promise<void> {
		try {
			// Use local data instead of fetching
			this.shapeInfo = shapeInfo
			this.meanMesh = mean
			this.offsetMeshes = offsetMeshes
			console.log(this.meanMesh, mean)
		} catch (error) {
			console.error('Error loading shape data:', error)
			throw error
		}
	}

	public getMeanMesh(): ShapeData | null {
		return this.meanMesh
	}

	public getOffsetMeshes(): ShapeData[] {
		return this.offsetMeshes
	}

	public getShapeInfo(): ShapeInfo | null {
		return this.shapeInfo
	}

	public createNormalModel() {
		if (!this.meanMesh || this.offsetMeshes.length === 0) {
			throw new Error('Shape data not loaded')
		}

		return MeshUtils.createNormalModel(this.meanMesh, this.offsetMeshes)
	}
}
