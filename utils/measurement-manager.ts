import { ShapeLoader } from '../body-shape-script/shape-loader'
import { Gender } from '../body-shape-script/types'

export interface Measurement {
	name: string
	value: number
	min: number
	max: number
	unit: 'cm' | 'kg' | 'inches' | 'lbs'
	isFixed: boolean
}

export class MeasurementManager {
	private measurements: Map<string, Measurement>
	private units: 'metric' | 'imperial'
	private conversionFactor: { weight: number; height: number } = {
		weight: 1.0,
		height: 1.0,
	}
	private fixedMeasurements: string[] = []
	private measurementOrder: string[] = []
	private orderByMeasurement: { [key: string]: number } = {}
	private initialValues: { [key: string]: number } = {}
	private stds: { [key: string]: number } = {}
	private minValues: { [key: string]: number } = {}
	private maxValues: { [key: string]: number } = {}
	private mu: number[] = []
	private sigma: number[][] = []
	private unconditionedIndices: number[] = []
	private conditionedIndices: number[] = []
	private conditionedValues: number[] = []
	private shapeLoader: ShapeLoader | null = null

	constructor(gender: Gender = 'female') {
		this.measurements = new Map()
		this.units = 'metric'
		this.setConversionFactor()
		this.shapeLoader = new ShapeLoader(gender)
		this.setupMeasurements()
	}

	private setConversionFactor() {
		if (this.units === 'metric') {
			this.conversionFactor = { weight: 1.0, height: 1.0 }
		} else {
			this.conversionFactor = { weight: 2.2, height: 1.0 / 2.54 }
		}
	}

