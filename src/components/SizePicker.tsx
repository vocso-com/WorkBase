import { useState } from 'react'
import type { Node, SizeKey } from '../types'
import { SIZE_WEIGHT, shareIfSized, sharesOf } from '../lib/weight'
import { challengeSize } from '../lib/confirm'
import { findParent } from '../lib/tree'
import { useStore } from '../store/useStore'
import { Icon } from './ui/Icon'

const ORDER: SizeKey[] = ['S', 'M', 'L', 'XL', 'XXL']

const CAPTION: Record<SizeKey, string> = {
  S: 'half the default',
  M: 'the default',
  L: 'twice the default',
  XL: 'four times the default',
  XXL: 'eight times the default',
}

const pct = (n: number) => `${Math.round(n * 100)}%`

/**
 * Sizing is a comparison, never a tag. The picker shows what each choice would
 * *claim* of the set, because people are excellent at relative judgment across
 * a handful of things and poor at absolute estimation — "which is the big one"
 * takes three seconds, "is this four hours or six" takes a meeting.
 *
 * Nothing here is required. Most nodes never get a size: the structure infers
 * one, and this only exists for the cases where that inference is visibly
 * wrong — the ten-hour task nobody broke down.
 */
export function SizePicker({ node }: { node: Node }) {
  const [open, setOpen] = useState(false)
  const roots = useStore(s => s.doc.roots)
  const hours = useStore(s => s.doc.profile?.hoursPerM)

  const parent = findParent(roots, node.id)
  const siblings = parent ? parent.children : roots
  const index = siblings.findIndex(s => s.id === node.id)
  const currentShare = index >= 0 ? sharesOf(siblings)[index] : undefined
  const suggestion = challengeSize(node, siblings)

  const label = node.size ?? 'Size'
  // A size is a comparison, not a property. "50%" alone reads as something the
  // task *is*; naming what it is a share of keeps the relativity visible, which
  // is what stops an XXL here being confused with an XXL in another project.
  const shareOf = parent ? parent.title : 'the project'
  const approxHours = (key: SizeKey) => (hours ? ` · ≈${Math.round(SIZE_WEIGHT[key] * hours)}h` : '')

  return (
    <div className="cm-qp-wrap">
      <button className={`cm-qp${node.size ? ' set' : ''}`} onClick={() => setOpen(o => !o)}>
        <Icon name="ti-scale" className="cm-qp-lead" />
        {label}
        {currentShare !== undefined
          ? <span className="size-share" title={`${pct(currentShare)} of ${shareOf}`}>{pct(currentShare)}</span>
          : null}
        <Icon name="ti-chevron-down" className="cm-qp-caret" />
      </button>

      {suggestion && !open ? (
        <button
          className="size-challenge"
          title="The structure beneath this node disagrees with its declared size"
          onClick={() => useStore.getState().setSize(node.id, suggestion)}
        >
          Now holds most of the work — resize to {suggestion}?
        </button>
      ) : null}

      {open ? (
        <div className="cm-qp-pop size-pop" onClick={e => e.stopPropagation()}>
          <div className="size-pop-head">Share of <b>{shareOf}</b></div>
          <button
            className={`cm-qp-opt${!node.size ? ' on' : ''}`}
            onClick={() => { useStore.getState().setSize(node.id, undefined); setOpen(false) }}
          >
            <span className="size-key">Auto</span>
            <span className="size-cap">from sub-items</span>
          </button>
          {ORDER.map(key => (
            <button
              key={key}
              className={`cm-qp-opt${node.size === key ? ' on' : ''}`}
              onClick={() => { useStore.getState().setSize(node.id, key); setOpen(false) }}
            >
              <span className="size-key">{key}</span>
              <span className="size-cap">{CAPTION[key]}{approxHours(key)}</span>
              <span className="size-share">{pct(shareIfSized(node, siblings, key))}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
