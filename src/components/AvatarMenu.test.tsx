import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AvatarMenu } from './AvatarMenu'

test('opens menu and fires export', async () => {
  const onExport = vi.fn()
  render(<AvatarMenu onExport={onExport} onImport={() => {}} />)
  expect(screen.queryByText('Export data')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /account menu/i }))
  await userEvent.click(screen.getByText('Export data'))
  expect(onExport).toHaveBeenCalled()
})