	private async setupMeasurements() {
		const orderingOfData = [
			'waist',
			'chest',
			'hips',
			'height',
			'weight',
			'inseam',
			'exercise',
		]

		// Initialize tracking objects
		this.measurementOrder = orderingOfData

		// Initialize arrays first
		const numberOfSliders = orderingOfData.length
		this.mu = Array(numberOfSliders).fill(0)
		this.sigma = Array(numberOfSliders)
			.fill(0)
			.map(() => Array(numberOfSliders).fill(0))

		// Setup initial values and standard deviations
		for (let i = 0; i < orderingOfData.length; i++) {
			const name = orderingOfData[i]
			this.orderByMeasurement[name] = i

			// Initialize with default values - these will be overridden if model data is available
			this.initialValues[name] = 0
			this.stds[name] = 0
			this.minValues[name] = 0
			this.maxValues[name] = 100
		}

		// Try to load model data from the shape loader
		try {
			if (this.shapeLoader) {
				// Load shape data if not already loaded
				await this.shapeLoader.loadShapeData()

				// Get shape info from the shape loader
				const shapeInfo = this.shapeLoader.getShapeInfo()

				if (shapeInfo && shapeInfo.means && shapeInfo.covariance) {
					// Use model data if available
					const means = shapeInfo.means
					const covariance = shapeInfo.covariance

					// Use model data if available
					for (let i = 0; i < orderingOfData.length; i++) {
						const name = orderingOfData[i]
						// Convert from mm to cm by dividing by 10
						this.initialValues[name] = means[i] / 10.0
						this.stds[name] = Math.sqrt(covariance[i][i]) / 10.0

						// Set mu values for statistical calculations
						this.mu[i] = means[i] // Keep in mm for internal calculations
					}

					// Set covariance matrix from model
					this.sigma = covariance

					console.log('Loaded measurement data from shape model')

					this.initialValues['age'] *= 10
					this.initialValues['exercise'] *= 10
					this.initialValues['weight'] *= 10
					this.stds['age'] *= 10
					this.stds['exercise'] *= 10
					this.stds['weight'] *= 10

					// Calculate min and max values based on the statistical data
					for (let i = 0; i < orderingOfData.length; i++) {
						const name = orderingOfData[i]
						this.minValues[name] = Math.round(
							this.initialValues[name] - 4 * this.stds[name],
						)
						this.minValues[name] = Math.max(this.minValues[name], 0)
						this.maxValues[name] = Math.round(
							this.initialValues[name] + 5 * this.stds[name],
						)
					}

					// Apply special transformations for weight
					this.initialValues['weight'] = Math.pow(
						this.initialValues['weight'],
						3,
					)
					this.minValues['weight'] = Math.pow(this.minValues['weight'], 3)
					this.maxValues['weight'] = Math.pow(this.maxValues['weight'], 3)
					this.maxValues['exercise'] = 60

					this.unconditionedIndices = Array.from(
						{ length: numberOfSliders },
						(_, i) => i,
					)
					this.conditionedIndices = []
					this.conditionedValues = []

					// Setup measurements
					for (let i = 0; i < numberOfSliders; i++) {
						const name = orderingOfData[i]

						let unit: 'cm' | 'kg' | 'inches' | 'lbs' = 'cm'
						if (name === 'weight') {
							unit = this.units === 'metric' ? 'kg' : 'lbs'
						} else {
							unit = this.units === 'metric' ? 'cm' : 'inches'
						}

						this.measurements.set(name, {
							name,
							value: this.initialValues[name],
							min: this.minValues[name],
							max: this.maxValues[name],
							unit,
							isFixed: false,
						})
					}

					// Initialize all measurements as unfixed
					for (let i = 0; i < numberOfSliders; i++) {
						this.markSliderAsUnfixed(orderingOfData[i])
					}

					return // Exit early since we successfully loaded the data
				}
			}
		} catch (error) {
			console.error('Failed to load measurement data from shape model:', error)
		}

		// Fallback to default values if model data isn't available
		console.log('Using default measurement values')
		const defaultValues = {
			waist: 77,
			chest: 94,
			hips: 103,
			height: 164,
			weight: 65,
			inseam: 75,
			exercise: 4,
		}

		const defaultStds = {
			waist: 10,
			chest: 10,
			hips: 10,
			height: 10,
			weight: 10,
			inseam: 10,
			exercise: 2,
		}

		// Apply default values
		for (let i = 0; i < orderingOfData.length; i++) {
			const name = orderingOfData[i]
			this.initialValues[name] =
				defaultValues[name as keyof typeof defaultValues] || 0
			this.stds[name] = defaultStds[name as keyof typeof defaultStds] || 0

			// Set mu values for statistical calculations
			this.mu[i] = this.initialValues[name] * 10 // Scale up for internal calculations
		}

		// Calculate simple covariance matrix (identity matrix for now)
		for (let i = 0; i < numberOfSliders; i++) {
			for (let j = 0; j < numberOfSliders; j++) {
				this.sigma[i][j] =
					i === j
						? this.stds[orderingOfData[i]] * this.stds[orderingOfData[i]] * 100 // Scale for internal calculations
						: 0
			}
		}

		// Apply special scaling for certain measurements
		if ('age' in this.initialValues) {
			this.initialValues['age'] = 10 * this.initialValues['age']
			this.stds['age'] = 10 * this.stds['age']
		}
		this.initialValues['exercise'] = 10 * this.initialValues['exercise']
		this.initialValues['weight'] = 10 * this.initialValues['weight']
		this.stds['exercise'] = 10 * this.stds['exercise']
		this.stds['weight'] = 10 * this.stds['weight']

		// Calculate min and max values
		for (let i = 0; i < orderingOfData.length; i++) {
			const name = orderingOfData[i]
			this.minValues[name] = Math.round(
				this.initialValues[name] - 4 * this.stds[name],
			)
			this.minValues[name] = Math.max(this.minValues[name], 0)
			this.maxValues[name] = Math.round(
				this.initialValues[name] + 5 * this.stds[name],
			)
		}

		// Apply special transformations for weight
		this.initialValues['weight'] = Math.pow(this.initialValues['weight'], 3)
		this.minValues['weight'] = Math.pow(this.minValues['weight'], 3)
		this.maxValues['weight'] = Math.pow(this.maxValues['weight'], 3)
		this.maxValues['exercise'] = 60

		this.unconditionedIndices = Array.from(
			{ length: numberOfSliders },
			(_, i) => i,
		)
		this.conditionedIndices = []
		this.conditionedValues = []

		// Setup measurements
		for (let i = 0; i < numberOfSliders; i++) {
			const name = orderingOfData[i]

			let unit: 'cm' | 'kg' | 'inches' | 'lbs' = 'cm'
			if (name === 'weight') {
				unit = this.units === 'metric' ? 'kg' : 'lbs'
			} else {
				unit = this.units === 'metric' ? 'cm' : 'inches'
			}

			this.measurements.set(name, {
				name,
				value: this.initialValues[name],
				min: this.minValues[name],
				max: this.maxValues[name],
				unit,
				isFixed: false,
			})
		}

		// Initialize all measurements as unfixed
		for (let i = 0; i < numberOfSliders; i++) {
			this.markSliderAsUnfixed(orderingOfData[i])
		}
	}

