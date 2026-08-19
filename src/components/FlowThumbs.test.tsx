import { render, screen, act } from '@testing-library/react'
import { FlowView } from './FlowView'
import { useStore } from '../store/useStore'
import { findNode } from '../lib/tree'
import { emptyDocument } from '../lib/serialize'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
})

function projectWithImage(open: boolean) {
  let pid = '', tid = ''
  act(() => { pid = useStore.getState().addProject('Acme Redesign') })
  act(() => { tid = useStore.getState().addChildNode(pid, 'Homepage mockup') })
  act(() => {
    useStore.getState().patch(tid, { description: 'The approved direction.', cardOpen: open })
    useStore.getState().addAttachment(tid, { name: 'mockup.png', type: 'image/png', dataUrl: PNG })
  })
  return findNode(useStore.getState().doc.roots, pid)!
}

test('an opened card previews its image attachments', () => {
  render(<FlowView node={projectWithImage(true)} />)
  const thumb = screen.getByAltText('mockup.png')
  expect(thumb).toBeInTheDocument()
  expect(thumb).toHaveAttribute('src', PNG)
})

test('a collapsed card shows no thumbnails — the canvas stays a map', () => {
  render(<FlowView node={projectWithImage(false)} />)
  expect(screen.queryByAltText('mockup.png')).not.toBeInTheDocument()
})

test('a non-image attachment is never previewed', () => {
  let pid = '', tid = ''
  act(() => { pid = useStore.getState().addProject('Acme Redesign') })
  act(() => { tid = useStore.getState().addChildNode(pid, 'Brief') })
  act(() => {
    useStore.getState().patch(tid, { description: 'The signed brief.', cardOpen: true })
    useStore.getState().addAttachment(tid, { name: 'brief.pdf', type: 'application/pdf', dataUrl: 'data:application/pdf;base64,x' })
  })
  render(<FlowView node={findNode(useStore.getState().doc.roots, pid)!} />)
  expect(screen.queryByAltText('brief.pdf')).not.toBeInTheDocument()
})
