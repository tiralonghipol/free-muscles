"""Build public/anatomy.glb from the Z-Anatomy muscular + skeletal FBX files.

Source: https://github.com/LluisV/Z-Anatomy-Sample (Assets/Models/1.0 Models), CC BY-SA 4.0.

    blender -b --factory-startup -P scripts/build-anatomy.py -- \
        MuscularSystem100.fbx SkeletalSystem100.fbx public/anatomy.glb

Every exported mesh carries glTF extras that three.js exposes as `userData`:
    kind:  'muscle' (clickable, has `group`), 'other' (muscle with no exercise group) or 'bone'
    group: free-exercise-db muscle group id (see src/data/muscles.ts)
    label: human-readable structure name, e.g. "Long head of biceps brachii"
"""
import re
import sys

import bpy

argv = sys.argv[sys.argv.index('--') + 1:]
MUSCLES_FBX, BONES_FBX, OUT = argv

# --- Muscle → exercise group --------------------------------------------------
# First matching regex wins. Matched against the label (side suffix removed, lowercase).
GROUP_RULES = [
    ('chest', r'pectoralis|subclavius|serratus anterior'),
    ('shoulders', r'deltoid|supraspinatus|infraspinatus|teres minor|subscapularis'),
    ('lats', r'latissimus|teres major'),
    ('traps', r'descending part of trapezius|levator scapulae'),
    ('middle back', r'trapezius|rhomboid|serratus posterior superior'),
    ('biceps', r'biceps brachii|brachialis muscle|coracobrachialis'),
    ('triceps', r'triceps brachii|anconeus'),
    ('neck', r'colli|capitis|sternocleidomastoid|scalenus|platysma|hyoid|digastric|sternothyroid'),
    ('lower back', r'iliocostalis|longissimus|spinalis|multifidus|rotatores|interspinales|intertransversarii'
                   r'|quadratus lumborum|serratus posterior inferior'),
    ('abdominals', r'rectus abdominis|abdominal oblique|transversus abdominis|pyramidalis|linea alba'),
    ('glutes', r'gluteus maximus|piriformis|gemellus|obturator internus|quadratus femoris'),
    ('abductors', r'gluteus medius|gluteus minimus|tensor fasciae latae|iliotibial tract'),
    ('adductors', r'adductor (longus|brevis|magnus|minimus)|gracilis|pectineus|obturator externus'),
    ('quadriceps', r'rectus femoris|vastus|sartorius|iliacus|psoas'),
    ('hamstrings', r'biceps femoris|semitendinosus|semimembranosus'),
    ('calves', r'gastrocnemius|soleus|plantaris|calcaneal tendon|tibialis|fibularis|popliteus'
               r'|(extensor|flexor) (digitorum|hallucis) longus|tendon of extensor digitorum longus'),
    ('forearms', r'carpi|digitorum|pollicis|indicis|digiti minimi|brachioradialis|pronator|supinator'
                 r'|palmaris|lumbrical muscles of hand|interossei muscles of hand|palmar interossei|opponens'),
]

# Muscles kept as non-clickable context (face, scalp, ribcage wall).
OTHER_RULES = r'facial|masticatory|epicranius|auricular|external intercostal'

# Groups (Z-Anatomy parent empties) and names dropped entirely: internal, tiny or non-muscle tissue.
DROP_PARENTS = r'bursae|tendon sheath|fasciae|fascia\.g|laryngeal|pharyngeal|tongue|soft palate|extra-ocular' \
               r'|auditory ossicles|pelvic diaphragm|levator ani|perineal|levatores costarum'
DROP_NAMES = r'fascia|bursa|retinacul|septum|aponeurosis|ligament|sheath|internal intercostal' \
             r'|innermost intercostal|diaphragm|transversus thoracis|cross section'
DROP_BONES = r'incus|malleus|stapes|arytenoid|corniculate|cricoid|thyroid cartilage|aperture|inlet|outlet'

# Target triangle budgets after decimation.
MUSCLE_RATIO, BONE_RATIO, MIN_FACES = 0.14, 0.12, 120


