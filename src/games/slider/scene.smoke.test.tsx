import { expect, test } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { SceneInner } from './SliderScene'

test('slider scene handles every state and a full slide without throwing', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneInner ahead={4} queueColors={['#e2554c', '#f5c542', '#5aa9e6', '#7ac74f']} showYou slideTrigger={0} sliderIsYou={false} />,
  )
  expect(renderer.scene).toBeTruthy()
  await renderer.advanceFrames(5, 16)

  // a queue kid slides
  await renderer.update(
    <SceneInner ahead={3} queueColors={['#e2554c', '#f5c542', '#5aa9e6', '#7ac74f']} showYou slideTrigger={1} sliderIsYou={false} />,
  )
  await renderer.advanceFrames(90, 16)

  // your turn — empty queue, you at the front
  await renderer.update(
    <SceneInner ahead={0} queueColors={['#e2554c', '#f5c542', '#5aa9e6', '#7ac74f']} showYou slideTrigger={4} sliderIsYou={false} />,
  )
  await renderer.advanceFrames(30, 16)

  // you slide (hidden from the line)
  await renderer.update(
    <SceneInner ahead={0} queueColors={['#e2554c', '#f5c542', '#5aa9e6', '#7ac74f']} showYou={false} slideTrigger={5} sliderIsYou />,
  )
  await renderer.advanceFrames(120, 16)

  await renderer.unmount()
})