	public getMeasurement(name: string): Measurement | undefined {
		return this.measurements.get(name)
	}

	public getMeasurementIndex(name: string): number {
		return this.orderByMeasurement[name] ?? -1
	}

	public setMeasurement(name: string, value: number) {
		const measurement = this.measurements.get(name)
		if (measurement) {
			measurement.value = value
			measurement.isFixed = true
		}
	}

	public resetMeasurement(name: string) {
		const measurement = this.measurements.get(name)
		if (measurement) {
			measurement.isFixed = false
		}
	}

	public toggleUnits() {
		this.units = this.units === 'metric' ? 'imperial' : 'metric'
		this.setConversionFactor()

		// Convert all measurements
		this.measurements.forEach((measurement, name) => {
			if (name === 'weight') {
				measurement.value = measurement.value * this.conversionFactor.weight
				measurement.unit = this.units === 'metric' ? 'kg' : 'lbs'
			} else {
				measurement.value = measurement.value * this.conversionFactor.height
				measurement.unit = this.units === 'metric' ? 'cm' : 'inches'
			}
		})
	}

	public calculateBMI(): number {
		const height = this.getMeasurement('height')?.value || 0
		const weight = this.getMeasurement('weight')?.value || 0

		if (this.units === 'imperial') {
			// Convert to metric for BMI calculation
			const heightInMeters = (height * 2.54) / 100
			const weightInKg = weight / 2.2
			return weightInKg / (heightInMeters * heightInMeters)
		} else {
			const heightInMeters = height / 100
			return weight / (heightInMeters * heightInMeters)
		}
	}

	public getFixedMeasurements(): string[] {
		return this.fixedMeasurements
	}

	public getAllMeasurements(): Measurement[] {
		return Array.from(this.measurements.values())
	}

	public getConversionFactor(): { weight: number; height: number } {
		return this.conversionFactor
	}

	public markSliderAsFixed(name: string) {
		if (!this.fixedMeasurements.includes(name)) {
			this.fixedMeasurements.push(name)
		}
	}

	public markSliderAsUnfixed(name: string) {
		const index = this.fixedMeasurements.indexOf(name)
		if (index !== -1) {
			this.fixedMeasurements.splice(index, 1)
		}
	}

	public getMu(): number[] {
		return this.mu
	}

	public getSigma(): number[][] {
		return this.sigma
	}

	public getUnconditionedIndices(): number[] {
		return this.unconditionedIndices
	}

	public getConditionedIndices(): number[] {
		return this.conditionedIndices
	}

	public getConditionedValues(): number[] {
		return this.conditionedValues
	}

	public setMeasurementRange(name: string, min: number, max: number) {
		const measurement = this.getMeasurement(name)
		if (measurement) {
			measurement.min = min
			measurement.max = max
		}
	}

	public updateConditionedValues() {
		this.conditionedIndices = []
		this.conditionedValues = []

		this.fixedMeasurements.forEach((name) => {
			const index = this.getMeasurementIndex(name)
			if (index !== -1) {
				this.conditionedIndices.push(index)
				const measurement = this.getMeasurement(name)
				if (measurement) {
					this.conditionedValues.push(measurement.value)
				}
			}
		})

		// Update unconditioned indices
		const allIndices = new Set(
			Array.from({ length: this.measurementOrder.length }, (_, i) => i),
		)
		this.conditionedIndices.forEach((index) => allIndices.delete(index))
		this.unconditionedIndices = Array.from(allIndices)
	}

	public getScaledValue(name: string): number {
		const measurement = this.getMeasurement(name)
		if (!measurement) return 0

		if (name === 'weight') {
			return Math.pow(measurement.value, 1 / 3)
		} else if (name === 'exercise' || name === 'age') {
			return measurement.value / 10
		} else {
			return measurement.value * 10
		}
	}

	public setScaledValue(name: string, scaledValue: number) {
		const measurement = this.getMeasurement(name)
		if (!measurement) return

		let actualValue: number
		if (name === 'weight') {
			actualValue = Math.pow(scaledValue, 3)
		} else if (name === 'exercise' || name === 'age') {
			actualValue = scaledValue * 10
		} else {
			actualValue = scaledValue / 10
		}

		measurement.value = actualValue
	}
}
