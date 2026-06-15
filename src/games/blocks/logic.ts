import type { Difficulty } from '../../types'

export type Owner = 'robot' | 'child'

export interface BlockSpec {
  color: string
  owner: Owner
  /** small horizontal jitter so the tower looks hand-stacked */
  offset: number
}

export interface BlockConfig {
  /** one round = robot places a block, then the child places a block */
  rounds: number
  /** how long the robot "thinks" before placing, in ms — longer = harder to wait */
  robotTurnMs: number
}

export const CONFIG: Record<Difficulty, BlockConfig> = {
  easy: { rounds: 5, robotTurnMs: 1300 },
  medium: { rounds: 7, robotTurnMs: 1800 },
  hard: { rounds: 10, robotTurnMs: 2400 },
}

export const BLOCK_COLORS = ['#e2554c', '#f5c542', '#5aa9e6', '#7ac74f', '#b06fd6', '#f08a3c']

/** Build the full alternating block sequence for a session (robot first). */
export function makeSequence(rounds: number, rng: () => number = Math.random): BlockSpec[] {
  const seq: BlockSpec[] = []
  for (let i = 0; i < rounds * 2; i++) {
    seq.push({
      color: BLOCK_COLORS[Math.floor(rng() * BLOCK_COLORS.length)],
      owner: i % 2 === 0 ? 'robot' : 'child',
      offset: (rng() - 0.5) * 0.14,
    })
  }
  return seq
}

/** Stacked Y centre of the block at a given index (blocks are BLOCK_H tall). */
export const BLOCK_H = 0.42
export function blockY(index: number): number {
  return BLOCK_H / 2 + index * BLOCK_H
}
