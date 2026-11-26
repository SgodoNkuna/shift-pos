import { expect, it } from 'vitest'
import { iosVersion, tokenFrom } from './IosSetup'

it('reads the invite code from a pasted link or a bare code', () => {
  expect(tokenFrom('Here: https://shift-pos.pages.dev/?join=83AB3a3611c17e55bbc6445b8a6aa8b02453b1f246be8664 thanks')).toBe('83ab3a3611c17e55bbc6445b8a6aa8b02453b1f246be8664')
  expect(tokenFrom(' 83ab3a3611c17e55bbc6445b8a6aa8b02453b1f246be8664 ')).toBe('83ab3a3611c17e55bbc6445b8a6aa8b02453b1f246be8664')
  expect(tokenFrom('hello')).toBeNull()
})
it('reads the iOS version', () => {
  expect(iosVersion('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)')).toBe(17.4)
  expect(iosVersion('Mozilla/5.0 (iPhone; CPU iPhone OS 16_3_1 like Mac OS X)')).toBe(16.3)
  expect(iosVersion('Mozilla/5.0 (Linux; Android 14)')).toBeNull()
})
