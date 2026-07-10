/**
 * Image content for the Emotion Recognition game — data only, no logic.
 *
 * Everything here is an array/record so more images can be dropped in later
 * without touching the game logic: add files under `public/emotions` /
 * `public/groups` and list them here.
 */
import type { EmotionId } from '../emotionVocab'
import type { Gender } from '../../i18n/strings'

/**
 * Which stimulus pool an item belongs to:
 *  - training: used in normal (practice) play.
 *  - probe: held out of practice entirely and shown only in Assessment mode,
 *    so assessment measures generalization to untrained stimuli.
 */
export type StimulusPool = 'training' | 'probe'

/** A single-person photo tagged with the gender of the child shown, so the
 *  question can use the right pronoun ("he"/"she"). `probe: true` holds the
 *  image out of practice for generalization assessment. */
export interface SingleImage {
  src: string
  gender: Gender
  probe?: boolean
}

/**
 * Single-person photos, grouped by the emotion the face is showing. Used by the
 * Easy level and by single-person activities in Moderate/Hard. The `gender` of
 * each child was determined by inspecting the images. (Assets: `public/emotions/`.)
 */
export const SINGLE_IMAGES: Record<EmotionId, SingleImage[]> = {
  // Probe items are held out of practice wherever an emotion has ≥3 images, so
  // training still keeps some variety. Emotions with only 2 images have no
  // held-out single yet — add new photos and mark them `probe: true` to extend
  // assessment coverage.
  happy: [
    { src: './emotions/HappyFace.png', gender: 'boy' },
    { src: './emotions/HappyG.png', gender: 'girl' },
    { src: './emotions/Happy_Girl.png', gender: 'girl' },
    { src: './emotions/Smile_Boy.png', gender: 'boy' },
    { src: './emotions/Smile_Girl.png', gender: 'girl' },
    { src: './emotions/Smile2_Girl.png', gender: 'girl', probe: true },
  ],
  sad: [
    { src: './emotions/SadFace.png', gender: 'girl' },
    { src: './emotions/SadGirl.png', gender: 'girl' },
    { src: './emotions/Sad_Boy.png', gender: 'boy' },
    { src: './emotions/Sad_G.png', gender: 'girl', probe: true },
  ],
  angry: [
    { src: './emotions/Angry.png', gender: 'girl' },
    { src: './emotions/AngryGirl.png', gender: 'girl', probe: true },
    { src: './emotions/Angry_Boy.png', gender: 'boy' },
  ],
  surprised: [
    { src: './emotions/Surprise.png', gender: 'girl' },
    { src: './emotions/Surprise_Boy.png', gender: 'boy' },
  ],
  scared: [
    { src: './emotions/Fear.png', gender: 'girl' },
    { src: './emotions/Fear_Boy.png', gender: 'boy' },
  ],
  disgust: [
    { src: './emotions/Disgust.png', gender: 'girl' },
    { src: './emotions/Disgust_boy.png', gender: 'boy' },
  ],
}

/** Emotions that have at least one single-person image available. */
export const SINGLE_EMOTIONS: EmotionId[] = (Object.keys(SINGLE_IMAGES) as EmotionId[]).filter(
  (id) => SINGLE_IMAGES[id].length > 0,
)

export interface GroupPhoto {
  slug: string
  src: string
  emotions: EmotionId[] // ordered left → right
  genders: Gender[] // parallel to `emotions`, so a highlighted face gets the right pronoun
  /** Held out of practice; shown only in Assessment mode (generalization probe). */
  probe?: boolean
}

/**
 * Multi-person photos (2- and 3-person), each face labelled left→right. Used by
 * the "Who feels ___?" and highlighted "How does he/she feel?" questions in the
 * Moderate and Hard levels. `genders` runs parallel to `emotions` and was set by
 * inspecting each photo. (Assets live in `public/groups/`.)
 */
export const GROUP_PHOTOS: GroupPhoto[] = [
  // two-person
  { slug: 'disgust_fear', src: './groups/disgust_fear.png', emotions: ['disgust', 'scared'], genders: ['girl', 'girl'] },
  { slug: 'fear_angry', src: './groups/fear_angry.png', emotions: ['scared', 'angry'], genders: ['girl', 'girl'] },
  { slug: 'happy_sad', src: './groups/happy_sad.png', emotions: ['happy', 'sad'], genders: ['boy', 'girl'] },
  { slug: 'happy_surprise', src: './groups/happy_surprise.png', emotions: ['happy', 'surprised'], genders: ['girl', 'boy'] },
  { slug: 'sad_angry', src: './groups/sad_angry.png', emotions: ['sad', 'angry'], genders: ['boy', 'girl'] },
  { slug: 'surprise_disgust', src: './groups/surprise_disgust.png', emotions: ['surprised', 'disgust'], genders: ['girl', 'boy'], probe: true },
  // three-person
  { slug: 'disgust_surprise_angry', src: './groups/disgust_surprise_angry.png', emotions: ['disgust', 'surprised', 'angry'], genders: ['boy', 'girl', 'boy'] },
  // The `_2`/`_3` variants of combos that also exist in training make clean
  // holdouts: assessment shows the same emotion combination on unseen faces.
  { slug: 'disgust_surprise_angry_2', src: './groups/disgust_surprise_angry_2.png', emotions: ['disgust', 'surprised', 'angry'], genders: ['boy', 'girl', 'boy'], probe: true },
  { slug: 'disgust_surprise_fear', src: './groups/disgust_surprise_fear.png', emotions: ['disgust', 'surprised', 'scared'], genders: ['girl', 'girl', 'girl'] },
  { slug: 'fear_surprise_happy', src: './groups/fear_surprise_happy.png', emotions: ['scared', 'surprised', 'happy'], genders: ['boy', 'girl', 'boy'] },
  { slug: 'sad_happy_angry', src: './groups/sad_happy_angry.png', emotions: ['sad', 'happy', 'angry'], genders: ['boy', 'girl', 'boy'] },
  { slug: 'sad_happy_angry_2', src: './groups/sad_happy_angry_2.png', emotions: ['sad', 'happy', 'angry'], genders: ['boy', 'girl', 'girl'] },
  { slug: 'sad_happy_angry_3', src: './groups/sad_happy_angry_3.png', emotions: ['sad', 'happy', 'angry'], genders: ['boy', 'girl', 'boy'], probe: true },
  { slug: 'surprise_disgust_sad', src: './groups/surprise_disgust_sad.png', emotions: ['surprised', 'disgust', 'sad'], genders: ['girl', 'boy', 'boy'] },
]

/** Whether an item belongs to the requested pool. */
const inPool = (probe: boolean | undefined, pool: StimulusPool) =>
  pool === 'probe' ? !!probe : !probe

/** Single-person images of one emotion in a pool. May be empty for the probe
 *  pool — emotions without held-out images are simply not assessed yet. */
export const singleImagesFor = (emotion: EmotionId, pool: StimulusPool): SingleImage[] =>
  SINGLE_IMAGES[emotion].filter((img) => inPool(img.probe, pool))

/** Group photos of a given size (2 or 3 people) in a pool. */
export const groupPhotosFor = (size: 2 | 3, pool: StimulusPool): GroupPhoto[] =>
  GROUP_PHOTOS.filter((p) => p.emotions.length === size && inPool(p.probe, pool))

export const twoPersonPhotos = (): GroupPhoto[] => groupPhotosFor(2, 'training')
export const threePersonPhotos = (): GroupPhoto[] => groupPhotosFor(3, 'training')
