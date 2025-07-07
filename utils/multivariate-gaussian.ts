export class MultivariateGaussian {
	private means: number[]
	private covariance: number[][]
	private conditionedIndices: number[]
	private conditionedValues: number[]
	private unconditionedIndices: number[]
	private activeIndices: Set<number>
	private previousConditionedValues: Map<number, number>
	private threshold: number = 0.00001
	private measurementNames: string[] = [
		'height',
		'weight',
		'chest',
		'waist',
		'hips',
		'inseam',
	]
	private values: number[] = []

	constructor(
		means: number[],
		covariance: number[][],
		unconditionedIndices: number[],
		conditionedIndices: number[] = [],
		conditionedValues: number[] = [],
	) {
		this.means = means
		this.covariance = covariance
		this.unconditionedIndices = unconditionedIndices
		this.conditionedIndices = conditionedIndices
		this.conditionedValues = conditionedValues
		this.activeIndices = new Set()
		this.previousConditionedValues = new Map()
		this.values = [...means] // Initialize with means
	}

	private dotProduct(v1: number[], v2: number[]): number {
		return v1.reduce((sum, val, i) => sum + val * v2[i], 0)
	}

	private matrixTimesVector(matrix: number[][], vector: number[]): number[] {
		return matrix.map((row) => this.dotProduct(row, vector))
	}

	private matrixTranspose(matrix: number[][]): number[][] {
		if (!matrix.length) return []
		return matrix[0].map((_, i) => matrix.map((row) => row[i]))
	}

	private inverseMatrix(matrix: number[][]): number[][] {
		if (!matrix.length) return []
		if (matrix.length === 1) return [[1 / matrix[0][0]]]

		// For 2x2 matrices
		if (matrix.length === 2) {
			const [[a, b], [c, d]] = matrix
			const det = a * d - b * c
			return [
				[d / det, -b / det],
				[-c / det, a / det],
			]
		}

		// For larger matrices, use Gaussian elimination
		const n = matrix.length
		const augmented = matrix.map((row, i) => [
			...row,
			...Array(n)
				.fill(0)
				.map((_, j) => (i === j ? 1 : 0)),
		])

		// Forward elimination
		for (let i = 0; i < n; i++) {
			let maxRow = i
			for (let j = i + 1; j < n; j++) {
				if (Math.abs(augmented[j][i]) > Math.abs(augmented[maxRow][i])) {
					maxRow = j
				}
			}

			;[augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]]

			const pivot = augmented[i][i]
			for (let j = i; j < 2 * n; j++) {
				augmented[i][j] /= pivot
			}

			for (let j = 0; j < n; j++) {
				if (j !== i) {
					const factor = augmented[j][i]
					for (let k = i; k < 2 * n; k++) {
						augmented[j][k] -= factor * augmented[i][k]
					}
				}
			}
		}

		return augmented.map((row) => row.slice(n))
	}

	private getSubmatrix(
		matrix: number[][],
		rows: number[],
		cols: number[],
	): number[][] {
		return rows.map((i) => cols.map((j) => matrix[i][j]))
	}

	private getMeasurementIndex(name: string): number {
		return this.measurementNames.indexOf(name)
	}

	public conditionOnMeasurements(measurements: {
		[key: string]: number | null
	}): number[] | null {
		const fixedIndices = Object.entries(measurements)
			.filter(([_, value]) => value !== null)
			.map(([key]) => this.getMeasurementIndex(key))
			.filter((i) => i !== -1)

		const fixedValues = fixedIndices.map((i) => {
			const name = this.measurementNames[i]
			return measurements[name] as number
		})

		if (fixedIndices.length > 0) {
			this.conditionOnIndices(fixedIndices, fixedValues)
			return this.getConditionalDistribution()
		}
		return null
	}

	public conditionOnIndices(indices: number[], values: number[]) {
		// Update values for conditioned indices
		indices.forEach((index, i) => {
			this.values[index] = values[i]
		})
		// TODO: Implement proper conditioning logic
	}

	public getConditionalDistribution(): number[] {
		return this.means.map((mean, i) => {
			if (this.unconditionedIndices.includes(i)) {
				return mean
			}
			return 0
		})
	}

	public unconditionOnIndices(indices: number[]) {
		// Reset values to means for unconditioned indices
		indices.forEach((index) => {
			this.values[index] = this.means[index]
		})
		// TODO: Implement proper unconditioning logic
	}

	public setActiveIndices(indices: number[], values: number[]) {
		indices.forEach((index) => this.activeIndices.add(index))
		return this.updateActiveValues(indices, values)
	}

	public updateActiveValues(indices: number[], values: number[]) {
		const distribution = this.getConditionalDistribution()
		indices.forEach((index, i) => {
			if (this.activeIndices.has(index)) {
				this.previousConditionedValues.set(index, this.conditionedValues[i])
				this.conditionedValues[i] = values[i]
			}
		})
		return this.getConditionalDistribution()
	}

	public getValues(indices: number[]): number[] {
		const distribution = this.getConditionalDistribution()
		return indices.map((i) => distribution[i])
	}

	public getMeans(): number[] {
		return this.means
	}

	public getAllValues(): number[] {
		return this.values
	}

	public getCovariance(): number[][] {
		return this.covariance
	}
}
