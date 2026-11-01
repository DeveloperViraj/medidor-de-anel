import { describe, expect, it } from 'vitest';
import { awinLink, PARTNERS } from './partners';

describe('awinLink', () => {
  it("matches the link Awin's Link Builder generated", () => {
    expect(
      awinLink(
        PARTNERS.aliancasImperiais,
        'https://www.aliancasimperiais.com.br/alianca-de-casamento',
      ),
    ).toBe(
      'https://www.awin1.com/cread.php?awinmid=106747&awinaffid=3138998&ued=https%3A%2F%2Fwww.aliancasimperiais.com.br%2Falianca-de-casamento',
    );
  });

  it('adds the placement before the destination', () => {
    expect(
      awinLink(PARTNERS.aliancasImperiais, 'https://www.aliancasimperiais.com.br/', 'alianca page'),
    ).toBe(
      'https://www.awin1.com/cread.php?awinmid=106747&awinaffid=3138998&clickref=alianca%20page&ued=https%3A%2F%2Fwww.aliancasimperiais.com.br%2F',
    );
  });

  it('refuses links that are not https', () => {
    expect(() => awinLink(PARTNERS.aliancasImperiais, 'http://example.com/')).toThrow();
    expect(() => awinLink(PARTNERS.aliancasImperiais, 'not a url')).toThrow();
  });
});
