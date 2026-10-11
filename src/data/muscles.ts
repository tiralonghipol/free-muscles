// Muscle groups match the `primaryMuscles` / `secondaryMuscles` names used by free-exercise-db.
export type MuscleGroupId =
  | 'abdominals' | 'abductors' | 'adductors' | 'biceps' | 'calves' | 'chest'
  | 'forearms' | 'glutes' | 'hamstrings' | 'lats' | 'lower back' | 'middle back'
  | 'neck' | 'quadriceps' | 'shoulders' | 'traps' | 'triceps';

export interface MuscleGroup {
  id: MuscleGroupId;
  name: string;
  anatomy: string;
  description: string;
  /** Side the camera looks from when the group is selected ('side' = the figure's left). */
  view: 'front' | 'back' | 'side';
}

export const MUSCLE_GROUPS: Record<MuscleGroupId, MuscleGroup> = {
  chest: { id: 'chest', name: 'Chest', anatomy: 'Pectoralis major & minor', description: 'Pushes the arms forward and across the body (pressing, flyes).', view: 'front' },
  shoulders: { id: 'shoulders', name: 'Shoulders', anatomy: 'Deltoids (anterior, lateral, posterior)', description: 'Raises the arm forward, sideways and back. Key for overhead pressing.', view: 'front' },
  biceps: { id: 'biceps', name: 'Biceps', anatomy: 'Biceps brachii, brachialis', description: 'Bends the elbow and rotates the forearm palm-up.', view: 'front' },
  triceps: { id: 'triceps', name: 'Triceps', anatomy: 'Triceps brachii (long, lateral, medial heads)', description: 'Straightens the elbow. Makes up about two thirds of upper-arm mass.', view: 'back' },
  forearms: { id: 'forearms', name: 'Forearms', anatomy: 'Wrist flexors & extensors, brachioradialis', description: 'Controls the wrist and fingers; drives grip strength.', view: 'front' },
  abdominals: { id: 'abdominals', name: 'Abdominals', anatomy: 'Rectus abdominis, obliques, transversus abdominis', description: 'Flexes and rotates the trunk and stabilises the spine.', view: 'front' },
  traps: { id: 'traps', name: 'Traps', anatomy: 'Trapezius (upper fibres)', description: 'Shrugs and rotates the shoulder blades; supports the neck.', view: 'back' },
  lats: { id: 'lats', name: 'Lats', anatomy: 'Latissimus dorsi', description: 'Pulls the arms down and back (pull-ups, rows). Widest muscle of the back.', view: 'back' },
  'middle back': { id: 'middle back', name: 'Middle back', anatomy: 'Rhomboids, middle trapezius', description: 'Squeezes the shoulder blades together; key for posture and rowing.', view: 'back' },
  'lower back': { id: 'lower back', name: 'Lower back', anatomy: 'Erector spinae', description: 'Extends and stabilises the spine (deadlifts, back extensions).', view: 'back' },
  glutes: { id: 'glutes', name: 'Glutes', anatomy: 'Gluteus maximus', description: 'Extends the hip. The largest muscle in the body.', view: 'back' },
  abductors: { id: 'abductors', name: 'Abductors', anatomy: 'Gluteus medius & minimus, TFL', description: 'Moves the leg out to the side and stabilises the pelvis.', view: 'side' },
  adductors: { id: 'adductors', name: 'Adductors', anatomy: 'Adductor longus, brevis, magnus; gracilis', description: 'Pulls the legs together; stabilises squats and lunges.', view: 'front' },
  quadriceps: { id: 'quadriceps', name: 'Quadriceps', anatomy: 'Rectus femoris, vastus lateralis/medialis/intermedius', description: 'Straightens the knee. Main driver of squats and lunges.', view: 'front' },
  hamstrings: { id: 'hamstrings', name: 'Hamstrings', anatomy: 'Biceps femoris, semitendinosus, semimembranosus', description: 'Bends the knee and extends the hip.', view: 'back' },
  calves: { id: 'calves', name: 'Calves', anatomy: 'Gastrocnemius, soleus', description: 'Points the foot (calf raises, jumping, running).', view: 'back' },
  neck: { id: 'neck', name: 'Neck', anatomy: 'Sternocleidomastoid, splenius', description: 'Flexes, extends and rotates the head.', view: 'front' },
};
