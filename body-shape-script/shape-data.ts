import { ShapeInfo, ShapeData } from './types'
import { shapeInfo } from './shapeinfo'
import { mean } from './mean'
import { waist_circumference_pref_plus_5mm } from './waist_circumference_pref_plus_5mm'
import { chest_circumference_plus_5mm_vertices } from './chest_circumference_plus_5mm'
import { hip_circumference_maximum_plus_5mm_vertices } from './hip_circumference_maximum_plus_5mm'
import { stature_plus_5mm } from './stature_plus_5mm'
import { weight_cube_root_plus_5kg } from './weight_cube_root_plus_5kg'
import { inseam_right_plus_5mm_vertices } from './inseam_right_plus_5mm'
import { fitnessPlus5Hours } from './fitness_plus_5hours'

export { shapeInfo }

// TODO: These need to be properly initialized with actual mesh data
export { mean }

export const offsetMeshes: ShapeData[] = [
    waist_circumference_pref_plus_5mm,
    chest_circumference_plus_5mm_vertices,
    hip_circumference_maximum_plus_5mm_vertices,
    stature_plus_5mm,
    weight_cube_root_plus_5kg,
    inseam_right_plus_5mm_vertices,
    fitnessPlus5Hours
]






