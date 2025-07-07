import { MeshData, NormalModel } from './types'

export class MeshUtils {
	static flatten2DArray<T>(array: T[][]): T[] {
		if (!array.length) return []

		const height = array.length
		const width = array[0].length
		const length = height * width
		const result = new Array(length)
		let index = length

		for (let i = height; i; ) {
			--i
			for (let j = width; j; ) {
				result[--index] = array[i][--j]
			}
		}
		return result
	}

	static createNormalModel(
		template: MeshData,
		offsetMeshes: MeshData[],
	): NormalModel {
		// If faces is boolean, we can't calculate normals
		if (typeof template.faces === 'boolean') {
			return {
				templatePointNormals: [],
				dtemplatePointNormals: []
			}
		}

		const tri = template.faces
		const tx = template.vertices
		const vrt2tri = this.createVertexToFaceMap(template)

		const scaledNormal: number[][] = new Array(tri.length)
		const dscaledNormal: number[][][] = new Array(offsetMeshes.length)

		for (let oo = 0; oo < offsetMeshes.length; ++oo) {
			dscaledNormal[oo] = new Array(tri.length)
		}

		for (let ii = 0; ii < tri.length; ++ii) {
			const t = tri[ii]
			scaledNormal[ii] = this.cross(
				this.sub(tx[t[1]], tx[t[0]]),
				this.sub(tx[t[2]], tx[t[0]]),
			)

			for (let oo = 0; oo < offsetMeshes.length; ++oo) {
				const ox = offsetMeshes[oo].vertices
				dscaledNormal[oo][ii] = this.add(
					this.cross(
						this.sub(tx[t[1]], tx[t[0]]),
						this.sub(
							this.sub(ox[t[2]], tx[t[2]]),
							this.sub(ox[t[0]], tx[t[0]]),
						),
					),
					this.cross(
						this.sub(
							this.sub(ox[t[1]], tx[t[1]]),
							this.sub(ox[t[0]], tx[t[0]]),
						),
						this.sub(tx[t[2]], tx[t[0]]),
					),
				)
			}
		}

		const templateNormals = new Array(3 * tx.length).fill(0.0)
		for (let i = 0; i < tx.length; ++i) {
			const vertexFaces = vrt2tri[i]
			for (let j = 0; j < vertexFaces.length; j++) {
				templateNormals[3 * i] += scaledNormal[vertexFaces[j]][0]
				templateNormals[3 * i + 1] += scaledNormal[vertexFaces[j]][1]
				templateNormals[3 * i + 2] += scaledNormal[vertexFaces[j]][2]
			}
		}

		const dnormals: number[][] = new Array(offsetMeshes.length)
		for (let oo = 0; oo < offsetMeshes.length; ++oo) {
			dnormals[oo] = new Array(3 * tx.length).fill(0.0)
			for (let i = 0; i < tx.length; ++i) {
				const vertexFaces = vrt2tri[i]
				for (let j = 0; j < vertexFaces.length; j++) {
					dnormals[oo][3 * i] += dscaledNormal[oo][vertexFaces[j]][0]
					dnormals[oo][3 * i + 1] += dscaledNormal[oo][vertexFaces[j]][1]
					dnormals[oo][3 * i + 2] += dscaledNormal[oo][vertexFaces[j]][2]
				}
			}
		}

		return {
			templatePointNormals: templateNormals,
			dtemplatePointNormals: dnormals,
		}
	}

	private static createVertexToFaceMap(mesh: MeshData): number[][] {
		if (typeof mesh.faces === 'boolean') {
			return mesh.vertices.map(() => [])
		}

		const vertexToFaceList: number[][] = mesh.vertices.map(() => [])
		for (let i = 0; i < mesh.faces.length; i++) {
			const face = mesh.faces[i]
			vertexToFaceList[face[0]].push(i)
			vertexToFaceList[face[1]].push(i)
			vertexToFaceList[face[2]].push(i)
		}
		return vertexToFaceList
	}

	private static cross(a: number[], b: number[]): number[] {
		return [
			a[1] * b[2] - a[2] * b[1],
			a[2] * b[0] - a[0] * b[2],
			a[0] * b[1] - a[1] * b[0],
		]
	}

	private static add(a: number[], b: number[]): number[] {
		return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
	}

	private static sub(a: number[], b: number[]): number[] {
		return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
	}
}