def label_of(name: str) -> str:
    name = re.sub(r'\.(l|r|g|\d+)$', '', name)
    return name.strip('()[] ')


def side_of(name: str) -> str:
    m = re.search(r'\.(l|r)$', name)
    return m.group(1) if m else ''


def ancestors(o):
    p = o.parent
    while p:
        yield p.name
        p = p.parent


def classify_muscle(o):
    """Return (kind, group) or None to drop."""
    chain = ' '.join(ancestors(o)).lower()
    label = label_of(o.name).lower()
    # Connective tissue that is visible on the surface and reads as part of a muscle group.
    if label == 'iliotibial tract':
        return 'muscle', 'abductors'
    if 'patellar retinaculum' in label:
        return 'muscle', 'quadriceps'
    if re.search(DROP_PARENTS, chain) or re.search(DROP_NAMES, label):
        return None
    if 'muscles of foot' in chain:  # Names like "flexor digitorum brevis" would otherwise match the forearm rules.
        return 'other', None
    for group, rx in GROUP_RULES:
        if re.search(rx, label):
            return 'muscle', group
    if re.search(OTHER_RULES, chain) or re.search(OTHER_RULES, label):
        return 'other', None
    print('DROPPED muscle:', o.name)
    return None


def is_bone(o):
    if o.type != 'MESH' or len(o.data.polygons) <= 50:
        return False
    # Real bones hang straight off a group empty; deeper meshes are landmarks / muscle attachment overlays.
    if not o.parent or o.parent.type != 'EMPTY':
        return False
    return not re.search(DROP_BONES, o.name.lower())


def import_fbx(path, keep):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    kept = []
    for o in new:
        info = keep(o) if o.type == 'MESH' and len(o.data.polygons) > 0 else None
        if info:
            kept.append((o, info))
    # Flatten: unparent the kept meshes (keeping their world transform), delete everything else.
    for o, _ in kept:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    keep_set = {o for o, _ in kept}
    for o in new:
        if o not in keep_set:
            bpy.data.objects.remove(o, do_unlink=True)
    return kept


def decimate(o, ratio):
    faces = len(o.data.polygons)
    r = max(ratio, min(1.0, MIN_FACES / faces))
    if r < 1.0:
        mod = o.modifiers.new('dec', 'DECIMATE')
        mod.ratio = r
        dg = bpy.context.evaluated_depsgraph_get()
        mesh = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        o.modifiers.clear()
        old = o.data
        o.data = mesh
        if old.users == 0:
            bpy.data.meshes.remove(old)
    me = o.data
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]):
        if me.has_custom_normals:
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
    me.shade_smooth()
    for uv in list(me.uv_layers):
        me.uv_layers.remove(uv)
    for attr in [a.name for a in me.color_attributes]:
        me.color_attributes.remove(me.color_attributes[attr])
    me.materials.clear()


bpy.ops.wm.read_factory_settings(use_empty=True)

muscles = import_fbx(MUSCLES_FBX, classify_muscle)
bones = import_fbx(BONES_FBX, lambda o: ('bone', None) if is_bone(o) else None)

stats = {}
for o, (kind, group) in muscles + bones:
    label, side = label_of(o.name), side_of(o.name)
    decimate(o, BONE_RATIO if kind == 'bone' else MUSCLE_RATIO)
    o['kind'] = kind
    o['label'] = label
    if side:
        o['side'] = side
    if group:
        o['group'] = group
    key = group or kind
    s = stats.setdefault(key, [0, 0])
    s[0] += 1
    s[1] += len(o.data.polygons)

for k, (n, f) in sorted(stats.items()):
    print(f'{k:12s} {n:4d} meshes {f:7d} faces')
print('TOTAL', sum(n for n, _ in stats.values()), 'meshes', sum(f for _, f in stats.values()), 'faces')

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    export_extras=True,
    export_materials='NONE',
    export_texcoords=False,
    export_normals=True,
    export_yup=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=10,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=8,
)
print('WROTE', OUT)
