import { describe, expect, it } from 'vitest'
import { EMOTIONS } from '../games/emotionVocab'
import {
  DISPLAY_LANGS,
  emotionLabel,
  nameFaceQuestion,
  singleFaceQuestion,
  whoFeelsQuestion,
} from './strings'

describe('i18n string table', () => {
  it('uses gender-specific pronouns for single-face prompts (no "he/she")', () => {
    expect(singleFaceQuestion('boy', 'en')).toBe('How does he feel now?')
    expect(singleFaceQuestion('girl', 'en')).toBe('How does she feel now?')
    expect(singleFaceQuestion('boy', 'en')).not.toContain('/')
    expect(singleFaceQuestion('boy', 'ml')).toContain('അവന') // masculine Malayalam
    expect(singleFaceQuestion('girl', 'ml')).toContain('അവൾ') // feminine Malayalam
  })

  it('uses gender-specific pronouns for highlighted-face prompts', () => {
    expect(nameFaceQuestion('boy', 'en')).toBe('How does he feel?')
    expect(nameFaceQuestion('girl', 'en')).toBe('How does she feel?')
  })

  it('interpolates the emotion into the "who feels" prompt per language', () => {
    expect(whoFeelsQuestion('happy', 'en')).toBe('Who feels happy?')
    expect(whoFeelsQuestion('happy', 'ml')).toBe('ആരാണ് സന്തോഷമുള്ളത്?')
  })

  it('has a non-empty label for every emotion in every display language', () => {
    for (const e of EMOTIONS) {
      for (const lang of DISPLAY_LANGS) {
        expect(emotionLabel(e.id, lang).length).toBeGreaterThan(0)
        expect(whoFeelsQuestion(e.id, lang).length).toBeGreaterThan(0)
      }
    }
  })

  it('shows both languages side by side for prompts', () => {
    expect(DISPLAY_LANGS).toEqual(['en', 'ml'])
  })
})
